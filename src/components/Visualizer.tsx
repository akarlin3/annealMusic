import { useEffect, useRef, useState } from 'react';
import { Circle, Sliders, X } from 'lucide-react';
import type { ArcProgress, Orchestrator } from '@/audio/orchestrator';
import {
  createVisualRenderer,
  type VisualState,
  type LoopRing,
  probeWebGL2,
} from '@/visual';
import { readRms } from '@/input/meter';
import { HARMONICS } from '@/types/audio';
import { SLOT_IDS } from '@/loop/types';
import { useParamStore, getClosestNote } from '@/state/params';
import { useMode } from '@/mode/useMode';
import { ampForFreq } from '@/visual/canvas/draw';

interface VisualizerProps {
  engineRef: React.MutableRefObject<Orchestrator | null>;
  isPlaying: boolean;
  /** Live arc progress (top bar + remaining-time readout); null in open mode. */
  arcProgress?: ArcProgress | null;
  /** Cumulative segment boundary fractions (0..1) for marker dots. */
  segmentBoundaries?: number[];
  /** True during the final settle fade of an arc — shows a RETURNING label. */
  returning?: boolean;
  isCalm?: boolean;
}

function fmtRemaining(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export default function Visualizer({
  engineRef,
  isPlaying,
  arcProgress = null,
  segmentBoundaries = [],
  returning = false,
  isCalm = false,
}: VisualizerProps) {
  const { mode } = useMode();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const phasesRef = useRef<number[]>(
    HARMONICS.map(() => Math.random() * Math.PI * 2),
  );
  const sizeRef = useRef({ w: 0, h: 0 });

  // Visual settings preferences, persisted to localStorage
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rendererPref, setRendererPref] = useState<'auto' | 'canvas' | 'webgl'>(
    () => {
      if (typeof window === 'undefined') return 'auto';
      return (
        (localStorage.getItem('am_visual_renderer') as
          | 'auto'
          | 'canvas'
          | 'webgl') || 'auto'
      );
    },
  );
  const [qualityPref, setQualityPref] = useState<'low' | 'medium' | 'high'>(
    () => {
      if (typeof window === 'undefined') return 'high';
      return (
        (localStorage.getItem('am_visual_quality') as
          | 'low'
          | 'medium'
          | 'high') || 'high'
      );
    },
  );
  const [showSpectrumPref, setShowSpectrumPref] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('am_visual_show_spectrum');
    return saved !== null ? saved === 'true' : true;
  });

  const handleRendererChange = (val: 'auto' | 'canvas' | 'webgl') => {
    setRendererPref(val);
    localStorage.setItem('am_visual_renderer', val);
  };

  const handleQualityChange = (val: 'low' | 'medium' | 'high') => {
    setQualityPref(val);
    localStorage.setItem('am_visual_quality', val);
  };

  const handleShowSpectrumChange = (val: boolean) => {
    setShowSpectrumPref(val);
    localStorage.setItem('am_visual_show_spectrum', String(val));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cap = probeWebGL2();
    const activeRenderer =
      rendererPref === 'auto'
        ? cap.webgl_supported
          ? 'webgl'
          : 'canvas'
        : rendererPref;

    // Resolve visualizer implementation
    const renderer = createVisualRenderer({
      renderer:
        activeRenderer === 'webgl' && cap.webgl_supported ? 'webgl' : 'canvas',
    });
    renderer.mount(canvas);
    renderer.setQuality(qualityPref);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const cappedDpr = Math.min(2, dpr);
      renderer.resize(rect.width, rect.height, cappedDpr);
      sizeRef.current = { w: rect.width, h: rect.height };

      const overlay = overlayCanvasRef.current;
      if (overlay) {
        overlay.width = Math.max(1, Math.floor(rect.width * cappedDpr));
        overlay.height = Math.max(1, Math.floor(rect.height * cappedDpr));
        const oCtx = overlay.getContext('2d');
        if (oCtx) {
          oCtx.setTransform(cappedDpr, 0, 0, cappedDpr, 0, 0);
        }
      }
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let lastT = performance.now();

    const draw = (now: number) => {
      const isReduced = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      const actualDt = (now - lastT) / 1000;
      const dt = isReduced ? 0 : Math.min(actualDt, 0.1);
      lastT = now;
      const { w, h } = sizeRef.current;

      const engine = engineRef.current;
      const analyser = engine?.getAnalyser() ?? null;

      let spectrum: Uint8Array<ArrayBuffer> | null = null;
      let sampleRate = engine?.getSampleRate() ?? 48000;
      let fftSize = 1024;
      if (analyser) {
        spectrum = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(spectrum);
        fftSize = analyser.fftSize;
        sampleRate = analyser.context.sampleRate;
      }

      const inputAnalyser = engine?.getInputVoice()?.getAnalyser() ?? null;
      const inputLevel = inputAnalyser
        ? Math.min(1, readRms(inputAnalyser) * 1.4)
        : undefined;

      const loops: LoopRing[] = [];
      SLOT_IDS.forEach((id, slot) => {
        const loopSlot = engine?.getLoopSlot(id);
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
      const engineFreqs = engine?.getPartialFrequencies() ?? [];
      const count = engineFreqs.length || params.density;
      const freqs: number[] = [];
      for (let i = 0; i < count; i++) {
        const ratio = HARMONICS[i] ?? 1;
        freqs.push(engineFreqs[i] ?? params.rootFreq * ratio);
      }

      const r = engine?.getOrderParameter() ?? 0;
      const isMeditation = mode === 'meditation' || isCalm;

      const state: VisualState = {
        w,
        h,
        dt,
        phases: phasesRef.current,
        freqs,
        count,
        spectrum: showSpectrumPref ? spectrum : null,
        sampleRate,
        fftSize,
        inputLevel,
        loops,
        isCalm: isMeditation,
        r,
        mode: mode || 'musician',
      };

      renderer.drawFrame(state, now);

      // --- 2D TELEMETRY OVERLAY FOR WEBGL PRESET ---
      const overlayCanvas = overlayCanvasRef.current;
      if (overlayCanvas && mode === 'researcher') {
        const oCtx = overlayCanvas.getContext('2d');
        if (oCtx) {
          oCtx.clearRect(0, 0, w, h);
          oCtx.fillStyle = 'rgba(250, 250, 249, 0.75)'; // stone-50
          oCtx.font = '8px Geist Mono, ui-monospace, monospace';
          oCtx.textAlign = 'left';

          const baseR = Math.min(w, h) * 0.3; // baseRadiusFactor = 0.3
          const cx = w / 2;
          const cy = h / 2;
          const rVal = r;

          for (let i = 0; i < count; i++) {
            const freqHz = freqs[i] ?? 0;
            const phase = phasesRef.current[i] ?? 0;

            const baseOrbitFactor = 0.45 + 0.55 * (i / Math.max(1, count - 1));
            const targetOrbitFactor = 0.725;
            const orbitFactor =
              baseOrbitFactor +
              (targetOrbitFactor - baseOrbitFactor) * rVal * 0.7;

            const orbit = baseR * orbitFactor;
            const px = cx + Math.cos(phase) * orbit;
            const py = cy + Math.sin(phase) * orbit * 0.78; // orbitSquash = 0.78

            const amp = spectrum
              ? ampForFreq(freqHz, spectrum, sampleRate, fftSize)
              : 0.4;
            const sizeR = 5.0 + amp * 22.0;

            oCtx.fillText(
              `${freqHz.toFixed(1)} Hz (f${i + 1})`,
              px + sizeR + 4,
              py + 3,
            );
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
      renderer.dispose();
    };
  }, [engineRef, rendererPref, qualityPref, showSpectrumPref, isCalm, mode]);

  const params = useParamStore((s) => s.params);

  return (
    <div
      className="relative w-full overflow-hidden rounded-sm"
      style={{
        height: 360,
        background: '#0c0a09',
        border: '1px solid #1c1917',
      }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      {mode === 'researcher' && (
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 pointer-events-none block h-full w-full"
          style={{ zIndex: 5 }}
        />
      )}

      {/* Visual Settings Overlay Toggle Button */}
      <button
        type="button"
        onClick={() => setSettingsOpen(!settingsOpen)}
        className="absolute top-3 right-4 p-1.5 rounded-full border border-stone-800 bg-stone-950/60 hover:border-stone-700 hover:text-white transition-colors"
        style={{ color: '#a8a29e', zIndex: 10 }}
        title="Visual settings"
      >
        <Sliders size={11} strokeWidth={1.5} />
      </button>

      {/* Amber-Dark HUD Settings Panel */}
      {settingsOpen && (
        <div
          className="absolute right-4 top-11 rounded border p-4 font-mono text-[9px] uppercase tracking-wider backdrop-blur-md"
          style={{
            background: 'rgba(20, 18, 16, 0.92)',
            color: '#a8a29e',
            zIndex: 20,
            width: 250,
            borderColor: '#292524',
          }}
        >
          <div className="flex items-center justify-between border-b border-stone-900 pb-2 mb-3">
            <span className="font-semibold text-stone-200">
              Visualizer setup
            </span>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="text-stone-500 hover:text-white transition-colors"
            >
              <X size={11} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Renderer Selection */}
            <div>
              <div className="text-stone-500 mb-1.5">Renderer</div>
              <div className="flex gap-1.5">
                {(['auto', 'webgl', 'canvas'] as const).map((r) => {
                  const active = rendererPref === r;
                  const unsupported =
                    r === 'webgl' && !probeWebGL2().webgl_supported;
                  return (
                    <button
                      type="button"
                      key={r}
                      disabled={unsupported}
                      onClick={() => handleRendererChange(r)}
                      className={`flex-1 rounded py-1 text-center font-mono text-[8px] font-semibold transition-all border ${
                        active
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 font-bold'
                          : 'border-stone-900 bg-transparent hover:border-stone-800 text-stone-400'
                      } ${unsupported ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                      {r === 'webgl' && unsupported ? 'WebGL (N/A)' : r}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quality Presets */}
            <div>
              <div className="text-stone-500 mb-1.5">Quality</div>
              <div className="flex gap-1.5">
                {(['low', 'medium', 'high'] as const).map((q) => {
                  const active = qualityPref === q;
                  return (
                    <button
                      type="button"
                      key={q}
                      onClick={() => handleQualityChange(q)}
                      className={`flex-1 rounded py-1 text-center font-mono text-[8px] font-semibold transition-all border ${
                        active
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 font-bold'
                          : 'border-stone-900 bg-transparent hover:border-stone-800 text-stone-400'
                      }`}
                    >
                      {q}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Spectrum Trace Toggle */}
            <div className="flex items-center justify-between border-t border-stone-900 pt-3">
              <span className="text-stone-500">Show Spectrum</span>
              <button
                type="button"
                onClick={() => handleShowSpectrumChange(!showSpectrumPref)}
                className={`rounded px-3 py-0.5 font-mono text-[8px] font-semibold transition-all border ${
                  showSpectrumPref
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 font-bold'
                    : 'border-stone-900 text-stone-400 bg-transparent'
                }`}
              >
                {showSpectrumPref ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </div>
      )}

      {arcProgress && (
        <div className="absolute left-0 right-0 top-0 h-[2px]">
          <div
            className="h-full transition-[width] duration-200 ease-linear"
            style={{
              width: `${arcProgress.progress * 100}%`,
              background: '#f59e0b',
            }}
          />
          {segmentBoundaries
            .filter((b) => b > 0 && b < 1)
            .map((b) => (
              <span
                key={b}
                className="absolute top-0 h-[3px] w-[3px] rounded-full"
                style={{
                  left: `${b * 100}%`,
                  background: '#78716c',
                  transform: 'translateX(-50%)',
                }}
              />
            ))}
        </div>
      )}

      <div
        className="absolute bottom-3 left-4 right-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em]"
        style={{ color: '#57534e' }}
      >
        <span className="flex items-center gap-2">
          <Circle
            size={6}
            fill={isPlaying ? '#f59e0b' : '#44403c'}
            stroke="none"
          />
          {arcProgress
            ? returning
              ? 'returning'
              : `${fmtRemaining(arcProgress.remainingSec)} left`
            : isPlaying
              ? 'sounding'
              : 'silent'}
        </span>
        <span>
          {params.density} partials · root {params.rootFreq.toFixed(0)} Hz (
          {getClosestNote(params.rootFreq)})
        </span>
      </div>
    </div>
  );
}
