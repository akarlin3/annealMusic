import { useEffect, useRef, useState } from 'react';
import { readRms } from '@/input/meter';

interface LevelMeterProps {
  getAnalyser: () => AnalyserNode | null;
}

const UPDATE_MS = 33; // ~30 Hz
const SEGMENTS = 16;
const CLIP_RMS = 0.95;
const PEAK_DECAY = 0.92;

/**
 * Horizontal LED-style input meter in warm amber. Reads RMS from the input
 * analyser ~30 Hz, holds a decaying peak indicator, and flashes a red clip
 * marker when RMS exceeds 0.95. Reflects the signal even when monitoring is off.
 */
export default function LevelMeter({ getAnalyser }: LevelMeterProps) {
  const [rms, setRms] = useState(0);
  const [peak, setPeak] = useState(0);
  const [clip, setClip] = useState(false);
  const peakRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const analyser = getAnalyser();
      if (!analyser) {
        setRms(0);
        return;
      }
      const level = Math.min(1, readRms(analyser) * 1.4); // headroom scaling
      setRms(level);
      peakRef.current = Math.max(level, peakRef.current * PEAK_DECAY);
      setPeak(peakRef.current);
      setClip(level >= CLIP_RMS);
    }, UPDATE_MS);
    return () => clearInterval(timer);
  }, [getAnalyser]);

  const litCount = Math.round(rms * SEGMENTS);
  const peakIndex = Math.min(SEGMENTS - 1, Math.round(peak * SEGMENTS));

  return (
    <div
      role="meter"
      aria-label="Input level"
      aria-valuenow={Math.round(rms * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="flex h-3 items-stretch gap-[2px]"
    >
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const lit = i < litCount;
        const isPeak = i === peakIndex && peak > 0;
        const hot = i >= SEGMENTS - 2; // top two segments tinge hotter
        let background = '#1c1917';
        if (lit || isPeak) {
          if (clip && hot) background = '#ef4444';
          else if (hot) background = '#fbbf24';
          else background = '#f59e0b';
        }
        return (
          <span
            key={i}
            className="flex-1 rounded-[1px] transition-colors"
            style={{
              background,
              opacity: lit || isPeak ? 1 : 0.55,
            }}
          />
        );
      })}
    </div>
  );
}
