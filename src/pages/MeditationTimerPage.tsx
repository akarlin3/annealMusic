import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  Bell,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { BELL_REGISTRY, getBellById } from '@/audio/bells/registry';
import {
  BellScheduler,
  resolveBellSchedule,
  type BellEvent,
} from '@/audio/bells/scheduler';
import { api } from '@/api/client';
import { healthApi } from '@/health/api';
import { BreathController, type BreathPhase } from '@/breath/BreathController';
import { resolveTuple } from '@/breath/patterns';
import BreathPicker from '@/breath/BreathPicker';
import { useBreathPattern, useBreathPrefs } from '@/breath/useBreathPrefs';
import { pulsePhaseTransition } from '@/breath/hapticBridge';

const PHASE_LABEL: Record<BreathPhase, string> = {
  inhale: 'Inhale',
  'hold-full': 'Hold',
  exhale: 'Exhale',
  'hold-empty': 'Hold',
};

function fmtTime(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export default function MeditationTimerPage() {
  const navigate = useNavigate();

  const sessionStartedAtRef = useRef<Date | null>(null);

  const logSessionResult = async (elapsedSeconds: number) => {
    const startedAt = sessionStartedAtRef.current;
    if (!startedAt) return;

    if (!healthApi.getIncludeTimer()) {
      return;
    }

    if (elapsedSeconds < 5) {
      return;
    }

    const endedAt = new Date();
    sessionStartedAtRef.current = null;

    if (api.isBackendConfigured()) {
      try {
        await api.logPlayedSession({
          listening_session_id: null,
          started_at: startedAt.toISOString(),
          completed_at: endedAt.toISOString(),
          duration_seconds: elapsedSeconds,
          is_standalone_timer: true,
        });
      } catch (err) {
        console.error('Failed to log standalone timer history:', err);
      }
    }

    try {
      await healthApi.logPlayedSession(startedAt, endedAt);
    } catch (err) {
      console.error('Failed to sync standalone timer to health platform:', err);
    }
  };

  // Timer settings state
  const [selectedBellId, setSelectedBellId] = useState('zen_bell_rin');
  const [durationMin, setDurationMin] = useState(15);
  const [intervalMin, setIntervalMin] = useState(5); // 0 means None

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [remainingSec, setRemainingSec] = useState(15 * 60);

  const elapsedSecRef = useRef(0);
  useEffect(() => {
    elapsedSecRef.current = elapsedSec;
  }, [elapsedSec]);

  // Breath pacing: pattern persists on this device; box is the default cue.
  const [breathPattern, setBreathPattern] = useBreathPattern('am_breath_timer');
  const breathPrefs = useBreathPrefs();
  const activePattern = breathPattern ?? { pattern: 'box' as const };

  // Breath display state
  const [breathingLabel, setBreathingLabel] = useState('Prepare');
  const [breathingScale, setBreathingScale] = useState(1.0);
  const [breathingOpacity, setBreathingOpacity] = useState(0.3);

  // Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<BellScheduler | null>(null);
  const mainTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breathTimerRef = useRef<ReturnType<
    typeof requestAnimationFrame
  > | null>(null);
  const controllerRef = useRef<BreathController | null>(null);

  // Initialize total remaining seconds on setting change
  useEffect(() => {
    if (!isPlaying) {
      setRemainingSec(durationMin * 60);
      setElapsedSec(0);
    }
  }, [durationMin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Breath animation loop. Phase math lives once in BreathController, driven by
  // AudioContext.currentTime (not wall-clock), so a backgrounded tab resumes at
  // the correct phase and long sessions never drift. RAF only paints.
  const tuple = resolveTuple(activePattern);
  const tupleKey = tuple ? tuple.join(',') : '';
  useEffect(() => {
    if (!isPlaying || !tuple) {
      setBreathingScale(1.0);
      setBreathingOpacity(0.3);
      setBreathingLabel('Prepare');
      controllerRef.current = null;
      if (breathTimerRef.current) {
        cancelAnimationFrame(breathTimerRef.current);
        breathTimerRef.current = null;
      }
      return;
    }

    const ctrl = new BreathController(tuple);
    ctrl.reset(audioCtxRef.current?.currentTime ?? 0);
    controllerRef.current = ctrl;

    const tick = () => {
      const now = audioCtxRef.current?.currentTime ?? 0;
      const frame = ctrl.frameAt(now);
      const reduced =
        breathPrefs.reduceMotion ||
        (typeof window !== 'undefined' &&
          window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

      // Reduced motion: fixed size, opacity carries the breath instead.
      setBreathingScale(reduced ? 1.4 : 1.0 + frame.amplitude * 0.8);
      setBreathingOpacity(0.3 + frame.amplitude * 0.5);
      setBreathingLabel(PHASE_LABEL[frame.phase]);

      if (frame.transition && breathPrefs.haptics) {
        void pulsePhaseTransition(frame.phase);
      }
      breathTimerRef.current = requestAnimationFrame(tick);
    };
    breathTimerRef.current = requestAnimationFrame(tick);

    return () => {
      if (breathTimerRef.current) {
        cancelAnimationFrame(breathTimerRef.current);
        breathTimerRef.current = null;
      }
    };
  }, [isPlaying, tupleKey, breathPrefs.reduceMotion, breathPrefs.haptics]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    // 1. Initialize Web Audio Context and Scheduler
    if (!audioCtxRef.current) {
      const AudioCtx =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }

    const ctx = audioCtxRef.current!;
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (!schedulerRef.current) {
      schedulerRef.current = new BellScheduler(ctx, ctx.destination);
    }

    // 2. Build and resolve bell schedule
    const schedule: BellEvent[] = [];

    // Always play opening bell at start
    schedule.push({
      bellId: selectedBellId,
      trigger: 'at-start',
      volume: 0.7,
      offsetMs: 0,
    });

    // Add interval chimes if configured
    if (intervalMin > 0) {
      schedule.push({
        bellId: selectedBellId,
        trigger: 'every',
        volume: 0.7,
        intervalMin: intervalMin,
      });
    }

    // Always play closing bell at end
    schedule.push({
      bellId: selectedBellId,
      trigger: 'at-end',
      volume: 0.7,
      offsetMs: 0,
    });

    const totalDurMs = durationMin * 60 * 1000;
    const resolved = resolveBellSchedule(schedule, totalDurMs);

    schedulerRef.current.setTriggers(resolved);
    schedulerRef.current.start(elapsedSec * 1000);

    sessionStartedAtRef.current = new Date();
    setIsPlaying(true);

    // 3. Start progress interval
    mainTimerRef.current = setInterval(() => {
      setElapsedSec((prevElapsed) => {
        const nextElapsed = prevElapsed + 1;
        const totalSec = durationMin * 60;
        const nextRemaining = totalSec - nextElapsed;

        if (nextRemaining <= 0) {
          handleStop(totalSec);
          return totalSec;
        }

        setRemainingSec(nextRemaining);
        return nextElapsed;
      });
    }, 1000);
  };

  const handlePause = () => {
    if (mainTimerRef.current) {
      clearInterval(mainTimerRef.current);
      mainTimerRef.current = null;
    }
    schedulerRef.current?.stop();
    setIsPlaying(false);
  };

  const handleStop = (customElapsed?: number | React.MouseEvent) => {
    const elapsed =
      typeof customElapsed === 'number' ? customElapsed : elapsedSec;
    logSessionResult(elapsed);
    if (mainTimerRef.current) {
      clearInterval(mainTimerRef.current);
      mainTimerRef.current = null;
    }
    schedulerRef.current?.stop();
    schedulerRef.current = null;
    setIsPlaying(false);
    setElapsedSec(0);
    setRemainingSec(durationMin * 60);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionStartedAtRef.current) {
        logSessionResult(elapsedSecRef.current);
      }
      if (mainTimerRef.current) {
        clearInterval(mainTimerRef.current);
      }
      if (schedulerRef.current) {
        schedulerRef.current.stop();
        schedulerRef.current = null;
      }
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state !== 'closed') {
        void ctx.close().catch(() => undefined);
      }
    };
  }, []);

  const progressPercent = (elapsedSec / (durationMin * 60)) * 100;
  const currentBellDef = getBellById(selectedBellId);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-stone-950 text-stone-200 px-8 py-10 overflow-y-auto relative select-none">
      {/* Decorative background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className="absolute -top-[10%] -left-[10%] w-[500px] h-[500px] rounded-full bg-amber-500/[0.03] blur-[100px] transition-opacity duration-1000"
          style={{ opacity: isPlaying ? 0.8 : 0.4 }}
        />
        <div
          className="absolute -bottom-[10%] -right-[10%] w-[500px] h-[500px] rounded-full bg-amber-600/[0.02] blur-[120px] transition-opacity duration-1000"
          style={{ opacity: isPlaying ? 0.6 : 0.3 }}
        />
      </div>

      {/* Header */}
      <header className="w-full max-w-4xl flex items-center justify-between border-b border-stone-900/60 pb-4 z-10">
        <button
          onClick={() => {
            handleStop();
            navigate('/');
          }}
          className="flex items-center justify-center h-11 w-11 rounded-full border border-stone-850 bg-stone-950/20 hover:border-stone-700 text-stone-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 transition-all cursor-pointer"
          title="Back to App"
          aria-label="Back to App"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="text-center">
          <h1 className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-100/90 font-bold">
            Meditation Bell Timer
          </h1>
          <p className="text-[8px] uppercase tracking-wider text-stone-500 mt-1">
            Silent focus space punctuated by curated, organic bell tones.
          </p>
        </div>
        <div className="w-11 h-11" /> {/* Spacer */}
      </header>

      {/* Main Breathing and Settings Field */}
      <main className="relative flex-1 w-full max-w-4xl flex flex-col sm:flex-row items-center justify-center gap-12 py-6">
        {/* Left Field: Breathing Visualizer Circle */}
        <div className="flex-1 flex flex-col items-center justify-center z-10">
          <div className="relative w-80 h-80 rounded-full flex items-center justify-center">
            {/* Pulsing Outer Glow Aura */}
            <div
              className="absolute rounded-full bg-amber-500/[0.02] blur-[40px] border border-amber-500/[0.05] transition-all duration-300 ease-out"
              style={{
                width: '320px',
                height: '320px',
                transform: `scale(${breathingScale * 1.15})`,
                opacity: isPlaying ? breathingOpacity * 0.7 : 0.2,
              }}
            />
            {/* LFO expanding breath circle (Glassmorphic) */}
            <div
              className="absolute rounded-full bg-gradient-to-br from-amber-500/[0.06] to-amber-600/[0.02] border border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.12)] transition-transform duration-150 ease-out backdrop-blur-[2px]"
              style={{
                width: '180px',
                height: '180px',
                transform: `scale(${breathingScale})`,
                opacity: isPlaying ? breathingOpacity : 0.3,
              }}
            />
            {/* Outer Static Subtle Ring */}
            <div className="absolute w-[220px] h-[220px] rounded-full border border-stone-800/40 pointer-events-none" />

            {/* Inner stable circle */}
            <div className="relative z-20 flex flex-col items-center justify-center text-center">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone-400 font-semibold mb-2">
                {breathingLabel}
              </span>
              <span className="font-mono text-4xl font-light tracking-tight text-stone-100 drop-shadow-md">
                {fmtTime(remainingSec)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Field: Settings Controls Card */}
        <div className="w-full sm:w-80 rounded-2xl border border-stone-800/80 p-6 font-mono text-[9px] uppercase tracking-wider backdrop-blur-xl bg-stone-900/40 shadow-2xl space-y-6 z-10">
          <div className="flex items-center gap-2 border-b border-stone-800/60 pb-3 mb-2">
            <Bell size={12} className="text-amber-500" />
            <span className="font-semibold text-amber-200/90 tracking-widest text-[10px]">
              Timer Configuration
            </span>
          </div>

          {/* Select Bell Instrument */}
          <div className="space-y-1.5">
            <label className="text-stone-500 block">Bell Instrument</label>
            <div className="relative">
              <select
                value={selectedBellId}
                disabled={isPlaying}
                onChange={(e) => setSelectedBellId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-stone-800/60 bg-stone-950/40 hover:bg-stone-950/60 transition-colors px-3.5 py-2.5 font-mono text-[10px] uppercase text-stone-200 focus:border-amber-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 disabled:opacity-50 cursor-pointer pr-10"
              >
                {BELL_REGISTRY.map((b) => (
                  <option
                    key={b.id}
                    value={b.id}
                    className="bg-stone-950 text-stone-200"
                  >
                    {b.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-450"
              />
            </div>
          </div>

          {/* Session Duration */}
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <label className="text-stone-500">Duration</label>
              <span className="text-amber-400 font-semibold text-[10px]">
                {durationMin} Min
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="60"
              step="1"
              value={durationMin}
              disabled={isPlaying}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              className="w-full am-range cursor-pointer disabled:opacity-50"
              aria-label="Duration"
            />
          </div>

          {/* Chime Interval */}
          <div className="space-y-1.5">
            <label className="text-stone-500 block">Interval Punctuation</label>
            <div className="relative">
              <select
                value={intervalMin}
                disabled={isPlaying}
                onChange={(e) => setIntervalMin(Number(e.target.value))}
                className="w-full appearance-none rounded-xl border border-stone-800/60 bg-stone-950/40 hover:bg-stone-950/60 transition-colors px-3.5 py-2.5 font-mono text-[10px] uppercase text-stone-200 focus:border-amber-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 disabled:opacity-50 cursor-pointer pr-10"
              >
                <option value={0} className="bg-stone-950 text-stone-200">
                  None (Only Start/End)
                </option>
                <option value={1} className="bg-stone-950 text-stone-200">
                  Every 1 Minute
                </option>
                <option value={2} className="bg-stone-950 text-stone-200">
                  Every 2 Minutes
                </option>
                <option value={3} className="bg-stone-950 text-stone-200">
                  Every 3 Minutes
                </option>
                <option value={5} className="bg-stone-950 text-stone-200">
                  Every 5 Minutes
                </option>
                <option value={10} className="bg-stone-950 text-stone-200">
                  Every 10 Minutes
                </option>
                <option value={15} className="bg-stone-950 text-stone-200">
                  Every 15 Minutes
                </option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-450"
              />
            </div>
          </div>

          {/* Breath pacing (persists on this device) */}
          <div className="border-t border-stone-800/60 pt-4 normal-case tracking-normal">
            <BreathPicker value={breathPattern} onChange={setBreathPattern} />
            {tuple && (
              <div className="mt-4 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-stone-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={breathPrefs.reduceMotion}
                    onChange={(e) =>
                      breathPrefs.setReduceMotion(e.target.checked)
                    }
                    className="rounded border-stone-850 bg-stone-950/40 text-amber-500 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5 cursor-pointer"
                  />
                  Reduce motion
                </label>
                {breathPrefs.hapticsAvailable && (
                  <label className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-stone-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={breathPrefs.haptics}
                      onChange={(e) => breathPrefs.setHaptics(e.target.checked)}
                      className="rounded border-stone-850 bg-stone-950/40 text-amber-500 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5 cursor-pointer"
                    />
                    Haptics
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Bell Description */}
          {currentBellDef && (
            <div className="border-t border-stone-800/60 pt-4 text-[8px] uppercase tracking-wider text-stone-500 leading-relaxed">
              <span className="text-stone-400 block font-semibold mb-1">
                {currentBellDef.name}
              </span>
              {currentBellDef.description}
            </div>
          )}
        </div>
      </main>

      {/* Footer controls & Clinical disclaimer */}
      <footer className="w-full max-w-4xl flex flex-col items-center gap-6 z-10">
        {/* Playback Controls */}
        <div className="flex items-center gap-5">
          {isPlaying ? (
            <button
              onClick={handlePause}
              className="flex items-center justify-center h-14 w-14 rounded-full border border-stone-800 bg-stone-900/60 hover:bg-stone-800/60 text-stone-300 hover:text-amber-400 hover:border-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 transition-all shadow-lg active:scale-95 cursor-pointer"
              title="Pause Timer"
              aria-label="Pause Timer"
            >
              <Pause size={18} strokeWidth={1.5} />
            </button>
          ) : (
            <button
              onClick={handleStart}
              className="flex items-center justify-center h-14 w-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 shadow-[0_0_30px_rgba(245,158,11,0.25)] hover:shadow-[0_0_40px_rgba(245,158,11,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 transition-all active:scale-90 cursor-pointer"
              title="Start Timer"
              aria-label="Start Timer"
            >
              <Play size={18} strokeWidth={1.5} className="ml-0.5" />
            </button>
          )}

          <button
            onClick={() => handleStop()}
            disabled={!isPlaying && elapsedSec === 0}
            className="flex items-center justify-center h-14 w-14 rounded-full border border-stone-800 bg-stone-900/30 text-stone-500 hover:text-stone-300 hover:border-stone-700 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 transition-all active:scale-95 cursor-pointer"
            title="Reset Timer"
            aria-label="Reset Timer"
          >
            <Square size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Dynamic bottom progress bar */}
        {isPlaying && (
          <div className="w-full max-w-xl h-[3px] bg-stone-900/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 rounded-full transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(245,158,11,0.5)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Clinical Disclaimer */}
        <div className="w-full max-w-xl text-center border-t border-stone-900/40 pt-4 pb-2">
          <p className="flex items-center justify-center gap-1.5 font-mono text-[8px] uppercase tracking-wider text-stone-600">
            <HelpCircle size={10} className="text-stone-700" />
            Disclaimer: Ambient listens are calming, but specific tuning
            frequencies or chimes lack clinically validated efficacy.
          </p>
        </div>
      </footer>
    </div>
  );
}
