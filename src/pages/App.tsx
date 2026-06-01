import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pause, Play } from 'lucide-react';
import { useAnnealMusic } from '@/hooks/useAnnealMusic';
import { useInput } from '@/hooks/useInput';
import { useLoops } from '@/hooks/useLoops';
import { useParamStore } from '@/state/params';
import { SLOT_IDS } from '@/loop/types';
import { getArcById } from '@/session/arcs';
import { readStateFromHash, subscribeStoreToHash } from '@/share/url';
import { applyDecodedToStore } from '@/share/hydrate';
import Visualizer from '@/components/Visualizer';
import ControlPanel from '@/components/ControlPanel';
import InputPanel from '@/components/InputPanel';
import LoopPedal from '@/components/LoopPedal';
import EngineSelector from '@/components/EngineSelector';

import SessionModeToggle from '@/components/SessionModeToggle';
import FirstTimeBanner from '@/components/FirstTimeBanner';
import DroneView from '@/drone/DroneView';
import { Header } from '@/components/Header';
import { useMode } from '@/mode/useMode';
import { FirstTimeModePicker } from '@/mode/FirstTimeModePicker';
import ArcPanel from '@/components/ArcPanel';
import PresetsPanel from '@/components/PresetsPanel';
import CopyLinkButton from '@/components/CopyLinkButton';
import SavePatchButton from '@/components/SavePatchButton';
import GeneratePatchDialog from '@/components/GeneratePatchDialog';
import SimilarPatchesRow from '@/components/SimilarPatchesRow';
import MyPatchesDrawer from '@/components/MyPatchesDrawer';
import Toast, { type ToastMessage } from '@/components/Toast';
import { api } from '@/api/client';
import type { Patch } from '@/api/types';
import { usePatches } from '@/api/usePatches';

import LoginDialog from '@/components/LoginDialog';
import { ConsentDialog } from '@/observability/consentDialog';
import {
  initializeErrorReporter,
  reportError,
} from '@/observability/errorReporter';
import ClaimBanner from '@/components/ClaimBanner';
import { Sparkles, Users } from 'lucide-react';
import { useJam } from '@/jam/JamProvider';
import JamIndicator from '@/jam/JamIndicator';
import ParticipantCursor from '@/jam/ParticipantCursor';
import { useRecorder } from '@/record/useRecorder';
import { BridgeServer } from '@/research/bridge/BridgeServer';
import RecordControls from '@/record/RecordControls';
import RecordingDialog from '@/record/RecordingDialog';
import MyRecordings, { type MyRecordingsHandle } from '@/record/MyRecordings';
import InfoTip from '@/components/InfoTip';
import HelpPanel from '@/components/HelpPanel';
import Tour from '@/components/Tour';
import { useTour } from '@/hooks/useTour';
import ExportDialog from '@/export/ExportDialog';
import { midiInput } from '@/midi/inputController';
import { midiOutput } from '@/midi/outputController';

// Shared pill styling for header toolbar actions. Uses mode-aware design
// tokens (--color-border/--color-surf/--color-muted) so every action button
// matches in size, border, and hover behavior across modes.
const TOOLBAR_PILL =
  'flex items-center gap-2 rounded-full px-4 py-2.5 transition-all border border-[var(--color-border)] bg-[var(--color-surf)]/20 text-[var(--color-muted)] hover:text-stone-200 hover:border-stone-700';

function fmtDuration(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export default function App() {
  const {
    params,
    setParam,
    engineId,
    engineParams,
    setEngine,
    setEngineParam,
    sessionMode,
    arcId,
    arcDurationSec,
    setSessionMode,
    setArcId,
    setArcDurationSec,
    sessionState,
    isPlaying,
    startSession,
    stopSession,
    arcProgress,
    engineRef,
    ensureOrchestrator,
    setEngineErrorHandler,
  } = useAnnealMusic();

  const mode = useParamStore((s) => s.mode);
  const { mode: appMode } = useMode();
  const setSubMode = useParamStore((s) => s.setMode);

  useEffect(() => {
    if (appMode === 'meditation') {
      if (mode !== 'drone') {
        localStorage.setItem('am_previous_sub_mode', mode);
        setSubMode('drone');
      }
    } else if (appMode === 'musician') {
      const prevSub = localStorage.getItem('am_previous_sub_mode') as
        | 'sketch'
        | 'drone'
        | null;
      if (prevSub && mode !== prevSub) {
        setSubMode(prevSub);
        localStorage.removeItem('am_previous_sub_mode');
      }
    }
  }, [appMode, mode, setSubMode]);

  // Send meditation/researcher users to their mode-specific landing route, but
  // only on the first arrival of a browser session. A session-scoped flag means
  // that once you're in, navigating back to `/` (e.g. via the brand logo) keeps
  // you on the sandbox instead of immediately bouncing away again.
  useEffect(() => {
    if (window.location.pathname !== '/' || window.location.hash) return;
    if (appMode !== 'meditation' && appMode !== 'researcher') return;

    const REDIRECT_FLAG = 'am_landing_redirected';
    try {
      if (sessionStorage.getItem(REDIRECT_FLAG)) return;
      sessionStorage.setItem(REDIRECT_FLAG, '1');
    } catch {
      // sessionStorage unavailable (e.g. privacy mode) — fall through and
      // redirect once; without the flag it may repeat, which is acceptable.
    }

    window.location.href =
      appMode === 'meditation' ? '/listen' : '/research.html';
  }, [appMode]);

  const arcLocked = arcProgress !== null;
  const returning = sessionState === 'stopping' && arcProgress !== null;
  const beginLabel = isPlaying
    ? 'Settle'
    : sessionMode === 'arc'
      ? `Begin · ${fmtDuration(arcDurationSec)}`
      : 'Begin';

  const segmentBoundaries = useMemo(() => {
    if (sessionMode !== 'arc') return [];
    const arc = getArcById(arcId);
    if (!arc) return [];
    const out: number[] = [];
    let acc = 0;
    for (const seg of arc.segments) {
      acc += seg.fraction;
      out.push(acc);
    }
    return out;
  }, [sessionMode, arcId]);

  const [helpOpen, setHelpOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const tour = useTour();

  const patchSlug = useMemo(() => {
    const match = window.location.pathname.match(/^\/p\/([^/]+)$/);
    return match && match[1] ? match[1] : 'free';
  }, []);

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastId = useRef(0);
  const showToast = useCallback(
    (text: string) => {
      if (appMode === 'meditation') {
        const suppressedKeywords = [
          'export',
          'sonification',
          'midi',
          'collab',
          'ai modified',
          'patch',
          'jam',
        ];
        const textLower = text.toLowerCase();
        if (suppressedKeywords.some((kw) => textLower.includes(kw))) {
          console.info(
            '[meditation-mode] Suppressed cross-mode technical notification:',
            text,
          );
          return;
        }
      }
      toastId.current += 1;
      setToast({ id: toastId.current, text });
    },
    [appMode],
  );
  const dismissToast = useCallback(() => setToast(null), []);

  // Initialize error reporter on app mount
  useEffect(() => {
    initializeErrorReporter();
  }, []);

  // Surface engine errors (e.g. physical worklet unsupported) as a toast.
  useEffect(() => {
    setEngineErrorHandler((error) => {
      showToast(error.message);
      void reportError(error, 'audio-engine-error');
    });
  }, [setEngineErrorHandler, showToast]);

  // Listen for low-level toast events (such as custom source fallbacks).
  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string }>;
      showToast(customEvent.detail.message);
    };
    window.addEventListener('anneal-toast', handleToast);
    return () => window.removeEventListener('anneal-toast', handleToast);
  }, [showToast]);

  // Start MIDI Input and Output controllers on app mount
  useEffect(() => {
    midiInput.start();
    midiOutput.start();
    return () => {
      midiInput.stop();
      midiOutput.stop();
    };
  }, []);

  const input = useInput(ensureOrchestrator, showToast);
  const loops = useLoops(ensureOrchestrator, showToast);
  const loopConfig = useParamStore((s) => s.loops);

  const patches = usePatches(ensureOrchestrator, loops, showToast);
  const recorder = useRecorder(ensureOrchestrator, showToast);

  const jam = useJam();
  const { session, joinJam, startJam } = jam || {
    session: null,
    joinJam: async () => {},
    startJam: async () => {},
  };
  const { id: jamSessionId } = useParams();
  const joinedRef = useRef(false);

  // Auto-join collaborative session from /jam/:id link
  useEffect(() => {
    if (jamSessionId && !joinedRef.current && !session) {
      joinedRef.current = true;
      void joinJam(jamSessionId)
        .then(() => showToast('Joined collaborative jam session'))
        .catch(() => showToast('Failed to join collaborative session'));
    }
  }, [jamSessionId, joinJam, session, showToast]);

  // Sync and share loops buffers across session
  useEffect(() => {
    if (session) {
      let active = true;
      let cleanup: (() => void) | null = null;
      import('@/jam/bufferSharing').then(({ startBufferSharing }) => {
        if (!active) return;
        cleanup = startBufferSharing(ensureOrchestrator, showToast);
      });
      return () => {
        active = false;
        if (cleanup) cleanup();
      };
    }
  }, [session, ensureOrchestrator, showToast]);

  // Register orchestrator getter on BridgeServer
  useEffect(() => {
    BridgeServer.registerOrchestrator(ensureOrchestrator);
  }, [ensureOrchestrator]);

  const recordingsRef = useRef<MyRecordingsHandle>(null);
  const backendOn = api.isBackendConfigured();
  const { slug: routeSlug } = useParams();
  const hasCaptures = SLOT_IDS.some((id) => loops.slots[id].hasBuffer);

  // Boot: hydrate params from the URL before the audio engine is ever built
  // (the engine is only constructed on the Begin click), then keep the URL in
  // sync with sculpting via a debounced replaceState write.
  useEffect(() => {
    const hasFragment = window.location.hash.startsWith('#s=');
    const hydrated = readStateFromHash();

    if (hydrated && hydrated.kind === 'patch') {
      const sharedCount = Object.keys(hydrated.params).length;
      const engineEntries = Object.entries(hydrated.engineParams);

      applyDecodedToStore(hydrated);

      const unknownArc = hydrated.warnings.some((w) =>
        w.includes('unknown arc'),
      );
      if (unknownArc) {
        showToast('Unknown arc, loaded open mode');
      } else if (
        sharedCount > 0 ||
        hydrated.engineId !== 'sine' ||
        engineEntries.length > 0 ||
        hydrated.mode !== 'open' ||
        SLOT_IDS.some(
          (id) =>
            hydrated.loops[id].frozen ||
            hydrated.loops[id].muted ||
            hydrated.loops[id].driftCoupled,
        )
      ) {
        showToast('Loaded shared session');
      }
      if (hydrated.warnings.length > 0) {
        console.debug('[share] decode warnings:', hydrated.warnings);
      }
    } else if (hasFragment) {
      showToast("Link from a newer version — can't load it");
    } else {
      try {
        const saved = localStorage.getItem('am_unsaved_patch_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.params) {
            applyDecodedToStore({
              kind: 'patch',
              params: parsed.params || {},
              engineId: parsed.engineId || 'sine',
              engineParams: parsed.engineParams || {},
              loops: parsed.loops || {},
              tuning: parsed.tuning,
              mode: parsed.mode || 'open',
              warnings: [],
            });
            showToast('Resumed unsaved session');
          }
        }
      } catch (err) {
        console.error(
          'Failed to load unsaved patch state from localStorage:',
          err,
        );
      }
    }

    return subscribeStoreToHash(useParamStore);
  }, [showToast]);

  // Synchronize parameter store to localStorage for persistence across reloads/switches
  useEffect(() => {
    return useParamStore.subscribe((state) => {
      try {
        const payload = {
          params: state.params,
          engineId: state.engineId,
          engineParams: state.engineParams,
          loops: state.loops,
          tuning: state.tuning,
          mode: state.sessionMode,
        };
        localStorage.setItem('am_unsaved_patch_state', JSON.stringify(payload));
      } catch (err) {
        console.error(
          'Failed to save unsaved patch state to localStorage:',
          err,
        );
      }
    });
  }, []);

  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);

  // Short-link route: `/p/<slug>` resolves a saved patch via the backend. Runs
  // once; the inline `#s=` path above stays the offline-capable default.
  const pRouteRan = useRef(false);
  useEffect(() => {
    if (pRouteRan.current) return;
    const match = window.location.pathname.match(/^\/p\/([^/]+)$/);
    if (!match) return;
    pRouteRan.current = true;
    const slug = match[1];
    if (!slug) return;
    if (!api.isBackendConfigured()) {
      showToast('Backend offline — open the inline share link instead');
      return;
    }
    void patches.loadPatch(slug);
  }, [patches, showToast]);

  const [activePatch, setActivePatch] = useState<Patch | null>(null);

  useEffect(() => {
    if (routeSlug && api.isBackendConfigured()) {
      api
        .getPatch(routeSlug)
        .then((patch) => {
          setActivePatch(patch);
        })
        .catch(() => {
          setActivePatch(null);
        });
    } else {
      setActivePatch(null);
    }
  }, [routeSlug]);

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: '#0c0a09', color: '#f5f5f4' }}
    >
      <FirstTimeModePicker />
      <div className="mx-auto max-w-5xl px-6 py-10 font-body">
        <Header
          subtitle="Endless, slowly-shifting ambient soundscapes. Set a few sliders, press play, and let it drift — good for focus, sleep, or calm."
          showHelp={true}
          onHelpClick={() => setHelpOpen(true)}
        >
          {/* Creative/Musician controls, shown conditionally depending on active mode */}
          {appMode !== 'meditation' && (
            <>
              <span className="flex items-center gap-1.5">
                <CopyLinkButton
                  params={params}
                  engineId={engineId}
                  engineParams={engineParams[engineId] ?? {}}
                  loops={loopConfig}
                  onResult={showToast}
                />
                <InfoTip id="feature.share" label="Copy link" />
              </span>

              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setExportOpen(true)}
                  className={TOOLBAR_PILL}
                >
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
                    Export Stems
                  </span>
                </button>
                <InfoTip id="feature.export" label="Export stems" />
              </span>

              {typeof navigator !== 'undefined' &&
                typeof navigator.requestMIDIAccess === 'function' && (
                  <span className="flex items-center gap-1.5">
                    <Link to="/midi" className={TOOLBAR_PILL}>
                      <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
                        MIDI
                      </span>
                    </Link>
                    <InfoTip
                      id="feature.midi"
                      label="MIDI settings dashboard"
                    />
                  </span>
                )}

              {backendOn && (
                <>
                  {!session && (
                    <button
                      type="button"
                      onClick={() => {
                        void startJam()
                          .then(() =>
                            showToast('Started collaborative session'),
                          )
                          .catch(() =>
                            showToast('Failed to start collaborative session'),
                          );
                      }}
                      className={TOOLBAR_PILL}
                    >
                      <Users size={13} strokeWidth={1.5} />
                      <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
                        Start Collab
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setAiGenerateOpen(true)}
                    aria-label="Generate patch with AI"
                    className="group flex items-center gap-2 rounded-full px-4 py-2.5 transition-all border border-[var(--color-border)] hover:border-stone-700 text-stone-300"
                    style={{ background: 'var(--accent-glow)' }}
                  >
                    <Sparkles
                      size={13}
                      strokeWidth={1.5}
                      style={{ color: '#fbbf24' }}
                    />
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
                      AI Generate
                    </span>
                  </button>
                  <SavePatchButton
                    patches={patches}
                    hasCaptures={hasCaptures}
                    showToast={showToast}
                  />
                  <RecordControls recorder={recorder} />
                  <MyPatchesDrawer
                    patches={patches}
                    onLoad={patches.loadPatch}
                    showToast={showToast}
                  />
                  <MyRecordings ref={recordingsRef} showToast={showToast} />
                </>
              )}
            </>
          )}

          {/* Play/Pause Button is cross-mode */}
          <button
            data-tour="play"
            onClick={() => (isPlaying ? stopSession() : startSession())}
            className="group flex items-center gap-3 rounded-full px-5 py-2.5 transition-all cursor-pointer hover:brightness-110"
            style={{
              background: isPlaying
                ? 'rgba(var(--color-accent-rgb), 0.14)'
                : 'rgba(var(--color-accent-rgb), 0.08)',
              border: '1px solid rgba(var(--color-accent-rgb), 0.45)',
              color: '#fef3c7',
            }}
          >
            {isPlaying ? (
              <Pause
                size={14}
                strokeWidth={1.5}
                style={{ color: 'var(--color-accent)' }}
              />
            ) : (
              <Play
                size={14}
                strokeWidth={1.5}
                style={{ color: 'var(--color-accent)' }}
              />
            )}
            <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
              {beginLabel}
            </span>
          </button>
        </Header>

        <FirstTimeBanner />

        {mode === 'drone' ? (
          <DroneView engineRef={engineRef} isPlaying={isPlaying} />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.22em]"
                    style={{ color: '#57534e' }}
                  >
                    Mode
                  </span>
                  <InfoTip id="mode" label="Mode" />
                </span>
                <SessionModeToggle
                  mode={sessionMode}
                  setMode={setSessionMode}
                  disabled={isPlaying}
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.22em]"
                    style={{ color: '#57534e' }}
                  >
                    Sound
                  </span>
                  <InfoTip id="engine" label="Sound" />
                </span>
                <div data-tour="engine">
                  <EngineSelector
                    engineId={engineId}
                    setEngine={setEngine}
                    disabled={arcLocked}
                  />
                </div>
              </div>
            </div>

            <PresetsPanel showToast={showToast} disabled={arcLocked} />

            {sessionMode === 'arc' && (
              <ArcPanel
                arcId={arcId}
                setArcId={setArcId}
                durationSec={arcDurationSec}
                setDurationSec={setArcDurationSec}
                engineId={engineId}
                disabled={isPlaying}
              />
            )}

            <div className="mt-6">
              <Visualizer
                engineRef={engineRef}
                isPlaying={isPlaying}
                arcProgress={arcProgress}
                segmentBoundaries={segmentBoundaries}
                returning={returning}
              />
            </div>

            <InputPanel input={input} />

            <LoopPedal
              loops={loops}
              inputConnected={input.state === 'connected'}
            />

            <ControlPanel
              params={params}
              setParam={setParam}
              isPlaying={isPlaying}
              engineId={engineId}
              engineParams={engineParams[engineId] ?? {}}
              setEngineParam={(key, value) =>
                setEngineParam(engineId, key, value)
              }
              arcLocked={arcLocked}
              showToast={showToast}
            />

            {activePatch && (
              <>
                <div className="am-hairline my-12" />
                <SimilarPatchesRow
                  patchId={activePatch.id}
                  showToast={showToast}
                />
              </>
            )}
          </>
        )}

        <div className="am-hairline my-12" />

        <footer
          className="mb-4 mt-16 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: '#44403c' }}
        >
          <span>annealmusic · working title</span>
          {typeof navigator !== 'undefined' &&
            typeof navigator.requestMIDIAccess === 'function' && (
              <Link
                to="/midi"
                className="hover:text-stone-300 transition-colors uppercase tracking-[0.18em]"
              >
                MIDI Control
              </Link>
            )}
          <span>kuramoto · ornstein–uhlenbeck</span>
        </footer>
      </div>

      {recorder.pending && (
        <RecordingDialog
          recording={recorder.pending}
          onClose={recorder.discardPending}
          onSaved={(slug) => {
            recorder.discardPending();
            recordingsRef.current?.refresh();
            showToast(`Recording saved · /r/${slug}`);
          }}
          showToast={showToast}
        />
      )}

      {helpOpen && (
        <HelpPanel
          onClose={() => setHelpOpen(false)}
          onReplayTour={() => {
            setHelpOpen(false);
            tour.start();
          }}
        />
      )}

      {exportOpen && (
        <ExportDialog
          orchestrator={ensureOrchestrator()}
          patchTitle="Untitled session"
          patchHash={patchSlug}
          onClose={() => setExportOpen(false)}
          showToast={showToast}
        />
      )}

      <Tour tour={tour} />

      {backendOn && (
        <>
          <LoginDialog isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
          <GeneratePatchDialog
            isOpen={aiGenerateOpen}
            onClose={() => setAiGenerateOpen(false)}
            showToast={showToast}
          />
          <ClaimBanner showToast={showToast} />
        </>
      )}

      <ConsentDialog />
      <Toast toast={toast} onDismiss={dismissToast} />
      <JamIndicator />
      <ParticipantCursor />
    </div>
  );
}
