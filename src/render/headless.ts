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
import { makeDefaultLoopConfig, type SlotId } from '@/loop/types';
import { PiecePlayer } from '@/piece/PiecePlayer';
import { hashStringToInt } from '@/piece/resolver';
import type { Piece } from '@/piece/types';
import type { AnnealMusicParams } from '@/state/params';
import { DEFAULT_PARAMS } from '@/state/params';
import { renderStemsOffline } from '@/export/StemRenderer';
import type {
  EngineId,
  EngineParams,
  SharedParams,
} from '@/audio/engines/types';
import { CanvasRenderer } from '@/visual/canvas/CanvasRenderer';
import { HARMONICS } from '@/types/audio';
import { SLOT_IDS } from '@/loop/types';
import { readRms } from '@/input/meter';
import type { VisualState, LoopRing, VisualRenderer } from '@/visual/types';

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
    __annealStemsRender: (
      payload: string,
      opts: any,
    ) => Promise<Record<string, string>>;
    __annealVideoRender: (payload: string, opts: any) => Promise<RenderResult>;
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

interface VideoRenderOptions {
  durationSec: number;
  width?: number;
  height?: number;
  fps?: number;
  videoBitrate?: number;
  captureUrls?: string[];
  previewSliceStartMs?: number;
  isCalm?: boolean;
}

async function videoRender(
  payload: string,
  opts: VideoRenderOptions,
): Promise<RenderResult> {
  const width = opts.width || 1920;
  const height = opts.height || 1080;
  const fps = opts.fps || 30;
  const videoBitrate = opts.videoBitrate || 5000000;
  const isCalm = opts.isCalm || false;

  // Hydrate the store exactly as the client does on load.
  useParamStore.getState().reset();
  const decoded = decodeState(SCHEMA_VERSION, payload);

  let customRatios: number[] | undefined;
  let customEq: number | undefined;
  let initialSharedParams: SharedParams;
  let orch: Orchestrator;
  let player: PiecePlayer | null = null;

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

    initialSharedParams = {
      ...(piece.defaultsState.params as unknown as AnnealMusicParams),
      tuning: pieceTuning,
      customScaleRatios: pieceCustomRatios,
      customEqRatio: pieceCustomEq,
    };

    orch = new Orchestrator(
      initialSharedParams,
      piece.defaultsState.engineId,
      piece.defaultsState.engineParams as unknown as Partial<
        Record<EngineId, EngineParams>
      >,
      undefined,
      piece.defaultsState.loops,
    );
  } else {
    applyDecodedToStore(decoded);
    const state = useParamStore.getState();

    if (state.tuning.system === 'custom' && state.tuning.sclId) {
      const customScale = state.customScales.find(
        (s) => s.id === state.tuning.sclId,
      );
      if (customScale) {
        customRatios = customScale.parsed_scale;
        customEq =
          customScale.parsed_scale[customScale.parsed_scale.length - 1];
      }
    }

    initialSharedParams = {
      ...state.params,
      tuning: state.tuning,
      customScaleRatios: customRatios,
      customEqRatio: customEq,
    };

    orch = new Orchestrator(
      initialSharedParams,
      state.engineId,
      state.engineParams,
      undefined,
      state.loops,
    );
  }

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

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.position = 'fixed';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.zIndex = '99999';
  canvas.style.background = '#0c0a09';
  document.body.appendChild(canvas);

  const renderer: VisualRenderer = new CanvasRenderer();
  renderer.mount(canvas);
  renderer.resize(width, height, 1);

  const canvasStream = canvas.captureStream(fps);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const VIDEO_MIME = 'video/webm;codecs=vp9,opus';
  const recorder = new MediaRecorder(combinedStream, {
    mimeType: VIDEO_MIME,
    videoBitsPerSecond: videoBitrate,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  let rafId = 0;
  const phases: number[] = HARMONICS.map(() => Math.random() * Math.PI * 2);
  let lastT = performance.now();

  const drawLoop = (now: number) => {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    let spectrum: Uint8Array<ArrayBuffer> | null = null;
    let fftSize = 1024;
    let sampleRate = orch.getSampleRate();
    const liveAnalyser = orch.getAnalyser();
    if (liveAnalyser) {
      spectrum = new Uint8Array(
        liveAnalyser.frequencyBinCount,
      ) as unknown as Uint8Array<ArrayBuffer>;
      liveAnalyser.getByteFrequencyData(spectrum);
      fftSize = liveAnalyser.fftSize;
      sampleRate = liveAnalyser.context.sampleRate;
    }

    const loops: LoopRing[] = [];
    SLOT_IDS.forEach((id, slot) => {
      const loopSlot = orch.getLoopSlot(id);
      if (!loopSlot) return;
      const st = loopSlot.getState();
      if (st !== 'playing' && st !== 'frozen') return;
      loops.push({
        slot,
        level: Math.min(1, readRms(loopSlot.getAnalyser()) * 1.4),
        frozen: st === 'frozen',
      });
    });

    const params = useParamStore.getState().params;
    const engineFreqs = orch.getPartialFrequencies() ?? [];
    const count = engineFreqs.length || params.density;
    const freqs: number[] = [];
    for (let i = 0; i < count; i++) {
      const ratio = HARMONICS[i] ?? 1;
      freqs.push(engineFreqs[i] ?? params.rootFreq * ratio);
    }

    const r = orch.getOrderParameter() ?? 0;

    const visualState: VisualState = {
      w: width,
      h: height,
      dt,
      phases,
      freqs,
      count,
      spectrum,
      sampleRate,
      fftSize,
      loops,
      isCalm,
      r,
    };

    renderer.drawFrame(visualState, now);
    rafId = requestAnimationFrame(drawLoop);
  };

  recorder.start();
  rafId = requestAnimationFrame(drawLoop);

  if (decoded.kind === 'piece') {
    player = new PiecePlayer(decoded.piece as unknown as Piece, orch);
    if (opts.previewSliceStartMs && opts.previewSliceStartMs > 0) {
      player.seek(opts.previewSliceStartMs);
    }
    player.start();
  } else {
    const state = useParamStore.getState();
    if (state.sessionMode === 'arc') {
      orch.startSession(
        { mode: 'arc', arcId: state.arcId, durationSec: state.arcDurationSec },
        (p) => useParamStore.getState().setMany(p),
      );
    } else {
      orch.startSession({ mode: 'open' });
    }
  }

  await new Promise((r) => setTimeout(r, opts.durationSec * 1000));

  if (player) {
    player.stop();
  }
  cancelAnimationFrame(rafId);
  renderer.dispose();
  canvas.remove();

  recorder.stop();
  await stopped;
  await orch.dispose();

  const blob = new Blob(chunks, { type: VIDEO_MIME });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { b64: bytesToBase64(bytes), mime: VIDEO_MIME };
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
window.__annealVideoRender = videoRender;

async function stemsRender(
  payload: string,
  opts: any,
): Promise<Record<string, string>> {
  const decoded = decodeState(SCHEMA_VERSION, payload);

  let config: any;
  if (decoded.kind === 'piece') {
    const defaults = decoded.piece.defaultsState;
    config = {
      params: { ...DEFAULT_PARAMS, ...defaults.params },
      engineId: defaults.engineId,
      engineParams: defaults.engineParams[defaults.engineId] ?? {},
      loopConfig: defaults.loops,
      loopBuffers: { A: null, B: null, C: null },
      loopStates: {
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
      },
      mode: 'piece',
      piece: decoded.piece,
      durationSec: opts.durationSec,
      sampleRate: opts.sampleRate ?? 48000,
      bitDepth: opts.bitDepth ?? 24,
      includeFx: opts.withFx ?? true,
      includePartials: opts.perPartial ?? false,
      seed: opts.seed ?? 42,
      patchTitle: decoded.piece.title ?? 'Piece',
      patchHash: 'headless',
    };
  } else if (decoded.kind === 'listening-session') {
    const ls = decoded.listeningSession;
    const dummyPiece = opts.piece ?? {
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
        { type: 'open', durationMs: opts.durationSec * 1000, config: {} },
      ],
    };
    const defaults = dummyPiece.defaultsState;
    config = {
      params: { ...DEFAULT_PARAMS, ...defaults.params },
      engineId: defaults.engineId,
      engineParams: defaults.engineParams[defaults.engineId] ?? {},
      loopConfig: defaults.loops,
      loopBuffers: { A: null, B: null, C: null },
      loopStates: {
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
      },
      mode: 'listening-session',
      piece: dummyPiece,
      listeningSession: {
        settleInMs: ls.settleInMs,
        integrationMs: ls.integrationMs,
        bellSchedule: ls.bellSchedule,
      },
      durationSec: opts.durationSec,
      sampleRate: opts.sampleRate ?? 48000,
      bitDepth: opts.bitDepth ?? 24,
      includeFx: opts.withFx ?? true,
      includePartials: opts.perPartial ?? false,
      seed: opts.seed ?? 42,
      patchTitle: ls.title ?? 'Listening Session',
      patchHash: 'headless',
    };
  } else if (decoded.kind === 'sonification') {
    const son = decoded.sonification;
    config = {
      params: DEFAULT_PARAMS,
      engineId: 'sine' as const,
      engineParams: {},
      loopConfig: makeDefaultLoopConfig(),
      loopBuffers: { A: null, B: null, C: null },
      loopStates: { A: 'empty', B: 'empty', C: 'empty' },
      mode: 'sonification' as const,
      sonificationSpec: son.mappingSpec,
      durationSec: opts.durationSec,
      sampleRate: opts.sampleRate ?? 48000,
      bitDepth: opts.bitDepth ?? 24,
      includeFx: opts.withFx ?? true,
      includePartials: opts.perPartial ?? false,
      seed: opts.seed ?? 42,
      patchTitle: son.title ?? 'Sonification',
      patchHash: 'headless',
    };
  } else {
    config = {
      params: { ...DEFAULT_PARAMS, ...decoded.params },
      engineId: decoded.engineId,
      engineParams: decoded.engineParams[decoded.engineId] ?? {},
      loopConfig: decoded.loops,
      loopBuffers: { A: null, B: null, C: null },
      loopStates: {
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
      },
      mode: decoded.mode,
      arcId: decoded.arcId,
      durationSec: opts.durationSec,
      sampleRate: opts.sampleRate ?? 48000,
      bitDepth: opts.bitDepth ?? 24,
      includeFx: opts.withFx ?? true,
      includePartials: opts.perPartial ?? false,
      seed: opts.seed ?? 42,
      patchTitle: 'CLI Render',
      patchHash: 'headless',
    };
  }

  const results = await renderStemsOffline(config, () => {}, {
    aborted: false,
  });

  const b64Results: Record<string, string> = {};
  for (const [key, buffer] of Object.entries(results)) {
    b64Results[key] = bytesToBase64(new Uint8Array(buffer));
  }
  return b64Results;
}

window.__annealStemsRender = stemsRender;
