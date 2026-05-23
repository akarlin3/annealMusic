import { useEffect, useRef } from 'react';
import { Circle } from 'lucide-react';
import type { AnnealMusicEngine } from '@/audio/AnnealMusicEngine';
import { drawFrame, type DrawState } from '@/visual/draw';
import { HARMONICS } from '@/types/audio';
import { useParamStore } from '@/state/params';

interface VisualizerProps {
  engineRef: React.MutableRefObject<AnnealMusicEngine | null>;
  isPlaying: boolean;
}

export default function Visualizer({ engineRef, isPlaying }: VisualizerProps) {
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
          {isPlaying ? 'sounding' : 'silent'}
        </span>
        <span>
          {params.density} partials · root {params.rootFreq.toFixed(0)} Hz
        </span>
      </div>
    </div>
  );
}
