import { useEffect, useRef } from 'react';
import { Circle } from 'lucide-react';
import type { ArcProgress, Orchestrator } from '@/audio/orchestrator';
import { drawFrame, type DrawState } from '@/visual/draw';
import { readRms } from '@/input/meter';
import { HARMONICS } from '@/types/audio';
import { useParamStore } from '@/state/params';

interface VisualizerProps {
  engineRef: React.MutableRefObject<Orchestrator | null>;
  isPlaying: boolean;
  /** Live arc progress (top bar + remaining-time readout); null in open mode. */
  arcProgress?: ArcProgress | null;
  /** Cumulative segment boundary fractions (0..1) for marker dots. */
  segmentBoundaries?: number[];
  /** True during the final settle fade of an arc — shows a RETURNING label. */
  returning?: boolean;
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
}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phasesRef = useRef<number[]>(
    HARMONICS.map(() => Math.random() * Math.PI * 2),
  );
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c2d = canvas.getContext('2d');
    if (!c2d) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: rect.width, h: rect.height };
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let lastT = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const { w, h } = sizeRef.current;

      const engine = engineRef.current;
      const analyser = engine?.getAnalyser() ?? null;

      let spectrum: Uint8Array<ArrayBuffer> | null = null;
      let sampleRate = 48000;
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

      const params = useParamStore.getState().params;
      const engineFreqs = engine?.getPartialFrequencies() ?? [];
      const count = engineFreqs.length || params.density;
      const freqs: number[] = [];
      for (let i = 0; i < count; i++) {
        const ratio = HARMONICS[i] ?? 1;
        freqs.push(engineFreqs[i] ?? params.rootFreq * ratio);
      }

      const state: DrawState = {
        w,
        h,
        dt,
        phases: phasesRef.current,
        freqs,
        count,
        spectrum,
        sampleRate,
        fftSize,
        inputLevel,
      };
      drawFrame(c2d, state);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, [engineRef]);

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
          {params.density} partials · root {params.rootFreq.toFixed(0)} Hz
        </span>
      </div>
    </div>
  );
}
