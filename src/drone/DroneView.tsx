/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect } from 'react';
import { useParamStore, getClosestNote } from '@/state/params';
import Visualizer from '@/components/Visualizer';
import { DRONE_ENGINES } from '@/drone/droneEngines';
import { ENGINE_LABELS } from '@/audio/engines/index';
import InfoTip from '@/components/InfoTip';
import type { EngineId } from '@/audio/engines/types';

interface DroneViewProps {
  engineRef: React.MutableRefObject<any>;
  isPlaying: boolean;
}

export default function DroneView({ engineRef, isPlaying }: DroneViewProps) {
  const {
    params,
    engineId,
    tuning,
    customScales,
    setParam,
    setEngine,
    setEngineParam,
    setTuning,
  } = useParamStore();

  // Enforce engine-specific sub-models for Drone mode if granular or physical is active
  useEffect(() => {
    if (engineId === 'physical') {
      setEngineParam('physical', 'model', 0); // Default to continuous string
    } else if (engineId === 'granular') {
      setEngineParam('granular', 'source', 0); // Default to glass pad
    }
  }, [engineId, setEngineParam]);

  const handleFundamentalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setParam('rootFreq', val);
    },
    [setParam],
  );

  const handleBrightnessChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setParam('brightness', val);
    },
    [setParam],
  );

  const handleDensityChange = useCallback(
    (density: number) => {
      setParam('density', density);
    },
    [setParam],
  );

  const handleEngineChange = useCallback(
    (id: EngineId) => {
      setEngine(id);
    },
    [setEngine],
  );

  const handleTuningChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val.startsWith('custom:')) {
      const sclId = val.slice(7);
      setTuning({
        system: 'custom',
        sclId,
        referenceA4Hz: tuning.referenceA4Hz,
      });
    } else {
      setTuning({ system: val as any, referenceA4Hz: tuning.referenceA4Hz });
    }
  };

  const currentNote = getClosestNote(params.rootFreq);

  return (
    <div className="flex flex-col items-center justify-center py-6 text-[#f5f5f4]">
      {/* 1. Immersive Centerpiece Visualizer */}
      <div className="relative w-full max-w-xl aspect-square flex items-center justify-center rounded-full overflow-hidden bg-radial-gradient from-stone-900/40 to-transparent">
        <Visualizer engineRef={engineRef} isPlaying={isPlaying} isCalm={true} />

        {/* Large Root Note Indicator in Center overlay */}
        <div className="absolute flex flex-col items-center justify-center pointer-events-none select-none text-center animate-pulse duration-[3000ms]">
          <span className="font-display text-8xl md:text-9xl font-extralight tracking-tighter text-[#fef3c7] opacity-80 filter drop-shadow-[0_0_20px_rgba(245,158,11,0.25)]">
            {currentNote}
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-[#a8a29e] opacity-60 mt-2">
            {params.rootFreq.toFixed(0)} Hz fundamental
          </span>
        </div>
      </div>

      {/* 2. Constrained Drone Control Surface */}
      <div className="w-full max-w-lg mt-10 rounded-2xl border border-stone-850 bg-stone-950/20 p-6 md:p-8 backdrop-blur-md">
        {/* Compact Pickers: Engine & Tuning */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mb-8 border-b border-stone-850 pb-6">
          {/* Curated Engine Selector */}
          <div>
            <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-[#78716c]">
              Drone Soundscape
            </label>
            <div className="flex gap-1.5 p-1 rounded-full border border-stone-850 bg-[#0d0c0b]/40">
              {DRONE_ENGINES.map((id) => {
                const active = id === engineId;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleEngineChange(id)}
                    className="flex-1 rounded-full py-1 text-center font-mono text-[10px] uppercase tracking-wider transition-all"
                    style={{
                      background: active ? '#f59e0b' : 'transparent',
                      color: active ? '#0c0a09' : '#a8a29e',
                    }}
                  >
                    {ENGINE_LABELS[id]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tuning Selector */}
          <div>
            <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-[#78716c]">
              Tuning Lattice
            </label>
            <select
              value={
                tuning.system === 'custom'
                  ? `custom:${tuning.sclId}`
                  : tuning.system
              }
              onChange={handleTuningChange}
              className="w-full h-8 rounded-full border border-stone-850 bg-[#0d0c0b]/40 px-4 text-xs font-mono text-[#e7e5e4] transition-all focus:border-[#fbbf24] focus:outline-none"
            >
              <option value="equal">Equal Temperament</option>
              <option value="just-5">Just Intonation (5-limit)</option>
              <option value="just-7">Just Intonation (7-limit)</option>
              <option value="pythagorean">Pythagorean</option>
              <option value="solfeggio">Solfeggio Frequencies</option>
              <option value="werckmeister3">Werckmeister III</option>
              {customScales.map((s) => (
                <option key={s.id} value={`custom:${s.id}`}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sliders: Exactly Three Controls */}
        <div className="space-y-6">
          {/* Slider 1: Fundamental Pitch */}
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#a8a29e]">
                  Fundamental Pitch
                </span>
                <InfoTip id="drone.fundamental" label="Fundamental Pitch" />
              </span>
              <span className="font-mono text-xs text-[#fbbf24] tabular-nums">
                {params.rootFreq.toFixed(0)} Hz
              </span>
            </div>
            <input
              type="range"
              className="am-range"
              min="50"
              max="220"
              step="1"
              value={params.rootFreq}
              onChange={handleFundamentalChange}
            />
            <div className="mt-1 flex justify-between text-[9px] font-mono text-[#57534e]">
              <span>Sub-Bass (50 Hz)</span>
              <span>Low Tenor (220 Hz)</span>
            </div>
          </div>

          {/* Slider 2: Density Segmented Buttons */}
          <div>
            <div className="mb-2.5 flex items-baseline justify-between">
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#a8a29e]">
                  Lattice Density
                </span>
                <InfoTip id="drone.density" label="Lattice Density" />
              </span>
              <span className="font-mono text-xs text-[#fbbf24]">
                {params.density === 1
                  ? 'Pure Root'
                  : `${params.density} Partials`}
              </span>
            </div>
            <div className="flex gap-2.5">
              {[1, 3, 5].map((d) => {
                const active = params.density === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleDensityChange(d)}
                    className="flex-1 rounded-lg py-2 text-center transition-all border font-mono text-xs uppercase tracking-wider"
                    style={{
                      background: active
                        ? 'rgba(245, 158, 11, 0.1)'
                        : 'transparent',
                      borderColor: active ? '#f59e0b' : '#44403c',
                      color: active ? '#fbbf24' : '#78716c',
                    }}
                  >
                    {d === 1 ? '1 (Pure)' : `${d} Partials`}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-[9px] font-mono text-[#57534e] text-center leading-relaxed">
              Fewer partials stays clean and focused; higher partials adds rich
              resonant overtones.
            </div>
          </div>

          {/* Slider 3: Brightness */}
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#a8a29e]">
                  Brightness
                </span>
                <InfoTip id="drone.brightness" label="Brightness" />
              </span>
              <span className="font-mono text-xs text-[#fbbf24] tabular-nums">
                {(params.brightness * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              className="am-range"
              min="0"
              max="1"
              step="0.01"
              value={params.brightness}
              onChange={handleBrightnessChange}
            />
            <div className="mt-1 flex justify-between text-[9px] font-mono text-[#57534e]">
              <span>Warm / Muted</span>
              <span>Open / Bright</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
