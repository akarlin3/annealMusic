import { useCallback, useEffect, useRef, useState } from 'react';
import type { Orchestrator } from '@/audio/orchestrator';
import {
  startRealtimeRecording,
  isOpusSupported,
  type RealtimeRecording,
  type RecordingFormat,
  type RecorderHandles,
} from '@/record/RealtimeRecorder';

export type RecorderState = 'idle' | 'recording' | 'saving';

export interface RecorderApi {
  state: RecorderState;
  /** Elapsed seconds while recording (0 otherwise). */
  elapsedSec: number;
  /** A finished recording awaiting the save dialog (null when none). */
  pending: RealtimeRecording | null;
  start: (format: RecordingFormat) => Promise<void>;
  stop: () => Promise<void>;
  /** Discard the pending recording without saving. */
  discardPending: () => void;
  opusSupported: boolean;
}

/**
 * React glue for realtime session capture. Taps the orchestrator's post-fx
 * master output; on stop, surfaces the finished blob as `pending` so the UI can
 * open the save dialog. Requires sound to be flowing (a session or live input) —
 * otherwise the tap is unavailable and `start` toasts a hint.
 */
export function useRecorder(
  ensureOrchestrator: () => Orchestrator,
  showToast: (msg: string) => void,
): RecorderApi {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [pending, setPending] = useState<RealtimeRecording | null>(null);
  const handlesRef = useRef<RecorderHandles | null>(null);

  const start = useCallback(
    async (format: RecordingFormat) => {
      if (state !== 'idle') return;
      const orch = ensureOrchestrator();
      const tap = orch.getRecordingTap();
      if (!tap) {
        showToast('Start playing before recording');
        return;
      }
      if (format === 'opus' && !isOpusSupported()) {
        showToast('Opus not supported here — recording WAV');
        format = 'wav';
      }
      try {
        const handles = await startRealtimeRecording(tap.ctx, tap.node, {
          format,
          onTick: setElapsedSec,
          onWarn: () => showToast('Recording reaches its 60-minute cap soon'),
          onAutoStop: (rec) => {
            handlesRef.current = null;
            setState('idle');
            setElapsedSec(0);
            if (rec) setPending(rec);
            showToast('Recording stopped at the 60-minute cap');
          },
        });
        handlesRef.current = handles;
        setElapsedSec(0);
        setState('recording');
      } catch {
        showToast('Could not start recording on this device');
      }
    },
    [state, ensureOrchestrator, showToast],
  );

  const stop = useCallback(async () => {
    const handles = handlesRef.current;
    if (!handles || state !== 'recording') return;
    handlesRef.current = null;
    setState('saving');
    const rec = await handles.stop();
    setState('idle');
    setElapsedSec(0);
    if (rec) setPending(rec);
    else showToast('Nothing was recorded');
  }, [state, showToast]);

  const discardPending = useCallback(() => setPending(null), []);

  // Cancel an in-flight recording on unmount.
  useEffect(
    () => () => {
      handlesRef.current?.cancel();
      handlesRef.current = null;
    },
    [],
  );

  return {
    state,
    elapsedSec,
    pending,
    start,
    stop,
    discardPending,
    opusSupported: isOpusSupported(),
  };
}
