/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, useEffect, useState } from 'react';
import type { PieceSegment, VariationPoint } from '@/piece/types';
import { PRESET_ARCS } from '@/session/arcs';
import { generateMetaArc } from '@/piece/generators';
import { ArcRunner } from '@/session/ArcRunner';
import { engineCapabilities } from '@/audio/engines/index';
import type { Arc, ArcSegment } from '@/session/types';
import type { AnnealMusicParams } from '@/state/params';
import { VariationDialog } from '@/piece/components/VariationDialog';
import { Sparkles } from 'lucide-react';

interface SegmentPropertiesProps {
  segment: PieceSegment;
  onChange: (updated: PieceSegment) => void;
}

const OVERRIDE_PARAMS = [
  {
    key: 'rootFreq',
    label: 'Root Frequency',
    min: 40,
    max: 800,
    step: 1,
    suffix: 'Hz',
  },
  { key: 'spread', label: 'Spread', min: 1, max: 2, step: 0.01, suffix: '' },
  {
    key: 'brightness',
    label: 'Brightness',
    min: 0,
    max: 1,
    step: 0.01,
    suffix: '',
  },
  { key: 'space', label: 'Space', min: 0, max: 1, step: 0.01, suffix: '' },
  { key: 'drift', label: 'Drift', min: 0, max: 1, step: 0.01, suffix: '' },
  {
    key: 'coupling',
    label: 'Coupling',
    min: 0,
    max: 1,
    step: 0.01,
    suffix: '',
  },
];

const PARAM_COLORS: Record<string, string> = {
  rootFreq: '#22d3ee', // Cyan
  spread: '#14b8a6', // Teal
  brightness: '#a855f7', // Purple
  space: '#f97316', // Orange
  drift: '#84cc16', // Lime
  coupling: '#ec4899', // Pink
  density: '#eab308', // Yellow
};

export const SegmentProperties: React.FC<SegmentPropertiesProps> = ({
  segment,
  onChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [activeVpEdit, setActiveVpEdit] = useState<{
    paramKey: string;
    paramLabel: string;
    initialPoint?: VariationPoint;
    minVal: number;
    maxVal: number;
    stepVal: number;
  } | null>(null);

  const handleSaveVariation = (vp: VariationPoint) => {
    const vars = [...(segment.variations || [])].filter((v) => v.id !== vp.id);
    vars.push(vp);
    onChange({
      ...segment,
      variations: vars,
    });
    setActiveVpEdit(null);
  };

  const handleDeleteVariation = () => {
    if (!activeVpEdit) return;
    onChange({
      ...segment,
      variations: (segment.variations || []).filter(
        (v) => v.paramKey !== activeVpEdit.paramKey,
      ),
    });
    setActiveVpEdit(null);
  };

  const handleTypeChange = (type: PieceSegment['type']) => {
    const updated: PieceSegment = {
      ...segment,
      type,
      durationMs: type === 'open' ? null : segment.durationMs || 5000,
      config:
        type === 'transition'
          ? { easing: 'linear' }
          : type === 'arc'
            ? { arcId: 'bell' }
            : type === 'meta-arc'
              ? {
                  kind: 'random-walk',
                  seed: null,
                  randomWalk: {
                    params: ['rootFreq', 'brightness', 'space'],
                    driftStrength: 0.15,
                    meanReversion: 0.1,
                    steps: 20,
                    bounds: {
                      rootFreq: { min: 0.5, max: 1.5 },
                      brightness: { min: 0.3, max: 0.9 },
                      space: { min: 0.2, max: 0.8 },
                    },
                  },
                }
              : { params: {} },
    };
    onChange(updated);
  };

  const handleDurationChange = (ms: number) => {
    onChange({
      ...segment,
      durationMs: ms,
    });
  };

  const handleConfigChange = (key: string, value: unknown) => {
    onChange({
      ...segment,
      config: {
        ...segment.config,
        [key]: value,
      },
    });
  };

  const handleOverrideToggle = (paramKey: string, checked: boolean) => {
    const params = { ...(segment.config.params || {}) };
    if (checked) {
      params[paramKey] = params[paramKey] ?? 147; // default fallback
    } else {
      delete params[paramKey];
    }
    onChange({
      ...segment,
      config: {
        ...segment.config,
        params,
      },
    });
  };

  const handleOverrideValueChange = (paramKey: string, val: number) => {
    const params = { ...(segment.config.params || {}) };
    params[paramKey] = val;
    onChange({
      ...segment,
      config: {
        ...segment.config,
        params,
      },
    });
  };

  // Meta-Arc Helpers
  const handleMetaKindChange = (kind: string) => {
    const newConfig: Record<string, any> = {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      ...segment.config,
      kind,
    };

    if (kind === 'random-walk' && !newConfig.randomWalk) {
      newConfig.randomWalk = {
        params: ['rootFreq', 'brightness', 'space'],
        driftStrength: 0.15,
        meanReversion: 0.1,
        steps: 20,
        bounds: {
          rootFreq: { min: 0.5, max: 1.5 },
          brightness: { min: 0.3, max: 0.9 },
          space: { min: 0.2, max: 0.8 },
        },
      };
    } else if (kind === 'waypoint-tour' && !newConfig.waypointTour) {
      newConfig.waypointTour = {
        params: ['rootFreq', 'brightness', 'space'],
        waypointsCount: 5,
        maxDistance: 0.4,
        easing: 'easeInOut',
        bounds: {
          rootFreq: { min: 0.5, max: 1.5 },
          brightness: { min: 0.3, max: 0.9 },
          space: { min: 0.2, max: 0.8 },
        },
      };
    } else if (
      kind === 'bell-curve-variation' &&
      !newConfig.bellCurveVariation
    ) {
      newConfig.bellCurveVariation = {
        params: ['rootFreq', 'coupling', 'drift', 'space'],
        paramBounds: {
          rootFreq: { min: 0.6, max: 0.8 },
          coupling: { min: 1.1, max: 1.5 },
          drift: { min: 0.5, max: 0.7 },
          space: { min: 1.2, max: 1.6 },
        },
        minSettleFraction: 0.25,
        maxSettleFraction: 0.35,
        minHoldFraction: 0.25,
        maxHoldFraction: 0.35,
      };
    } else if (kind === 'spectral-evolution' && !newConfig.spectralEvolution) {
      newConfig.spectralEvolution = {
        rootBounds: { min: 0.6, max: 1.4 },
        densityBounds: { min: 0.5, max: 2.0 },
        brightnessBounds: { min: 0.3, max: 1.8 },
        coordinationType: 'inverse-crossover',
      };
    }

    onChange({
      ...segment,
      config: newConfig,
    });
  };

  const toggleSeedLock = () => {
    if (segment.config.seed !== null && segment.config.seed !== undefined) {
      handleConfigChange('seed', null);
    } else {
      const randomSeed = Math.floor(Math.random() * 1000000);
      handleConfigChange('seed', randomSeed);
    }
  };

  const reRollSeed = () => {
    const randomSeed = Math.floor(Math.random() * 1000000);
    handleConfigChange('seed', randomSeed);
  };

  // Render Real-time preview wave onto canvas
  useEffect(() => {
    if (segment.type !== 'meta-arc' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Draw grid background
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 40; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 30; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Generate Arc
    const kind = segment.config.kind || 'random-walk';
    const seed =
      segment.config.seed !== null && segment.config.seed !== undefined
        ? segment.config.seed
        : 4242;
    let arc: Arc;
    try {
      arc = generateMetaArc(kind, segment.config, seed);
    } catch (e) {
      console.warn('Preview generation failed', e);
      return;
    }

    // Setup ArcRunner
    const defaults = {
      rootFreq: 110,
      spread: 1.0,
      density: 6,
      coupling: 0.3,
      drift: 0.5,
      brightness: 0.5,
      space: 0.4,
      volume: 0.8,
    };
    const caps = engineCapabilities('sine');
    const runner = new ArcRunner(arc, 10, defaults as AnnealMusicParams, caps);

    // Simulate 100 points
    const points: Record<string, number[]> = {};
    const keys = arc.segments.reduce((acc: string[], s: ArcSegment) => {
      if (s.targets !== 'restoreStart') {
        Object.keys(s.targets).forEach((k) => {
          if (!acc.includes(k)) acc.push(k);
        });
      }
      return acc;
    }, []);

    keys.forEach((k: string) => {
      points[k] = [];
    });

    const STEPS_COUNT = 100;
    for (let step = 0; step <= STEPS_COUNT; step++) {
      const t = (step / STEPS_COUNT) * 10;
      const frame = runner.tick(t);
      keys.forEach((k: string) => {
        const val =
          frame.params[k as keyof typeof frame.params] ??
          defaults[k as keyof typeof defaults];
        points[k]!.push(val as number);
      });
    }

    // Plot curves
    keys.forEach((k: string) => {
      const color = PARAM_COLORS[k] || '#ffffff';
      const vals = points[k]!;
      if (vals.length === 0) return;

      // Find bounds for normalization
      let minVal = Math.min(...vals);
      let maxVal = Math.max(...vals);
      if (maxVal === minVal) {
        maxVal = minVal + 1.0;
        minVal = minVal - 1.0;
      }
      const range = maxVal - minVal;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();

      vals.forEach((v, index) => {
        const posX = (index / STEPS_COUNT) * (width - 60) + 15;
        const posY = height - (((v - minVal) / range) * (height - 40) + 20);
        if (index === 0) {
          ctx.moveTo(posX, posY);
        } else {
          ctx.lineTo(posX, posY);
        }
      });
      ctx.stroke();
    });

    // Reset shadow
    ctx.shadowBlur = 0;
  }, [segment]);

  return (
    <div className="bg-[#121016]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6 text-white">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white/90">
            Segment Configuration
          </h3>
          <p className="text-xs text-white/40">
            Adjust rules and audio behavior for this timeline block.
          </p>
        </div>
        <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-semibold uppercase tracking-wider text-teal-400">
          Position {segment.position + 1}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Core properties */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
              Segment Type
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {(
                ['fixed', 'arc', 'open', 'transition', 'meta-arc'] as const
              ).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTypeChange(t)}
                  className={`py-2 px-1 rounded-xl text-[10px] font-bold transition-all border ${
                    segment.type === t
                      ? 'bg-teal-500/20 border-teal-500/50 text-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.15)]'
                      : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 text-white/60'
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {segment.type !== 'open' && (
            <div>
              <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
                Duration (Seconds)
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={Math.round((segment.durationMs || 5000) / 1000)}
                  onChange={(e) =>
                    handleDurationChange(Number(e.target.value) * 1000)
                  }
                  className="flex-1 accent-teal-500 bg-white/10 rounded-lg h-2 appearance-none cursor-pointer"
                />
                <span className="bg-white/5 border border-white/10 px-3 py-1 rounded-xl font-mono text-sm w-16 text-center">
                  {Math.round((segment.durationMs || 5000) / 1000)}s
                </span>
              </div>
            </div>
          )}

          {segment.type === 'transition' && (
            <div>
              <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
                Easing Curve
              </label>
              <select
                value={segment.config.easing || 'linear'}
                onChange={(e) => handleConfigChange('easing', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 focus:outline-none focus:border-teal-500 transition"
              >
                <option value="linear">Linear</option>
                <option value="easeInOut">Ease In Out (Smooth)</option>
                <option value="exponential">Exponential (Steep)</option>
              </select>
            </div>
          )}

          {segment.type === 'arc' && (
            <div>
              <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
                Select Arc Preset
              </label>
              <select
                value={segment.config.arcId || 'bell'}
                onChange={(e) => handleConfigChange('arcId', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 focus:outline-none focus:border-teal-500 transition"
              >
                {PRESET_ARCS.map((arc: Arc) => (
                  <option key={arc.id} value={arc.id}>
                    {arc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Meta-Arc UI Controllers */}
          {segment.type === 'meta-arc' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
                  Meta-Arc Generator Kind
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'random-walk', label: 'Random Walk' },
                    { id: 'waypoint-tour', label: 'Waypoint Tour' },
                    { id: 'bell-curve-variation', label: 'Bell Curve Var' },
                    { id: 'spectral-evolution', label: 'Spectral Evol' },
                  ].map((kind) => (
                    <button
                      key={kind.id}
                      onClick={() => handleMetaKindChange(kind.id)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border ${
                        (segment.config.kind || 'random-walk') === kind.id
                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                          : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 text-white/60'
                      }`}
                    >
                      {kind.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Seed Lock Controls */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white/90">
                      Seed Control
                    </h4>
                    <p className="text-[10px] text-white/40">
                      Lock seed for deterministic playback.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={toggleSeedLock}
                      className={`p-2 rounded-xl border transition-all ${
                        segment.config.seed !== null &&
                        segment.config.seed !== undefined
                          ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                          : 'bg-white/5 border-white/10 text-white/60'
                      }`}
                      title={
                        segment.config.seed !== null &&
                        segment.config.seed !== undefined
                          ? 'Unlock Generation'
                          : 'Lock Generation'
                      }
                    >
                      {segment.config.seed !== null &&
                      segment.config.seed !== undefined
                        ? '🔒 Locked'
                        : '🔓 Dynamic'}
                    </button>
                    {segment.config.seed !== null &&
                      segment.config.seed !== undefined && (
                        <button
                          onClick={reRollSeed}
                          className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-white/80 text-xs transition"
                          title="Re-roll seed"
                        >
                          🎲 Re-roll
                        </button>
                      )}
                  </div>
                </div>
                {segment.config.seed !== null &&
                  segment.config.seed !== undefined && (
                    <div className="bg-black/20 rounded-xl px-3 py-1.5 border border-white/5 text-center">
                      <span className="font-mono text-xs text-white/60">
                        Seed: {segment.config.seed}
                      </span>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Param overrides or Meta-Arc Kind settings */}
        <div className="space-y-4">
          {(segment.type === 'fixed' || segment.type === 'open') && (
            <>
              <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider">
                Parameter Overrides
              </h4>
              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                {OVERRIDE_PARAMS.map((p) => {
                  const isOverridden =
                    segment.config.params?.[p.key] !== undefined;
                  const value = isOverridden
                    ? segment.config.params[p.key]
                    : p.min;

                  const vp = segment.variations?.find(
                    (v) => v.paramKey === p.key,
                  );
                  const isVaried = !!vp;

                  const rangeBounds = vp
                    ? (() => {
                        const c = vp.constraint;
                        const paramRange = p.max - p.min;
                        if (paramRange <= 0) return null;
                        let leftVal = value;
                        let rightVal = value;
                        if (c.type === 'range') {
                          leftVal = c.min ?? p.min;
                          rightVal = c.max ?? p.max;
                        } else if (c.type === 'relative') {
                          const pct = c.percent ?? 15;
                          leftVal = value * (1 - pct / 100);
                          rightVal = value * (1 + pct / 100);
                        } else {
                          return null;
                        }
                        const leftPct = Math.max(
                          0,
                          Math.min(100, ((leftVal - p.min) / paramRange) * 100),
                        );
                        const rightPct = Math.max(
                          0,
                          Math.min(
                            100,
                            ((rightVal - p.min) / paramRange) * 100,
                          ),
                        );
                        return { left: leftPct, width: rightPct - leftPct };
                      })()
                    : null;

                  return (
                    <div
                      key={p.key}
                      className="bg-white/5 border border-white/5 rounded-xl p-3 space-y-2 relative group/slider"
                    >
                      <div className="flex items-center justify-between">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isOverridden}
                            onChange={(e) =>
                              handleOverrideToggle(p.key, e.target.checked)
                            }
                            className="rounded border-white/10 text-teal-600 focus:ring-teal-500 accent-teal-500 bg-white/5"
                          />
                          <span
                            className={`text-xs font-semibold ${isOverridden ? 'text-white/90' : 'text-white/40'}`}
                          >
                            {p.label}
                          </span>
                        </label>

                        {isOverridden && (
                          <div className="flex items-center gap-2">
                            {/* Hover Vary Button */}
                            <button
                              onClick={() =>
                                setActiveVpEdit({
                                  paramKey: p.key,
                                  paramLabel: p.label,
                                  initialPoint: vp,
                                  minVal: p.min,
                                  maxVal: p.max,
                                  stepVal: p.step,
                                })
                              }
                              className={`opacity-0 group-hover/slider:opacity-100 transition-opacity flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${
                                isVaried
                                  ? 'bg-[#eab308]/20 border-[#eab308]/40 text-[#eab308]'
                                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                              }`}
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                              {isVaried ? 'Varied' : 'Vary'}
                            </button>

                            <span className="text-xs font-mono text-teal-400">
                              {value.toFixed(p.step >= 1 ? 0 : 2)}
                              {p.suffix}
                            </span>
                          </div>
                        )}
                      </div>

                      {isOverridden && (
                        <div className="relative w-full py-2">
                          {/* Glowing Range Band */}
                          {rangeBounds && (
                            <div
                              style={{
                                left: `${rangeBounds.left}%`,
                                width: `${rangeBounds.width}%`,
                              }}
                              className="absolute top-1/2 -translate-y-1/2 h-1 bg-[#eab308]/20 border-l border-r border-[#eab308]/50 rounded-full"
                            />
                          )}

                          {/* Slider dot if varied but not continuous range */}
                          {isVaried && !rangeBounds && (
                            <div
                              style={{ left: '50%' }}
                              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-[#eab308] rounded-full shadow-[0_0_8px_#eab308] z-10"
                            />
                          )}

                          <input
                            type="range"
                            min={p.min}
                            max={p.max}
                            step={p.step}
                            value={value}
                            onChange={(e) =>
                              handleOverrideValueChange(
                                p.key,
                                Number(e.target.value),
                              )
                            }
                            className={`w-full accent-teal-500 bg-white/10 rounded-lg h-1.5 appearance-none cursor-pointer relative z-10 ${
                              isVaried
                                ? 'accent-[#eab308] shadow-[0_0_8px_rgba(234,179,8,0.3)]'
                                : ''
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Meta-Arc Parameter Controls */}
          {segment.type === 'meta-arc' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider">
                Procedural Generator Parameters
              </h4>

              {/* Random Walk Configuration */}
              {(segment.config.kind || 'random-walk') === 'random-walk' &&
                segment.config.randomWalk && (
                  <div className="space-y-3 bg-white/5 border border-white/5 rounded-2xl p-4">
                    <div>
                      <label className="flex items-center justify-between text-xs font-semibold text-white/70 mb-1">
                        <span>Drift Strength (Noise)</span>
                        <span className="font-mono text-teal-400">
                          {segment.config.randomWalk.driftStrength.toFixed(2)}
                        </span>
                      </label>
                      <input
                        type="range"
                        min="0.01"
                        max="0.5"
                        step="0.01"
                        value={segment.config.randomWalk.driftStrength}
                        onChange={(e) => {
                          const rw = {
                            ...segment.config.randomWalk,
                            driftStrength: Number(e.target.value),
                          };
                          handleConfigChange('randomWalk', rw);
                        }}
                        className="w-full accent-teal-500 bg-white/10 rounded-lg h-1.5 appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="flex items-center justify-between text-xs font-semibold text-white/70 mb-1">
                        <span>Mean Reversion (Pull)</span>
                        <span className="font-mono text-teal-400">
                          {segment.config.randomWalk.meanReversion.toFixed(2)}
                        </span>
                      </label>
                      <input
                        type="range"
                        min="0.0"
                        max="0.5"
                        step="0.01"
                        value={segment.config.randomWalk.meanReversion}
                        onChange={(e) => {
                          const rw = {
                            ...segment.config.randomWalk,
                            meanReversion: Number(e.target.value),
                          };
                          handleConfigChange('randomWalk', rw);
                        }}
                        className="w-full accent-teal-500 bg-white/10 rounded-lg h-1.5 appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="flex items-center justify-between text-xs font-semibold text-white/70 mb-1">
                        <span>Walk Steps (Fractions)</span>
                        <span className="font-mono text-teal-400">
                          {segment.config.randomWalk.steps}
                        </span>
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        step="1"
                        value={segment.config.randomWalk.steps}
                        onChange={(e) => {
                          const rw = {
                            ...segment.config.randomWalk,
                            steps: Number(e.target.value),
                          };
                          handleConfigChange('randomWalk', rw);
                        }}
                        className="w-full accent-teal-500 bg-white/10 rounded-lg h-1.5 appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                )}

              {/* Waypoint Tour Configuration */}
              {segment.config.kind === 'waypoint-tour' &&
                segment.config.waypointTour && (
                  <div className="space-y-3 bg-white/5 border border-white/5 rounded-2xl p-4">
                    <div>
                      <label className="flex items-center justify-between text-xs font-semibold text-white/70 mb-1">
                        <span>Waypoints Count</span>
                        <span className="font-mono text-teal-400">
                          {segment.config.waypointTour.waypointsCount}
                        </span>
                      </label>
                      <input
                        type="range"
                        min="3"
                        max="10"
                        step="1"
                        value={segment.config.waypointTour.waypointsCount}
                        onChange={(e) => {
                          const wt = {
                            ...segment.config.waypointTour,
                            waypointsCount: Number(e.target.value),
                          };
                          handleConfigChange('waypointTour', wt);
                        }}
                        className="w-full accent-teal-500 bg-white/10 rounded-lg h-1.5 appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="flex items-center justify-between text-xs font-semibold text-white/70 mb-1">
                        <span>Max Waypoint Distance</span>
                        <span className="font-mono text-teal-400">
                          {segment.config.waypointTour.maxDistance.toFixed(2)}
                        </span>
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={segment.config.waypointTour.maxDistance}
                        onChange={(e) => {
                          const wt = {
                            ...segment.config.waypointTour,
                            maxDistance: Number(e.target.value),
                          };
                          handleConfigChange('waypointTour', wt);
                        }}
                        className="w-full accent-teal-500 bg-white/10 rounded-lg h-1.5 appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
                        Interpolation Easing
                      </label>
                      <select
                        value={
                          segment.config.waypointTour.easing || 'easeInOut'
                        }
                        onChange={(e) => {
                          const wt = {
                            ...segment.config.waypointTour,
                            easing: e.target.value,
                          };
                          handleConfigChange('waypointTour', wt);
                        }}
                        className="w-full bg-[#121016] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-teal-500 transition"
                      >
                        <option value="linear">Linear</option>
                        <option value="easeInOut">Ease In Out (Smooth)</option>
                        <option value="exponential">Exponential (Steep)</option>
                      </select>
                    </div>
                  </div>
                )}

              {/* Bell Curve Variation Configuration */}
              {segment.config.kind === 'bell-curve-variation' &&
                segment.config.bellCurveVariation && (
                  <div className="space-y-3 bg-white/5 border border-white/5 rounded-2xl p-4">
                    <div className="flex items-center justify-between text-xs text-white/70 border-b border-white/5 pb-2 mb-2">
                      <span>Generates randomized settle & hold durations</span>
                    </div>
                    <div>
                      <label className="flex items-center justify-between text-xs font-semibold text-white/70 mb-1">
                        <span>Min Settle Fraction</span>
                        <span className="font-mono text-teal-400">
                          {segment.config.bellCurveVariation.minSettleFraction.toFixed(
                            2,
                          )}
                        </span>
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="0.4"
                        step="0.05"
                        value={
                          segment.config.bellCurveVariation.minSettleFraction
                        }
                        onChange={(e) => {
                          const bc = {
                            ...segment.config.bellCurveVariation,
                            minSettleFraction: Number(e.target.value),
                          };
                          handleConfigChange('bellCurveVariation', bc);
                        }}
                        className="w-full accent-teal-500 bg-white/10 rounded-lg h-1.5 appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="flex items-center justify-between text-xs font-semibold text-white/70 mb-1">
                        <span>Min Hold Fraction</span>
                        <span className="font-mono text-teal-400">
                          {segment.config.bellCurveVariation.minHoldFraction.toFixed(
                            2,
                          )}
                        </span>
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="0.4"
                        step="0.05"
                        value={
                          segment.config.bellCurveVariation.minHoldFraction
                        }
                        onChange={(e) => {
                          const bc = {
                            ...segment.config.bellCurveVariation,
                            minHoldFraction: Number(e.target.value),
                          };
                          handleConfigChange('bellCurveVariation', bc);
                        }}
                        className="w-full accent-teal-500 bg-white/10 rounded-lg h-1.5 appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                )}

              {/* Spectral Evolution Configuration */}
              {segment.config.kind === 'spectral-evolution' &&
                segment.config.spectralEvolution && (
                  <div className="space-y-3 bg-white/5 border border-white/5 rounded-2xl p-4">
                    <div>
                      <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
                        Spectral Coordination Style
                      </label>
                      <select
                        value={
                          segment.config.spectralEvolution.coordinationType ||
                          'inverse-crossover'
                        }
                        onChange={(e) => {
                          const se = {
                            ...segment.config.spectralEvolution,
                            coordinationType: e.target.value,
                          };
                          handleConfigChange('spectralEvolution', se);
                        }}
                        className="w-full bg-[#121016] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-teal-500 transition"
                      >
                        <option value="inverse-crossover">
                          Inverse Crossover (Spectral Crossover)
                        </option>
                        <option value="parallel-sweep">
                          Parallel Sweep (Sweep Pitch/Noise)
                        </option>
                      </select>
                    </div>
                  </div>
                )}

              {/* Live Preview Wave Canvas */}
              <div className="bg-black/40 border border-white/10 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                    Procedural Shape Preview
                  </h4>
                  <span className="text-[9px] text-white/30 italic">
                    Normalized 10s simulation
                  </span>
                </div>
                <div className="relative bg-[#09080c] rounded-xl overflow-hidden border border-white/5 flex items-center justify-center">
                  <canvas
                    ref={canvasRef}
                    width={280}
                    height={120}
                    className="w-full h-[120px] block"
                  />
                </div>
                <div className="flex flex-wrap gap-2 text-[9px] text-white/60 pt-1">
                  {segment.config.kind === 'spectral-evolution' ? (
                    <>
                      <span className="flex items-center gap-1">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: PARAM_COLORS.rootFreq }}
                        />{' '}
                        Root
                      </span>
                      <span className="flex items-center gap-1">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: PARAM_COLORS.brightness }}
                        />{' '}
                        Brightness
                      </span>
                      <span className="flex items-center gap-1">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: PARAM_COLORS.density }}
                        />{' '}
                        Density
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-1">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: PARAM_COLORS.rootFreq }}
                        />{' '}
                        Root
                      </span>
                      <span className="flex items-center gap-1">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: PARAM_COLORS.brightness }}
                        />{' '}
                        Brightness
                      </span>
                      <span className="flex items-center gap-1">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: PARAM_COLORS.space }}
                        />{' '}
                        Space
                      </span>
                      {segment.config.kind === 'bell-curve-variation' && (
                        <>
                          <span className="flex items-center gap-1">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: PARAM_COLORS.drift }}
                            />{' '}
                            Drift
                          </span>
                          <span className="flex items-center gap-1">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: PARAM_COLORS.coupling }}
                            />{' '}
                            Coupling
                          </span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeVpEdit && (
        <VariationDialog
          isOpen={true}
          onClose={() => setActiveVpEdit(null)}
          paramKey={activeVpEdit.paramKey}
          paramLabel={activeVpEdit.paramLabel}
          initialPoint={activeVpEdit.initialPoint}
          minVal={activeVpEdit.minVal}
          maxVal={activeVpEdit.maxVal}
          stepVal={activeVpEdit.stepVal}
          onSave={handleSaveVariation}
          onDelete={handleDeleteVariation}
        />
      )}
    </div>
  );
};
