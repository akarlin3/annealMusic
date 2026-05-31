/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderStemsOffline } from '@/export/StemRenderer';
import type { StemRenderConfig } from '@/export/StemRenderer';
import { decodeState } from '@/share/encode';
import { SCHEMA_VERSION } from '@/share/schema';
import { DEFAULT_PARAMS } from '@/state/params';
import type { SlotId, SlotState } from '@/loop/types';
import type { RenderEngine, RenderOptions, RenderResult } from './types';

export class BrowserOfflineRenderEngine implements RenderEngine {
  async render(payload: string, options: RenderOptions): Promise<RenderResult> {
    const decoded = decodeState(SCHEMA_VERSION, payload);

    // Resolve basic parameters
    const baseParams =
      decoded.kind === 'patch'
        ? decoded.params
        : (decoded.piece?.defaultsState.params ?? DEFAULT_PARAMS);
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

    const loopConfig =
      decoded.kind === 'patch'
        ? decoded.loops
        : (decoded as any).piece?.defaultsState.loops;
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

    const config: StemRenderConfig = {
      params: params as any,
      engineId:
        decoded.kind === 'patch'
          ? decoded.engineId
          : ((decoded as any).piece?.defaultsState.engineId ?? 'sine'),
      engineParams: (decoded.kind === 'patch'
        ? decoded.engineParams[decoded.engineId]
        : ((decoded as any).piece?.defaultsState.engineParams ?? {})) as any,
      loopConfig: loopConfig as any,
      loopBuffers,
      loopStates,
      mode: options.mode ?? (decoded.kind === 'piece' ? 'piece' : 'open'),
      piece: (decoded.kind === 'piece' ? decoded.piece : options.piece) as any,
      durationSec: options.durationSec,
      sampleRate: options.sampleRate,
      bitDepth: options.bitDepth,
      includeFx: options.withFx ?? true,
      includePartials: options.perPartial ?? false,
      seed: options.seed,
      patchTitle:
        decoded.kind === 'piece'
          ? (decoded.piece.title ?? 'Piece')
          : 'Offline Render',
      patchHash: 'headless',
    };

    const outputs = await renderStemsOffline(
      config,
      () => {}, // progress hook
      { aborted: false },
    );

    return { outputs };
  }
}
