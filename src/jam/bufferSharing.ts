import { api } from '@/api/client';
import { loopSlotsMap, doc } from './crdt';
import type { SlotId } from '@/loop/types';
import type { Orchestrator } from '@/audio/orchestrator';
import { encodeWav } from '@/api/wav';
import * as Y from 'yjs';

// Cache loaded captures to prevent duplicates
const loadedCaptureIds: Record<SlotId, string | null> = {
  A: null,
  B: null,
  C: null,
};

let bufferSharingCleanup: (() => void) | null = null;

export function startBufferSharing(
  ensureOrchestrator: () => Orchestrator,
  showToast?: (msg: string) => void,
) {
  if (bufferSharingCleanup) {
    bufferSharingCleanup();
  }

  console.log('[Jam] Starting loop buffer sharing observer...');

  const handleLoopSlotsChange = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loopSlotsMap.forEach((slotMap: any, slotIdRaw: string) => {
      const slotId = slotIdRaw as SlotId;
      if (!(slotMap instanceof Y.Map)) return;

      const captureId = slotMap.get('captureId');

      if (captureId && captureId !== loadedCaptureIds[slotId]) {
        console.log(
          `[Jam] Remote capture detected for Slot ${slotId}: ${captureId}`,
        );
        loadedCaptureIds[slotId] = captureId;

        if (showToast) {
          showToast(`Loading loop ${slotId} from partner...`);
        }

        // Fetch binary WAV blob from backend captures storage
        api
          .fetchCaptureBytes(captureId)
          .then(async (bytes) => {
            const orch = ensureOrchestrator();
            // Decode WAV bytes using browser AudioContext
            const buffer = await orch.decodeAudio(bytes);
            orch.loadLoopBuffer(slotId, buffer);
            console.log(
              `[Jam] Hydrated Slot ${slotId} with remote loop buffer.`,
            );
            if (showToast) {
              showToast(`Loop ${slotId} loaded`);
            }
          })
          .catch((err) => {
            console.error(
              `[Jam] Error hydrating remote buffer for Slot ${slotId}:`,
              err,
            );
            if (showToast) {
              showToast(`Failed to load loop ${slotId}`);
            }
          });
      }
    });
  };

  loopSlotsMap.observe(handleLoopSlotsChange);

  // Return cleanup function
  bufferSharingCleanup = () => {
    loopSlotsMap.unobserve(handleLoopSlotsChange);
    bufferSharingCleanup = null;
  };

  return bufferSharingCleanup;
}

export async function shareLocalCapture(
  slotId: SlotId,
  buffer: AudioBuffer,
  showToast?: (msg: string) => void,
) {
  try {
    console.log(`[Jam] Uploading newly captured loop for Slot ${slotId}...`);
    if (showToast) {
      showToast(`Sharing loop ${slotId} with partner...`);
    }

    // 1. Encode Web Audio buffer to standard PCM WAV bytes
    const wavBlob = encodeWav(buffer);

    // 2. Upload WAV blob to S3 storage via API
    const capture = await api.uploadCapture(wavBlob);

    console.log(`[Jam] Capture uploaded. Reference ID: ${capture.id}`);
    loadedCaptureIds[slotId] = capture.id;

    // 3. Write reference ID into Yjs CRDT Loop slot map
    let slotMap = loopSlotsMap.get(slotId);
    if (!slotMap) {
      doc.transact(() => {
        const newMap = new Y.Map();
        loopSlotsMap.set(slotId, newMap);
        slotMap = newMap;
      });
    }

    if (slotMap) {
      doc.transact(() => {
        slotMap!.set('captureId', capture.id);
      });
    }

    if (showToast) {
      showToast(`Loop ${slotId} shared`);
    }
  } catch (err) {
    console.error(
      `[Jam] Failed to share loop capture for Slot ${slotId}:`,
      err,
    );
    if (showToast) {
      showToast(`Failed to share loop ${slotId}`);
    }
  }
}
