/**
 * BreathPicker — shared UI for choosing a breath-pacing pattern (v4.4).
 *
 * Used by the Listening Session creation flow, Drone Mode, and the Standalone
 * Timer. Lets the user pick "None", a built-in (with honest framing copy), or a
 * custom 4-input pattern (with bounds + a no-framing note). Pattern selection
 * only — reduced-motion and haptics are device prefs handled elsewhere.
 */
import { useState } from 'react';
import {
  BUILT_IN_PATTERNS,
  CUSTOM_BOUNDS,
  CUSTOM_PATTERN_NOTE,
  clampCustomPattern,
  getBuiltIn,
  type BreathPattern,
  type BreathPatternId,
  type BreathTuple,
} from './patterns';

interface BreathPickerProps {
  value: BreathPattern | null;
  onChange: (value: BreathPattern | null) => void;
}

const DEFAULT_CUSTOM: BreathTuple = [4, 4, 4, 4];

const FIELD_LABELS = ['Inhale', 'Hold', 'Exhale', 'Hold'] as const;

export default function BreathPicker({
  value,
  onChange,
}: BreathPickerProps): React.ReactElement {
  const selected: BreathPatternId | 'none' = value?.pattern ?? 'none';
  const [custom, setCustom] = useState<BreathTuple>(
    value?.pattern === 'custom' && value.custom_pattern
      ? value.custom_pattern
      : DEFAULT_CUSTOM,
  );

  const choose = (id: BreathPatternId | 'none') => {
    if (id === 'none') onChange(null);
    else if (id === 'custom')
      onChange({
        pattern: 'custom',
        custom_pattern: clampCustomPattern(custom),
      });
    else onChange({ pattern: id });
  };

  const updateCustomField = (index: number, raw: string) => {
    const next = [...custom] as BreathTuple;
    next[index] = Number(raw);
    setCustom(next);
    onChange({ pattern: 'custom', custom_pattern: clampCustomPattern(next) });
  };

  const builtInDesc =
    selected !== 'none' && selected !== 'custom'
      ? getBuiltIn(selected)?.description
      : undefined;

  const cycleTotal = custom[0] + custom[1] + custom[2] + custom[3];
  const overCycle = cycleTotal > CUSTOM_BOUNDS.maxCycle;

  return (
    <div className="font-body text-stone-300">
      <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-stone-500">
        Breath Pacing (optional)
      </div>
      <div className="flex flex-wrap gap-1.5">
        <PatternChip
          active={selected === 'none'}
          label="None"
          onClick={() => choose('none')}
        />
        {BUILT_IN_PATTERNS.map((p) => (
          <PatternChip
            key={p.id}
            active={selected === p.id}
            label={p.label}
            onClick={() => choose(p.id)}
          />
        ))}
        <PatternChip
          active={selected === 'custom'}
          label="Custom"
          onClick={() => choose('custom')}
        />
      </div>

      {builtInDesc && (
        <p className="mt-2 font-mono text-[9px] leading-relaxed text-stone-500">
          {builtInDesc}
        </p>
      )}

      {selected === 'custom' && (
        <div className="mt-3 rounded border border-stone-900 bg-stone-950/40 p-3">
          <div className="grid grid-cols-4 gap-2">
            {FIELD_LABELS.map((label, i) => (
              <label key={i} className="flex flex-col gap-1">
                <span className="font-mono text-[8px] uppercase tracking-wider text-stone-600">
                  {label}
                </span>
                <input
                  type="number"
                  min={
                    i === 0 || i === 2
                      ? CUSTOM_BOUNDS.minActive
                      : CUSTOM_BOUNDS.minHold
                  }
                  max={CUSTOM_BOUNDS.maxPhase}
                  step={CUSTOM_BOUNDS.step}
                  value={custom[i]}
                  onChange={(e) => updateCustomField(i, e.target.value)}
                  className="w-full rounded border border-stone-800 bg-stone-950 px-2 py-1 font-mono text-xs text-stone-200"
                />
              </label>
            ))}
          </div>
          <p className="mt-2 font-mono text-[9px] text-stone-500">
            {CUSTOM_PATTERN_NOTE}
          </p>
          {overCycle && (
            <p className="mt-1 font-mono text-[9px] text-amber-500">
              Total cycle must be {CUSTOM_BOUNDS.maxCycle}s or less — it will be
              scaled to fit.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PatternChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 font-mono text-[9px] uppercase tracking-wider transition-all cursor-pointer select-none border ${
        active
          ? 'border-amber-500/40 bg-amber-500/[0.06] text-amber-200 shadow-[inset_0_0_12px_rgba(245,158,11,0.15)] font-semibold'
          : 'border-stone-800/80 bg-stone-950/10 text-stone-400 hover:text-stone-200 hover:border-stone-700/80'
      }`}
    >
      {label}
    </button>
  );
}
