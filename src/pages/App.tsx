import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, Pause, Play } from 'lucide-react';
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
import ModeToggle from '@/components/ModeToggle';
import ArcPanel from '@/components/ArcPanel';
import PresetsPanel from '@/components/PresetsPanel';
import ArchitectureDiagram from '@/components/ArchitectureDiagram';
import CopyLinkButton from '@/components/CopyLinkButton';
import SavePatchButton from '@/components/SavePatchButton';
import MyPatchesDrawer from '@/components/MyPatchesDrawer';
import Toast, { type ToastMessage } from '@/components/Toast';
import { api } from '@/api/client';
import { usePatches } from '@/api/usePatches';
import { useRecorder } from '@/record/useRecorder';
import RecordControls from '@/record/RecordControls';
import RecordingDialog from '@/record/RecordingDialog';
import MyRecordings, { type MyRecordingsHandle } from '@/record/MyRecordings';
import InfoTip from '@/components/InfoTip';
import HelpPanel from '@/components/HelpPanel';
import Tour from '@/components/Tour';
import { useTour } from '@/hooks/useTour';

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
  const tour = useTour();

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastId = useRef(0);
  const showToast = useCallback((text: string) => {
    toastId.current += 1;
    setToast({ id: toastId.current, text });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  // Surface engine errors (e.g. physical worklet unsupported) as a toast.
  useEffect(() => {
    setEngineErrorHandler((error) => showToast(error.message));
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

  const input = useInput(ensureOrchestrator, showToast);
  const loops = useLoops(ensureOrchestrator, showToast);
  const loopConfig = useParamStore((s) => s.loops);

  const patches = usePatches(ensureOrchestrator, loops, showToast);
  const recorder = useRecorder(ensureOrchestrator, showToast);
  const recordingsRef = useRef<MyRecordingsHandle>(null);
  const backendOn = api.isBackendConfigured();
  const hasCaptures = SLOT_IDS.some((id) => loops.slots[id].hasBuffer);

  // Boot: hydrate params from the URL before the audio engine is ever built
  // (the engine is only constructed on the Begin click), then keep the URL in
  // sync with sculpting via a debounced replaceState write.
  useEffect(() => {
    const hasFragment = window.location.hash.startsWith('#s=');
    const hydrated = readStateFromHash();

    if (hydrated) {
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
    }

    return subscribeStoreToHash(useParamStore);
  }, [showToast]);

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

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: '#0c0a09', color: '#f5f5f4' }}
    >
      <div className="mx-auto max-w-5xl px-6 py-10 font-body">
        <header className="mb-8 flex items-baseline justify-between">
          <div>
            <div className="flex items-baseline gap-3">
              <h1
                className="font-display text-5xl tracking-tight"
                style={{ color: '#fef3c7' }}
              >
                <em>AnnealMusic</em>
              </h1>
              <span
                className="font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: '#78716c' }}
              >
                v1.0
              </span>
            </div>
            <p
              className="mt-1 max-w-md font-body text-sm"
              style={{ color: '#a8a29e' }}
            >
              Endless, slowly-shifting ambient soundscapes. Set a few sliders,
              press play, and let it drift — good for focus, sleep, or calm.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="What is AnnealMusic? Open help"
              onClick={() => setHelpOpen(true)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all"
              style={{ border: '1px solid #44403c', color: '#a8a29e' }}
            >
              <HelpCircle size={13} strokeWidth={1.5} />
              <span className="font-mono text-[11px] uppercase tracking-[0.18em]">
                Help
              </span>
            </button>

            <span className="flex items-center gap-1.5">
              <Link
                to="/gallery"
                className="font-mono text-[11px] uppercase tracking-[0.18em] transition-colors"
                style={{ color: '#a8a29e' }}
              >
                Gallery
              </Link>
              <InfoTip id="feature.gallery" label="Gallery" />
            </span>

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

            {backendOn && (
              <>
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

            <button
              data-tour="play"
              onClick={() => (isPlaying ? stopSession() : startSession())}
              className="group flex items-center gap-3 rounded-full px-5 py-2.5 transition-all"
              style={{
                background: isPlaying
                  ? 'rgba(245, 158, 11, 0.10)'
                  : 'rgba(245, 158, 11, 0.04)',
                border: '1px solid #44403c',
                color: '#fef3c7',
              }}
            >
              {isPlaying ? (
                <Pause
                  size={14}
                  strokeWidth={1.5}
                  style={{ color: '#f59e0b' }}
                />
              ) : (
                <Play
                  size={14}
                  strokeWidth={1.5}
                  style={{ color: '#f59e0b' }}
                />
              )}
              <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
                {beginLabel}
              </span>
            </button>
          </div>
        </header>

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
            <ModeToggle
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

        <LoopPedal loops={loops} inputConnected={input.state === 'connected'} />

        <ControlPanel
          params={params}
          setParam={setParam}
          isPlaying={isPlaying}
          engineId={engineId}
          engineParams={engineParams[engineId] ?? {}}
          setEngineParam={(key, value) => setEngineParam(engineId, key, value)}
          arcLocked={arcLocked}
        />

        <div className="am-hairline my-12" />

        <ArchitectureDiagram />

        <footer
          className="mb-4 mt-16 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: '#44403c' }}
        >
          <span>annealmusic · working title</span>
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

      <Tour tour={tour} />

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
