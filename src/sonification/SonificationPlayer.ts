import { useParamStore, type ParamKey } from '@/state/params';
import type { EngineId } from '@/audio/engines/types';
import type { Orchestrator } from '@/audio/orchestrator';
import type { MappingSpec } from './types';
import { applyTransform } from './transforms';
import { FileSourceAdapter } from './sources/fileSource';
import { SyntheticSourceAdapter } from './sources/syntheticSource';
import { LiveSourceAdapter } from './sources/liveSource';
import { BiosignalSourceAdapter } from './sources/biosignalSource';

export class SonificationPlayer {
  spec: MappingSpec;
  durationSec: number;
  playbackSpeed: number;
  loop: boolean;

  private adapters: Map<
    string,
    | FileSourceAdapter
    | SyntheticSourceAdapter
    | LiveSourceAdapter
    | BiosignalSourceAdapter
  > = new Map();
  private elapsedSec = 0;
  private isPlaying = false;
  private lastFrameTime = 0;
  private rafId: number | null = null;
  private onTickCallback?: (elapsed: number) => void;

  constructor(
    spec: MappingSpec,
    durationMs = 10000,
    playbackSpeed = 1.0,
    loop = true,
  ) {
    this.spec = spec;
    this.durationSec = durationMs / 1000;
    this.playbackSpeed = playbackSpeed;
    this.loop = loop;
    this.initializeAdapters();
  }

  private initializeAdapters() {
    for (const src of this.spec.sources) {
      if (src.type === 'file') {
        this.adapters.set(src.id, new FileSourceAdapter(src));
      } else if (src.type === 'synthetic') {
        this.adapters.set(src.id, new SyntheticSourceAdapter(src));
      } else if (src.type === 'live') {
        const liveAdapter = new LiveSourceAdapter(src);
        this.adapters.set(src.id, liveAdapter);
        liveAdapter.connect();
      } else if (src.type === 'live-biosignal') {
        this.adapters.set(src.id, new BiosignalSourceAdapter(src));
      }
    }
  }

  getAdapter(sourceId: string) {
    return this.adapters.get(sourceId);
  }

  destroy() {
    this.stop();
    for (const adapter of this.adapters.values()) {
      if (adapter instanceof LiveSourceAdapter) {
        adapter.disconnect();
      }
    }
  }

  /**
   * Resolves parameter frames for a given playback time t (seconds).
   */
  resolveStateAt(t: number): {
    params: Partial<Record<ParamKey, number>>;
    engineParams: Record<string, Partial<Record<string, number | string>>>;
  } {
    const params: Partial<Record<ParamKey, number>> = {};
    const engineParams: Record<
      string,
      Partial<Record<string, number | string>>
    > = {};

    for (const rule of this.spec.rules) {
      const adapter = this.adapters.get(rule.sourceId);
      if (!adapter) continue;

      const rawVal = adapter.getValueAt(rule.column, t);
      const mappedVal = applyTransform(rawVal, rule.transform);

      if (rule.targetType === 'param') {
        params[rule.targetKey as ParamKey] = mappedVal;
      } else if (rule.targetType === 'engineParam') {
        // targetKey format: "engineId.paramKey" e.g. "bell.decay"
        const parts = rule.targetKey.split('.');
        if (parts.length === 2) {
          const [engineId, paramKey] = parts;
          if (engineId && paramKey) {
            if (!engineParams[engineId]) {
              engineParams[engineId] = {};
            }
            const eParams = engineParams[engineId];
            if (eParams) {
              eParams[paramKey] = mappedVal;
            }
          }
        }
      }
    }

    return { params, engineParams };
  }

  start(orch: Orchestrator | null, onTick?: (elapsed: number) => void) {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastFrameTime = performance.now();
    this.onTickCallback = onTick;

    const tick = (now: number) => {
      if (!this.isPlaying) return;
      const deltaSec = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;

      // Update elapsed time
      this.elapsedSec += deltaSec * this.playbackSpeed;

      if (this.durationSec > 0 && this.elapsedSec >= this.durationSec) {
        if (this.loop) {
          this.elapsedSec = this.elapsedSec % this.durationSec;
        } else {
          this.elapsedSec = this.durationSec;
          this.isPlaying = false;
        }
      }

      // Apply updates to ParamStore and Orchestrator
      const { params, engineParams } = this.resolveStateAt(this.elapsedSec);

      // 1. Update Zustand store so UI sliders reflect playback
      const paramStore = useParamStore.getState();
      if (Object.keys(params).length > 0) {
        paramStore.setMany(params);
      }
      for (const [engineId, p] of Object.entries(engineParams)) {
        for (const [k, v] of Object.entries(p)) {
          if (v !== undefined) {
            paramStore.setEngineParam(engineId as EngineId, k, v);
          }
        }
      }

      // 2. Drive the active audio engine directly
      if (orch) {
        if (Object.keys(params).length > 0) {
          orch.setSharedParams(params, true);
        }
        for (const [engineId, p] of Object.entries(engineParams)) {
          // If the engine matches the current active engine, apply immediately
          if (engineId === paramStore.engineId) {
            const updates: Record<string, number | string> = {};
            for (const [k, v] of Object.entries(p)) {
              if (v !== undefined) {
                updates[k] = v;
              }
            }
            orch.setEngineParams(updates);
          }
        }
      }

      if (this.onTickCallback) {
        this.onTickCallback(this.elapsedSec);
      }

      if (this.isPlaying) {
        this.rafId = requestAnimationFrame(tick);
      }
    };

    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    this.isPlaying = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  seek(t: number, orch: Orchestrator | null) {
    this.elapsedSec = Math.max(0, Math.min(this.durationSec, t));
    const { params, engineParams } = this.resolveStateAt(this.elapsedSec);

    const paramStore = useParamStore.getState();
    if (Object.keys(params).length > 0) {
      paramStore.setMany(params);
    }
    for (const [engineId, p] of Object.entries(engineParams)) {
      for (const [k, v] of Object.entries(p)) {
        if (v !== undefined) {
          paramStore.setEngineParam(engineId as EngineId, k, v);
        }
      }
    }

    if (orch) {
      if (Object.keys(params).length > 0) {
        orch.setSharedParams(params, true);
      }
      for (const [engineId, p] of Object.entries(engineParams)) {
        if (engineId === paramStore.engineId) {
          const updates: Record<string, number | string> = {};
          for (const [k, v] of Object.entries(p)) {
            if (v !== undefined) {
              updates[k] = v;
            }
          }
          orch.setEngineParams(updates);
        }
      }
    }

    if (this.onTickCallback) {
      this.onTickCallback(this.elapsedSec);
    }
  }

  getElapsed() {
    return this.elapsedSec;
  }

  getIsPlaying() {
    return this.isPlaying;
  }
}
