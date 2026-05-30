import { useCallback, useRef, useState } from 'react';
import { api } from '@/api/client';

/**
 * v4.5 — logs a Listening Session play to the user's private history.
 *
 * Calm-by-design: history exists for the user's own reference. We log a play on
 * start and finalize it (with the *actual* duration listened) on completion or
 * when the user ends mid-session. Anonymous users are never logged — instead
 * they see a single gentle "sign in to keep your history" nudge afterwards.
 *
 * Finalization is idempotent: whichever of completion / stop / unmount fires
 * first wins, and later calls are ignored.
 */
export function usePlayLogger(
  listeningSessionId: string,
  isAuthenticated: boolean,
) {
  const playIdRef = useRef<string | null>(null);
  const finalizedRef = useRef(false);
  const [showNudge, setShowNudge] = useState(false);

  const onStart = useCallback(() => {
    finalizedRef.current = false;
    playIdRef.current = null;
    if (!isAuthenticated || !api.isBackendConfigured()) return;
    void api
      .logSessionPlay({ listening_session_id: listeningSessionId })
      .then((play) => {
        playIdRef.current = play.id;
      })
      .catch(() => {
        // History is best-effort; a failed log never interrupts the practice.
        playIdRef.current = null;
      });
  }, [listeningSessionId, isAuthenticated]);

  const onEnd = useCallback(
    (durationListenedMs: number) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;

      if (!isAuthenticated) {
        // A single, dismissible prompt — never recurring, never a guilt nudge.
        if (durationListenedMs > 0) setShowNudge(true);
        return;
      }
      const id = playIdRef.current;
      if (!id || !api.isBackendConfigured()) return;
      void api
        .updateSessionPlay(id, {
          completed_at: new Date().toISOString(),
          duration_listened_ms: Math.max(0, Math.round(durationListenedMs)),
        })
        .catch(() => {
          /* best-effort */
        });
    },
    [isAuthenticated],
  );

  const dismissNudge = useCallback(() => setShowNudge(false), []);

  return { onStart, onEnd, showNudge, dismissNudge };
}
