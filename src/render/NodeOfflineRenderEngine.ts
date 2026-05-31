/* eslint-disable */
// Ensure basic browser-like globals exist for the engine in Node environments
if (typeof globalThis.navigator === 'undefined') {
  (globalThis as any).navigator = { deviceMemory: 8 };
}
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}

import { OfflineAudioContext } from 'node-web-audio-api';
import { renderStemsOffline } from '@/export/StemRenderer';
import type { StemRenderConfig } from '@/export/StemRenderer';
import { decodeState } from '@/share/encode';
import { SCHEMA_VERSION } from '@/share/schema';
import { DEFAULT_PARAMS } from '@/state/params';
import type { SlotId, SlotState } from '@/loop/types';
import type { RenderEngine, RenderOptions, RenderResult } from './types';

export class NodeOfflineRenderEngine implements RenderEngine {
  private createSafeOfflineContext(
    channels: number,
    frames: number,
    sampleRate: number,
    durationSec: number,
  ): OfflineAudioContext {
    const ctx = new OfflineAudioContext(channels, frames, sampleRate);
    const originalSuspend = ctx.suspend;
    ctx.suspend = function (suspendTime: number) {
      // If the suspension is too close to the end, ignore it safely to avoid Node crash
      if (suspendTime >= durationSec - 0.005) {
        return Promise.resolve();
      }
      return originalSuspend.call(this, suspendTime);
    };
    return ctx;
  }

  async render(payload: string, options: RenderOptions): Promise<RenderResult> {
    const decoded = decodeState(SCHEMA_VERSION, payload);

    let baseParams: any;
    let engineId: any;
    let engineParams: any;
    let loopConfig: any;
    let piece: any = undefined;
    let listeningSession: any = undefined;
    let sonificationSpec: any = undefined;

    const renderMode =
      options.mode ??
      (decoded.kind === 'piece'
        ? 'piece'
        : decoded.kind === 'listening-session'
          ? 'listening-session'
          : decoded.kind === 'sonification'
            ? 'sonification'
            : 'open');

    if (decoded.kind === 'patch') {
      baseParams = decoded.params;
      engineId = decoded.engineId;
      engineParams = decoded.engineParams[decoded.engineId] ?? {};
      loopConfig = decoded.loops;
    } else if (decoded.kind === 'piece') {
      const defaults = decoded.piece.defaultsState;
      baseParams = defaults.params;
      engineId = defaults.engineId;
      engineParams = defaults.engineParams[defaults.engineId] ?? {};
      loopConfig = defaults.loops;
      piece = decoded.piece;
    } else if (decoded.kind === 'listening-session') {
      const ls = decoded.listeningSession;
      listeningSession = {
        settleInMs: ls.settleInMs,
        integrationMs: ls.integrationMs,
        bellSchedule: ls.bellSchedule,
      };

      const dummyPiece = (options as any).piece ?? {
        defaultsState: {
          params: DEFAULT_PARAMS,
          engineId: 'sine',
          engineParams: {},
          loops: {
            A: {
              muted: true,
              frozen: false,
              driftCoupled: false,
              grain: { sizeMs: 120, density: 12, posJitter: 0, pitchJitter: 0 },
            },
            B: {
              muted: true,
              frozen: false,
              driftCoupled: false,
              grain: { sizeMs: 120, density: 12, posJitter: 0, pitchJitter: 0 },
            },
            C: {
              muted: true,
              frozen: false,
              driftCoupled: false,
              grain: { sizeMs: 120, density: 12, posJitter: 0, pitchJitter: 0 },
            },
          },
        },
        segments: [
          { type: 'open', durationMs: options.durationSec * 1000, config: {} },
        ],
      };
      const defaults = dummyPiece.defaultsState;
      baseParams = defaults.params;
      engineId = defaults.engineId;
      engineParams = defaults.engineParams[defaults.engineId] ?? {};
      loopConfig = defaults.loops;
      piece = dummyPiece;
    } else if (decoded.kind === 'sonification') {
      const son = decoded.sonification;
      sonificationSpec = son.mappingSpec;
      baseParams = DEFAULT_PARAMS;
      engineId = 'sine';
      engineParams = {};
      loopConfig = {
        A: {
          muted: true,
          frozen: false,
          driftCoupled: false,
          grain: { sizeMs: 120, density: 12, posJitter: 0, pitchJitter: 0 },
        },
        B: {
          muted: true,
          frozen: false,
          driftCoupled: false,
          grain: { sizeMs: 120, density: 12, posJitter: 0, pitchJitter: 0 },
        },
        C: {
          muted: true,
          frozen: false,
          driftCoupled: false,
          grain: { sizeMs: 120, density: 12, posJitter: 0, pitchJitter: 0 },
        },
      };
    }

    const params = {
      ...DEFAULT_PARAMS,
      ...baseParams,
      tuning: decoded.tuning ??
        (decoded as any).piece?.defaultsState.tuning ?? {
          system: 'equal',
          referenceA4Hz: 440,
        },
      customScaleRatios: undefined,
      customEqRatio: undefined,
    };

    const loopBuffers: Record<SlotId, AudioBuffer | null> = {
      A: null,
      B: null,
      C: null,
    };
    const loopStates: Record<SlotId, SlotState> = {
      A: loopConfig?.A.muted
        ? 'muted'
        : loopConfig?.A.frozen
          ? 'frozen'
          : 'playing',
      B: loopConfig?.B.muted
        ? 'muted'
        : loopConfig?.B.frozen
          ? 'frozen'
          : 'playing',
      C: loopConfig?.C.muted
        ? 'muted'
        : loopConfig?.C.frozen
          ? 'frozen'
          : 'playing',
    };

    const isScientificFormat =
      options.logOut &&
      (options.logFormat === 'hdf5' || options.logFormat === 'parquet');
    const actualLogOut = isScientificFormat
      ? options.logOut + '.tmp.jsonl'
      : options.logOut;
    const actualLogFormat = isScientificFormat ? 'jsonl' : options.logFormat;

    const config: StemRenderConfig = {
      params: params as any,
      engineId: engineId,
      engineParams: engineParams as any,
      loopConfig: loopConfig,
      loopBuffers,
      loopStates,
      mode: renderMode,
      piece: piece as any,
      listeningSession,
      sonificationSpec,
      durationSec: options.durationSec,
      sampleRate: options.sampleRate,
      bitDepth: options.bitDepth,
      includeFx: options.withFx ?? true,
      includePartials: options.perPartial ?? false,
      seed: options.seed,
      patchTitle:
        decoded.kind === 'piece'
          ? (decoded.piece.title ?? 'Piece Render')
          : 'Node Render',
      patchHash: 'headless',
      logFormat: actualLogFormat,
      logOut: actualLogOut,
      logRate: options.logRate,
      logMode: options.logMode,
    };

    const outputs = await renderStemsOffline(
      config,
      () => {}, // progress hook
      { aborted: false },
      (ch, frames, sr) =>
        this.createSafeOfflineContext(
          ch,
          frames,
          sr,
          options.durationSec,
        ) as any,
    );

    if (isScientificFormat && options.logOut) {
      const { runPythonConverter } =
        await import('../../tools/cli/src/output/converter.js');
      runPythonConverter({
        inputJsonl: actualLogOut!,
        outputFile: options.logOut,
        format: options.logFormat as any,
      });
      const fs = await import('node:fs');
      if (fs.existsSync(actualLogOut!)) {
        fs.unlinkSync(actualLogOut!);
      }
    }

    return { outputs };
  }
}
