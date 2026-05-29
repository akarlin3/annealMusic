import React from 'react';
import type { PieceSegment } from '@/piece/types';
import { PRESET_ARCS } from '@/session/arcs';

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

export const SegmentProperties: React.FC<SegmentPropertiesProps> = ({
  segment,
  onChange,
}) => {
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

  const handleConfigChange = (key: string, value: any) => {
    // eslint-disable-line @typescript-eslint/no-explicit-any
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
            <div className="grid grid-cols-4 gap-2">
              {(['fixed', 'arc', 'open', 'transition'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTypeChange(t)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border ${
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
                {PRESET_ARCS.map((arc: any) => (
                  <option key={arc.id} value={arc.id}>
                    {arc.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right Column: Param overrides (only for fixed and open segments) */}
        {(segment.type === 'fixed' || segment.type === 'open') && (
          <div className="space-y-4">
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

                return (
                  <div
                    key={p.key}
                    className="bg-white/5 border border-white/5 rounded-xl p-3 space-y-2"
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
                        <span className="text-xs font-mono text-teal-400">
                          {value.toFixed(p.step >= 1 ? 0 : 2)}
                          {p.suffix}
                        </span>
                      )}
                    </div>
                    {isOverridden && (
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
                        className="w-full accent-teal-500 bg-white/10 rounded-lg h-1.5 appearance-none cursor-pointer"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
