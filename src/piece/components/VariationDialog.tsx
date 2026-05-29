/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import type { VariationPoint } from '@/piece/types';
import { X, Check, Trash2 } from 'lucide-react';
import { CONTROL_DEFS } from '@/state/params';

interface VariationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  paramKey: string;
  paramLabel: string;
  initialPoint?: VariationPoint;
  onSave: (vp: VariationPoint) => void;
  onDelete?: () => void;
  minVal: number;
  maxVal: number;
  stepVal: number;
}

export const VariationDialog: React.FC<VariationDialogProps> = ({
  isOpen,
  onClose,
  paramKey,
  paramLabel,
  initialPoint,
  onSave,
  onDelete,
  minVal,
  maxVal,
  stepVal,
}) => {
  const [constraintType, setConstraintType] = useState<
    'range' | 'enum' | 'relative' | 'correlated'
  >('range');

  // Constraint configuration states
  const [min, setMin] = useState(minVal);
  const [max, setMax] = useState(maxVal);
  const [enumChoices, setEnumChoices] = useState('');
  const [relativePercent, setRelativePercent] = useState(15);
  const [targetParam, setTargetParam] = useState('brightness');
  const [coefficient, setCoefficient] = useState(1.0);

  const [rule, setRule] = useState<'per-play' | 'per-segment' | 'per-render'>(
    'per-play',
  );

  // Populate from initialPoint if editing
  useEffect(() => {
    if (initialPoint) {
      setConstraintType(initialPoint.constraint.type);
      setRule(initialPoint.rule);
      const c = initialPoint.constraint;
      if (c.type === 'range') {
        setMin(c.min ?? minVal);
        setMax(c.max ?? maxVal);
      } else if (c.type === 'enum') {
        setEnumChoices((c.choices ?? []).join(', '));
      } else if (c.type === 'relative') {
        setRelativePercent(c.percent ?? 15);
      } else if (c.type === 'correlated') {
        setTargetParam(c.targetParam ?? 'brightness');
        setCoefficient(c.coefficient ?? 1.0);
      }
    } else {
      // Defaults
      setConstraintType('range');
      setRule('per-play');
      setMin(minVal);
      setMax(maxVal);
      setEnumChoices('');
      setRelativePercent(15);
      setTargetParam(
        CONTROL_DEFS.find((d) => d.key !== paramKey)?.key || 'brightness',
      );
      setCoefficient(1.0);
    }
  }, [initialPoint, paramKey, minVal, maxVal]);

  if (!isOpen) return null;

  const handleSave = () => {
    const constraint: any = { type: constraintType };
    if (constraintType === 'range') {
      constraint.min = Number(min);
      constraint.max = Number(max);
    } else if (constraintType === 'enum') {
      constraint.choices = enumChoices
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n));
    } else if (constraintType === 'relative') {
      constraint.percent = Number(relativePercent);
    } else if (constraintType === 'correlated') {
      constraint.targetParam = targetParam;
      constraint.coefficient = Number(coefficient);
    }

    onSave({
      id: initialPoint?.id || `vp-${paramKey}-${Date.now().toString(36)}`,
      paramKey,
      constraint,
      rule,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fadeIn">
      {/* Dialog body */}
      <div className="bg-[#14121a]/95 border border-[#eab308]/30 w-full max-w-lg p-6 rounded-3xl shadow-[0_0_50px_rgba(234,179,8,0.1)] text-white space-y-6 relative overflow-hidden transition-all duration-300 transform scale-100">
        {/* Glow backdrop decorator */}
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-[#eab308]/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-teal-500/5 blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4 relative z-10">
          <div>
            <h3 className="text-lg font-black uppercase tracking-wider text-[#eab308]">
              Configure Variation Rule
            </h3>
            <p className="text-[11px] text-white/50 font-mono mt-0.5">
              Parameter: <span className="text-teal-400">{paramLabel}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form controls */}
        <div className="space-y-5 relative z-10">
          {/* Tab selector for Constraint Type */}
          <div>
            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest font-mono mb-2">
              Constraint Type
            </label>
            <div className="grid grid-cols-4 gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
              {(['range', 'enum', 'relative', 'correlated'] as const).map(
                (t) => (
                  <button
                    key={t}
                    onClick={() => setConstraintType(t)}
                    className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
                      constraintType === t
                        ? 'bg-[#eab308] text-[#14121a] font-black shadow-lg shadow-[#eab308]/20'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {t}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Conditional inputs based on constraint selection */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 min-h-[120px] flex flex-col justify-center">
            {constraintType === 'range' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                      Minimum Bound
                    </label>
                    <input
                      type="number"
                      min={minVal}
                      max={max}
                      step={stepVal}
                      value={min}
                      onChange={(e) => setMin(Number(e.target.value))}
                      className="w-full bg-[#0e0c12] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-center focus:outline-none focus:border-[#eab308]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                      Maximum Bound
                    </label>
                    <input
                      type="number"
                      min={min}
                      max={maxVal}
                      step={stepVal}
                      value={max}
                      onChange={(e) => setMax(Number(e.target.value))}
                      className="w-full bg-[#0e0c12] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-center focus:outline-none focus:border-[#eab308]"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-white/30 text-center font-mono">
                  Safe limits: [{minVal} .. {maxVal}]
                </p>
              </div>
            )}

            {constraintType === 'enum' && (
              <div className="space-y-2">
                <label className="block text-[9px] font-bold text-white/40 uppercase tracking-wider">
                  Discrete Choices (Comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 110, 220, 440"
                  value={enumChoices}
                  onChange={(e) => setEnumChoices(e.target.value)}
                  className="w-full bg-[#0e0c12] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono placeholder-white/20 focus:outline-none focus:border-[#eab308]"
                />
                <p className="text-[9px] text-white/30 font-mono">
                  Composers define exact discrete values to choose from.
                </p>
              </div>
            )}

            {constraintType === 'relative' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-white/40">Percentage Deviation</span>
                  <span className="text-[#eab308] font-bold">
                    ±{relativePercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={relativePercent}
                  onChange={(e) => setRelativePercent(Number(e.target.value))}
                  className="w-full accent-[#eab308] bg-white/10 rounded-lg h-2 appearance-none cursor-pointer"
                />
                <p className="text-[9px] text-white/30 font-mono text-center">
                  Varies proportionally around the baseline parameter value.
                </p>
              </div>
            )}

            {constraintType === 'correlated' && (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-[2]">
                    <label className="block text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                      Target Parameter
                    </label>
                    <select
                      value={targetParam}
                      onChange={(e) => setTargetParam(e.target.value)}
                      className="w-full bg-[#0e0c12] border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#eab308]"
                    >
                      {CONTROL_DEFS.filter((d) => d.key !== paramKey).map(
                        (d) => (
                          <option key={d.key} value={d.key}>
                            {d.label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                      Coefficient
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="-2.0"
                      max="2.0"
                      value={coefficient}
                      onChange={(e) => setCoefficient(Number(e.target.value))}
                      className="w-full bg-[#0e0c12] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-center focus:outline-none focus:border-[#eab308]"
                    />
                  </div>
                </div>
                <p className="text-[9px] text-white/30 font-mono text-center">
                  Negative coefficient creates inverse correlation; positive
                  creates parallel sweep.
                </p>
              </div>
            )}
          </div>

          {/* Regeneration Rule Selector */}
          <div>
            <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest font-mono mb-2">
              Regeneration Interval
            </label>
            <div className="grid grid-cols-3 gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
              {[
                { id: 'per-play', label: 'Per Play' },
                { id: 'per-segment', label: 'Per Segment' },
                { id: 'per-render', label: 'Per Render' },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRule(r.id as any)}
                  className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                    rule === r.id
                      ? 'bg-teal-500 text-[#14121a] font-black shadow-lg shadow-teal-500/20'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Actions Row */}
        <div className="flex items-center justify-between border-t border-white/5 pt-4 relative z-10">
          <div>
            {onDelete && initialPoint && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-black uppercase tracking-wider transition"
              >
                <Trash2 size={13} />
                Delete
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/80 rounded-xl text-xs font-bold transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4.5 py-2.5 bg-[#eab308] hover:bg-[#e6a800] text-[#14121a] font-black rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-[#eab308]/20"
            >
              <Check size={14} strokeWidth={3} />
              Save Rule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
