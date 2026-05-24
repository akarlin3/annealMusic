import { useEffect, useRef } from 'react';

interface WaveformThumbnailProps {
  buffer: AudioBuffer | null;
  height?: number;
  points?: number;
}

/** Downsample one channel to `points` peak magnitudes (0..1). */
function peaks(buffer: AudioBuffer, points: number): Float32Array {
  const data = buffer.getChannelData(0);
  const block = Math.max(1, Math.floor(data.length / points));
  const out = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    let max = 0;
    const start = i * block;
    for (let j = 0; j < block; j++) {
      const v = Math.abs(data[start + j] ?? 0);
      if (v > max) max = v;
    }
    out[i] = Math.min(1, max);
  }
  return out;
}

/**
 * A filled, vertically-mirrored waveform thumbnail of a captured buffer, in
 * muted amber. Purely presentational — repaints when the buffer changes.
 */
export default function WaveformThumbnail({
  buffer,
  height = 40,
  points = 150,
}: WaveformThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c2d = canvas.getContext('2d');
    if (!c2d) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));
    canvas.width = w;
    canvas.height = h;
    c2d.clearRect(0, 0, w, h);
    if (!buffer) return;

    const mags = peaks(buffer, points);
    const mid = h / 2;
    const barW = w / mags.length;
    c2d.fillStyle = 'rgba(245, 158, 11, 0.45)';
    for (let i = 0; i < mags.length; i++) {
      const amp = (mags[i] ?? 0) * mid * 0.92;
      const x = i * barW;
      c2d.fillRect(x, mid - amp, Math.max(1, barW - 0.5), amp * 2);
    }
  }, [buffer, height, points]);

  return (
    <canvas
      ref={canvasRef}
      className="block w-full"
      style={{ height }}
      aria-hidden="true"
    />
  );
}
