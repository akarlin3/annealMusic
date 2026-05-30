/* eslint-disable */
// Ensure basic browser-like globals exist for the engine
if (typeof globalThis.navigator === 'undefined') {
  (globalThis as any).navigator = { deviceMemory: 8 };
}
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}

import { OfflineAudioContext } from 'node-web-audio-api';
import { renderStemsOffline } from '@/export/StemRenderer.js';
import type { StemRenderConfig } from '@/export/StemRenderer.js';
import { decodeState } from '@/share/encode.js';
import { SCHEMA_VERSION } from '@/share/schema.js';
import { DEFAULT_PARAMS } from '@/state/params.js';
import type { SlotId, SlotState } from '@/loop/types.js';
import type {
  RenderEngine,
  RenderEngineOptions,
  RenderEngineResult,
} from './types.js';

export class NodeRenderEngine implements RenderEngine {
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

  async renderPatch(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult> {
    const decoded = decodeState(SCHEMA_VERSION, payload);
    if (decoded.kind !== 'patch') {
      throw new Error(`Expected patch payload, got kind: ${decoded.kind}`);
    }

    const params = {
      ...DEFAULT_PARAMS,
      ...decoded.params,
      tuning: decoded.tuning ?? { system: 'equal', referenceA4Hz: 440 },
      customScaleRatios: undefined,
      customEqRatio: undefined,
    };

    const loopBuffers: Record<SlotId, AudioBuffer | null> = {
      A: null,
      B: null,
      C: null,
    };
    const loopStates: Record<SlotId, SlotState> = {
      A: decoded.loops.A.muted
        ? 'muted'
        : decoded.loops.A.frozen
          ? 'frozen'
          : 'playing',
      B: decoded.loops.B.muted
        ? 'muted'
        : decoded.loops.B.frozen
          ? 'frozen'
          : 'playing',
      C: decoded.loops.C.muted
        ? 'muted'
        : decoded.loops.C.frozen
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
      engineId: decoded.engineId,
      engineParams: (decoded.engineParams[decoded.engineId] ?? {}) as any,
      loopConfig: decoded.loops,
      loopBuffers,
      loopStates,
      mode: decoded.mode,
      arcId: decoded.arcId,
      durationSec: options.durationSec,
      sampleRate: options.sampleRate,
      bitDepth: options.bitDepth,
      includeFx: options.withFx ?? true,
      includePartials: options.perPartial ?? false,
      seed: options.seed,
      patchTitle: 'CLI Render',
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
      const { runPythonConverter } = await import('../output/converter.js');
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

  async renderPiece(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult> {
    const decoded = decodeState(SCHEMA_VERSION, payload);
    if (decoded.kind !== 'piece') {
      throw new Error(`Expected piece payload, got kind: ${decoded.kind}`);
    }

    const defaults = decoded.piece.defaultsState;
    const params = {
      ...DEFAULT_PARAMS,
      ...defaults.params,
      tuning: defaults.tuning ?? { system: 'equal', referenceA4Hz: 440 },
      customScaleRatios: undefined,
      customEqRatio: undefined,
    };

    const loopBuffers: Record<SlotId, AudioBuffer | null> = {
      A: null,
      B: null,
      C: null,
    };
    const loopStates: Record<SlotId, SlotState> = {
      A: defaults.loops.A.muted
        ? 'muted'
        : defaults.loops.A.frozen
          ? 'frozen'
          : 'playing',
      B: defaults.loops.B.muted
        ? 'muted'
        : defaults.loops.B.frozen
          ? 'frozen'
          : 'playing',
      C: defaults.loops.C.muted
        ? 'muted'
        : defaults.loops.C.frozen
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
      engineId: defaults.engineId,
      engineParams: (defaults.engineParams[defaults.engineId] ?? {}) as any,
      loopConfig: defaults.loops,
      loopBuffers,
      loopStates,
      mode: 'piece',
      piece: decoded.piece as any,
      durationSec: options.durationSec,
      sampleRate: options.sampleRate,
      bitDepth: options.bitDepth,
      includeFx: options.withFx ?? true,
      includePartials: options.perPartial ?? false,
      seed: options.seed,
      patchTitle: decoded.piece.title ?? 'Piece Render',
      patchHash: 'headless',
      logFormat: actualLogFormat,
      logOut: actualLogOut,
      logRate: options.logRate,
      logMode: options.logMode,
    };

    const outputs = await renderStemsOffline(
      config,
      () => {},
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
      const { runPythonConverter } = await import('../output/converter.js');
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

  async renderListeningSession(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult> {
    const decoded = decodeState(SCHEMA_VERSION, payload);
    if (decoded.kind !== 'listening-session') {
      throw new Error(
        `Expected listening session payload, got kind: ${decoded.kind}`,
      );
    }

    const ls = decoded.listeningSession;

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
    const params = {
      ...DEFAULT_PARAMS,
      ...defaults.params,
      tuning: defaults.tuning ?? { system: 'equal', referenceA4Hz: 440 },
      customScaleRatios: undefined,
      customEqRatio: undefined,
    };

    const loopBuffers: Record<SlotId, AudioBuffer | null> = {
      A: null,
      B: null,
      C: null,
    };
    const loopStates: Record<SlotId, SlotState> = {
      A: defaults.loops.A.muted
        ? 'muted'
        : defaults.loops.A.frozen
          ? 'frozen'
          : 'playing',
      B: defaults.loops.B.muted
        ? 'muted'
        : defaults.loops.B.frozen
          ? 'frozen'
          : 'playing',
      C: defaults.loops.C.muted
        ? 'muted'
        : defaults.loops.C.frozen
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
      engineId: defaults.engineId,
      engineParams: (defaults.engineParams[defaults.engineId] ?? {}) as any,
      loopConfig: defaults.loops,
      loopBuffers,
      loopStates,
      mode: 'listening-session',
      piece: dummyPiece as any,
      listeningSession: {
        settleInMs: ls.settleInMs,
        integrationMs: ls.integrationMs,
        bellSchedule: ls.bellSchedule,
      },
      durationSec: options.durationSec,
      sampleRate: options.sampleRate,
      bitDepth: options.bitDepth,
      includeFx: options.withFx ?? true,
      includePartials: options.perPartial ?? false,
      seed: options.seed,
      patchTitle: ls.title ?? 'Listening Session',
      patchHash: 'headless',
      logFormat: actualLogFormat,
      logOut: actualLogOut,
      logRate: options.logRate,
      logMode: options.logMode,
    };

    const outputs = await renderStemsOffline(
      config,
      () => {},
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
      const { runPythonConverter } = await import('../output/converter.js');
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
