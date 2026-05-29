import type { Orchestrator } from '@/audio/orchestrator';
import { getActiveStems, type StemDef } from './StemTaps';
import { createWorkletCapture, type CaptureController } from '@/loop/capture';
import { encodeWav } from './WavEncoder';

export interface RealtimeCaptureConfig {
  orchestrator: Orchestrator;
  includePartials: boolean;
  maxSeconds: number;
  sampleRate: number;
  bitDepth: 24 | 32;
  patchTitle: string;
  patchHash: string;
}

export interface RealtimeCaptureHandles {
  stop(): Promise<Record<string, ArrayBuffer>>;
  cancel(): void;
}

/**
 * Initiates parallel, real-time capture for active raw stems (excluding -fx stems)
 * routed synchronously to AudioWorklet PCM capture accumulators.
 */
export async function startRealtimeCapture(
  config: RealtimeCaptureConfig,
): Promise<RealtimeCaptureHandles> {
  const { orchestrator } = config;
  const tapInfo = orchestrator.getRecordingTap();
  if (!tapInfo) {
    throw new Error('Live audio core is not active.');
  }

  const { ctx } = tapInfo;

  // Realtime stems exclude -fx stems because we cannot isolate post-fx signals in real time
  const stems = getActiveStems(orchestrator, {
    includeFx: false,
    includePartials: config.includePartials,
  });

  const controllers: Record<
    string,
    { controller: CaptureController; stem: StemDef }
  > = {};

  try {
    for (const stem of stems) {
      let node: AudioNode | null = null;

      if (stem.type === 'master') {
        node = orchestrator.getRecordingTap()?.node ?? null;
      } else if (stem.type === 'engine') {
        node = orchestrator.getActiveEngine()?.getOutputNode() ?? null;
      } else if (stem.type === 'partial') {
        const engine = orchestrator.getActiveEngine();
        if (engine && engine.getPartialOutputs) {
          node = engine.getPartialOutputs()[stem.partialIndex!] ?? null;
        }
      } else if (stem.type === 'input') {
        node = orchestrator.getInputVoice()?.getCaptureTap() ?? null;
      } else if (stem.type === 'loop') {
        node = orchestrator.getLoopSlot(stem.slotId!)?.getAnalyser() ?? null;
      }

      if (node) {
        const controller = await createWorkletCapture(ctx, node, {
          maxSeconds: config.maxSeconds,
        });
        controllers[stem.id] = { controller, stem };
      }
    }
  } catch (err) {
    // Dispose any that successfully started
    for (const item of Object.values(controllers)) {
      item.controller.dispose();
    }
    throw err;
  }

  return {
    async stop(): Promise<Record<string, ArrayBuffer>> {
      const results: Record<string, ArrayBuffer> = {};
      const stopPromises = Object.entries(controllers).map(
        async ([stemId, item]) => {
          const buffer = await item.controller.stop();
          if (buffer) {
            results[stemId] = encodeWav(buffer, {
              bitDepth: config.bitDepth,
              stemName: item.stem.id,
              label: item.stem.label,
              patchTitle: config.patchTitle,
              patchHash: config.patchHash,
              engineType: orchestrator.getEngineId(),
              partialIndex: item.stem.partialIndex,
            });
          }
        },
      );
      await Promise.all(stopPromises);
      return results;
    },
    cancel() {
      for (const item of Object.values(controllers)) {
        item.controller.dispose();
      }
    },
  };
}
