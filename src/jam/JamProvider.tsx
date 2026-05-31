import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { api } from '@/api/client';
import type { JamSession, JamParticipant, Patch } from '@/api/types';
import {
  connectSession,
  disconnectSession,
  type TransportState,
} from './transport';
import { getAnonId } from '@/api/anon';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useParamStore } from '@/state/params';
import { encodeState } from '@/share/encode';

export interface JamContextType {
  session: JamSession | null;
  participants: JamParticipant[];
  status: 'connecting' | 'connected' | 'failed' | 'disconnected';
  mode: 'webrtc' | 'websocket' | 'none';
  myColor: string | null;
  activeCursors: Record<
    string,
    { paramKey: string; color: string; name: string; ts: number }
  >;
  startJam: () => Promise<void>;
  joinJam: (id: string) => Promise<void>;
  leaveJam: () => Promise<void>;
  updateCursorPresence: (paramKey: string) => void;
  clearCursorPresence: () => void;
  saveJamPatch: (opts: {
    title?: string;
    description?: string;
    visibility?: 'unlisted' | 'public';
  }) => Promise<Patch | null>;
}

const JamContext = createContext<JamContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useJam = () => {
  const context = useContext(JamContext);
  return context;
};

export const JamProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<JamSession | null>(null);
  const [participants, setParticipants] = useState<JamParticipant[]>([]);
  const [status, setStatus] =
    useState<TransportState['status']>('disconnected');
  const [mode, setMode] = useState<TransportState['mode']>('none');
  const [myColor, setMyColor] = useState<string | null>(null);
  const [activeCursors, setActiveCursors] = useState<
    JamContextType['activeCursors']
  >({});
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  // Load participants metadata from DB
  const refreshParticipants = useCallback(async (sessionId: string) => {
    try {
      const details = await api.getJamSession(sessionId);
      setParticipants(details.participants);
    } catch (err) {
      console.warn('[Jam] Error fetching participant details:', err);
    }
  }, []);

  const handleStateChange = useCallback((transportState: TransportState) => {
    setStatus(transportState.status);
    setMode(transportState.mode);
  }, []);

  // Connect/Reconnect transport logic
  const reconnectTransport = useCallback(
    (sessId: string, url: string) => {
      connectSession(sessId, url, handleStateChange);
    },
    [handleStateChange],
  );

  const startJam = async () => {
    try {
      console.log('[Jam] Starting collaborative jam...');
      const detail = await api.createJamSession();

      const hostPart = detail.participants.find(
        (p) => p.user_id === getAnonId(),
      );
      setMyColor(hostPart?.color || '#3B82F6');
      setSession(detail.session);
      setParticipants(detail.participants);
      setWsUrl(detail.ws_url);

      const { initializeCrdtSync } = await import('./crdt');
      initializeCrdtSync();
      connectSession(detail.session.id, detail.ws_url, handleStateChange);
    } catch (err) {
      console.error('[Jam] Failed to start jam session:', err);
      setStatus('failed');
      throw err;
    }
  };

  const joinJam = async (id: string) => {
    try {
      console.log('[Jam] Joining jam session:', id);
      const joinDetail = await api.joinJamSession(id);
      setMyColor(joinDetail.color);
      setWsUrl(joinDetail.ws_url);

      const detail = await api.getJamSession(id);
      setSession(detail.session);
      setParticipants(detail.participants);

      const { initializeCrdtSync } = await import('./crdt');
      initializeCrdtSync();
      connectSession(id, joinDetail.ws_url, handleStateChange);
    } catch (err) {
      console.error('[Jam] Failed to join jam session:', err);
      setStatus('failed');
      throw err;
    }
  };

  const leaveJam = async () => {
    if (!session) return;
    try {
      console.log('[Jam] Leaving active jam session:', session.id);
      // Clean up remote presence before leaving
      const myId = getAnonId();
      if (myId) {
        const { doc, presenceMap } = await import('./crdt');
        doc.transact(() => {
          presenceMap.delete(myId);
        });
      }

      await api.leaveJamSession(session.id);
    } catch (err) {
      console.warn('[Jam] Error during leave API call:', err);
    } finally {
      disconnectSession();
      setSession(null);
      setParticipants([]);
      setStatus('disconnected');
      setMode('none');
      setMyColor(null);
      setActiveCursors({});
      setWsUrl(null);
    }
  };

  const updateCursorPresence = async (paramKey: string) => {
    const myId = getAnonId();
    if (!session || !myId || !myColor) return;

    const { doc, presenceMap } = await import('./crdt');
    doc.transact(() => {
      presenceMap.set(myId, {
        paramKey,
        color: myColor,
        name:
          participants.find((p) => p.user_id === myId)?.display_name ||
          'A user',
        ts: Date.now(),
      });
    });
  };

  const clearCursorPresence = async () => {
    const myId = getAnonId();
    if (!session || !myId) return;

    const { doc, presenceMap } = await import('./crdt');
    doc.transact(() => {
      presenceMap.delete(myId);
    });
  };

  const saveJamPatch = async (opts: {
    title?: string;
    description?: string;
    visibility?: 'unlisted' | 'public';
  }) => {
    if (!session) return null;
    try {
      // Build the URL payload similar to standard savePatch
      const state = getParamStoreStatePayload();
      const patch = await api.saveSharedPatch(session.id, {
        state,
        schema_ver: 7, // v1.8 schema version
        title: opts.title,
        description: opts.description,
        visibility: opts.visibility || 'unlisted',
      });
      return patch;
    } catch (err) {
      console.error('[Jam] Error saving collaborative patch:', err);
      throw err;
    }
  };

  // Helper to construct the current Zustand state URL payload
  const getParamStoreStatePayload = (): string => {
    const s = useParamStore.getState();
    return encodeState(
      s.params,
      s.engineId,
      s.engineParams[s.engineId] ?? {},
      { mode: s.sessionMode, arcId: s.arcId, durationSec: s.arcDurationSec },
      s.loops,
    );
  };

  // Observe presence updates on the Yjs presenceMap
  useEffect(() => {
    if (!session) return;

    let active = true;
    let cleanupFn: (() => void) | null = null;

    import('./crdt').then(({ presenceMap }) => {
      if (!active) return;

      const handlePresenceChange = () => {
        const currentCursors: JamContextType['activeCursors'] = {};
        const now = Date.now();
        const myId = getAnonId();

        presenceMap.forEach(
          (
            val: { paramKey: string; color: string; name: string; ts: number },
            userId: string,
          ) => {
            if (userId === myId) return; // skip self
            // Filter out expired presence updates (> 5 seconds old)
            if (val && now - val.ts < 5000) {
              currentCursors[userId] = val;
            }
          },
        );
        setActiveCursors(currentCursors);
      };

      presenceMap.observe(handlePresenceChange);

      // Periodically clear expired cursors locally
      const interval = setInterval(handlePresenceChange, 2000);

      cleanupFn = () => {
        presenceMap.unobserve(handlePresenceChange);
        clearInterval(interval);
      };
    });

    return () => {
      active = false;
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, [session]);

  // Handle mobile reconnect on app resume/visibility change
  useEffect(() => {
    if (!session || !wsUrl) return;

    const handleResume = () => {
      console.log(
        '[Jam] Foreground resume detected. Reconnecting session transport...',
      );
      reconnectTransport(session.id, wsUrl);
      refreshParticipants(session.id);
    };

    // 1. Web browser visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleResume();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 2. Capacitor native app resume
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capacitorListener: any = null;
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', (state) => {
        if (state.isActive) {
          handleResume();
        }
      }).then((l) => {
        capacitorListener = l;
      });
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (capacitorListener) {
        capacitorListener.remove();
      }
    };
  }, [session, wsUrl, reconnectTransport, refreshParticipants]);

  return (
    <JamContext.Provider
      value={{
        session,
        participants,
        status,
        mode,
        myColor,
        activeCursors,
        startJam,
        joinJam,
        leaveJam,
        updateCursorPresence,
        clearCursorPresence,
        saveJamPatch,
      }}
    >
      {children}
    </JamContext.Provider>
  );
};
