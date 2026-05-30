/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Headless preview-render harness (v0.8, server-side rendering · Option B).
 *
 * Loaded by Playwright on the API host. It builds the *real* `Orchestrator` from
 * a patch payload, plays it in real time, taps the post-fx analyser into a
 * `MediaStreamAudioDestinationNode`, and records `durationSec` of audio via
 * `MediaRecorder`. The server repackages the returned WebM/Opus into a small
 * Ogg/Opus thumbnail. Because this runs in Chromium — the production runtime —
 * the preview uses the exact same engine logic and DSP as the client (see
 * `docs/v0.8-PLAN.md` §3).
 *
 * Reuses the same store-hydration + capture-hydration path the app uses on a
 * `/p/<slug>` load, so a previewed patch sounds identical to a loaded one.
 */
import { Orchestrator } from '@/audio/orchestrator';
import { SCHEMA_VERSION } from '@/share/schema';
import { decodeState } from '@/share/encode';
import { applyDecodedToStore, captureSlotsFromPayload } from '@/share/hydrate';
import { useParamStore } from '@/state/params';
import type { SlotId } from '@/loop/types';
import { PiecePlayer } from '@/piece/PiecePlayer';
import { hashStringToInt } from '@/piece/resolver';
import type { Piece } from '@/piece/types';
import type { AnnealMusicParams } from '@/state/params';
import type {
  EngineId,
  EngineParams,
  SharedParams,
} from '@/audio/engines/types';

interface RenderOptions {
  durationSec: number;
  /** Presigned capture URLs, in flagged-slot order (matches the payload). */
  captureUrls?: string[];
  previewSliceStartMs?: number;
}

interface RenderResult {
  b64: string;
  mime: string;
}

declare global {
  interface Window {
    __annealRender: (
      payload: string,
      opts: RenderOptions,
    ) => Promise<RenderResult>;
  }
}

const RECORD_MIME = 'audio/webm;codecs=opus';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function render(
  payload: string,
  opts: RenderOptions,
): Promise<RenderResult> {
  // Hydrate the store exactly as the client does on load.
  useParamStore.getState().reset();
  const decoded = decodeState(SCHEMA_VERSION, payload);

  if (decoded.kind === 'piece') {
    const piece = decoded.piece;
    if (piece.variationSeed === null || piece.variationSeed === undefined) {
      piece.variationSeed = hashStringToInt(
        piece.title || 'render-harness-seed',
      );
    }

    const pieceTuning = (piece.defaultsState as any).tuning;
    const pieceCustomRatios = (piece.defaultsState as any).customScaleRatios;
    const pieceCustomEq = (piece.defaultsState as any).customEqRatio;

    const initialSharedParams: SharedParams = {
      ...(piece.defaultsState.params as unknown as AnnealMusicParams),
      tuning: pieceTuning,
      customScaleRatios: pieceCustomRatios,
      customEqRatio: pieceCustomEq,
    };

    const orch = new Orchestrator(
      initialSharedParams,
      piece.defaultsState.engineId,
      piece.defaultsState.engineParams as unknown as Partial<
        Record<EngineId, EngineParams>
      >,
      undefined,
      piece.defaultsState.loops,
    );

    orch.ensureLoops();
    const analyser = orch.getAnalyser();
    if (!analyser) throw new Error('analyser unavailable');
    const ctx = analyser.context as AudioContext;
    const dest = ctx.createMediaStreamDestination();
    analyser.connect(dest);

    const slots = captureSlotsFromPayload(payload);
    const urls = opts.captureUrls ?? [];
    for (let i = 0; i < slots.length && i < urls.length; i++) {
      const res = await fetch(urls[i]!);
      const buf = await orch.decodeAudio(await res.arrayBuffer());
      orch.loadLoopBuffer(slots[i] as SlotId, buf);
    }

    const recorder = new MediaRecorder(dest.stream, { mimeType: RECORD_MIME });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start();

    const player = new PiecePlayer(piece as unknown as Piece, orch);
    if (opts.previewSliceStartMs && opts.previewSliceStartMs > 0) {
      player.seek(opts.previewSliceStartMs);
    }
    player.start();

    await new Promise((r) => setTimeout(r, opts.durationSec * 1000));

    player.stop();
    recorder.stop();
    await stopped;
    await orch.dispose();

    const blob = new Blob(chunks, { type: RECORD_MIME });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { b64: bytesToBase64(bytes), mime: RECORD_MIME };
  }

  // Otherwise, handle patch
  applyDecodedToStore(decoded);

  const state = useParamStore.getState();

  let customRatios: number[] | undefined;
  let customEq: number | undefined;
  if (state.tuning.system === 'custom' && state.tuning.sclId) {
    const customScale = state.customScales.find(
      (s) => s.id === state.tuning.sclId,
    );
    if (customScale) {
      customRatios = customScale.parsed_scale;
      customEq = customScale.parsed_scale[customScale.parsed_scale.length - 1];
    }
  }

  const initialSharedParams: SharedParams = {
    ...state.params,
    tuning: state.tuning,
    customScaleRatios: customRatios,
    customEqRatio: customEq,
  };

  const orch = new Orchestrator(
    initialSharedParams,
    state.engineId,
    state.engineParams,
    undefined,
    state.loops,
  );

  // Build the audio core so we can tap the analyser before audio begins.
  orch.ensureLoops();
  const analyser = orch.getAnalyser();
  if (!analyser) throw new Error('analyser unavailable');
  const ctx = analyser.context as AudioContext;
  const dest = ctx.createMediaStreamDestination();
  analyser.connect(dest);

  // Rehydrate captures into their slots (same order as the client load flow).
  const slots = captureSlotsFromPayload(payload);
  const urls = opts.captureUrls ?? [];
  for (let i = 0; i < slots.length && i < urls.length; i++) {
    const res = await fetch(urls[i]!);
    const buf = await orch.decodeAudio(await res.arrayBuffer());
    orch.loadLoopBuffer(slots[i] as SlotId, buf);
  }

  const recorder = new MediaRecorder(dest.stream, { mimeType: RECORD_MIME });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start();

  // Start the session: arc patches render their opening with the arc engaged.
  if (state.sessionMode === 'arc') {
    orch.startSession(
      { mode: 'arc', arcId: state.arcId, durationSec: state.arcDurationSec },
      (p) => useParamStore.getState().setMany(p),
    );
  } else {
    orch.startSession({ mode: 'open' });
  }

  await new Promise((r) => setTimeout(r, opts.durationSec * 1000));

  recorder.stop();
  await stopped;
  await orch.dispose();

  const blob = new Blob(chunks, { type: RECORD_MIME });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { b64: bytesToBase64(bytes), mime: RECORD_MIME };
}

window.__annealRender = render;
