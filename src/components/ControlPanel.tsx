import {
  CONTROL_DEFS,
  VOLUME_DEF,
  type ControlGroup,
  type AnnealMusicParams,
  type ParamKey,
} from '@/state/params';
import {
  ENGINE_LABELS,
  engineCapabilities,
  engineParamDefs,
} from '@/audio/engines/index';
import type { EngineId, EngineParams } from '@/audio/engines/types';
import SourcePicker from '@/components/SourcePicker';

interface ControlPanelProps {
  params: AnnealMusicParams;
  setParam: (key: ParamKey, value: number) => void;
  isPlaying: boolean;
  engineId: EngineId;
  engineParams: EngineParams;
  setEngineParam: (key: string, value: number) => void;
  /** While an arc runs, all sculpt controls are read-only (live values shown). */
  arcLocked?: boolean;
}

const GROUPS: ControlGroup[] = ['Pitch', 'Physics', 'Tone'];

/** Minimal shape a slider needs; satisfied by both shared and engine defs. */
interface SliderDef {
  label: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
}

function Slider({
  def,
  value,
  disabled,
  lockLabel = 'locked',
  onChange,
}: {
  def: SliderDef;
  value: number;
  disabled: boolean;
  lockLabel?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label
          className="text-[13px]"
          style={{ color: disabled ? '#57534e' : '#d6d3d1' }}
        >
          {def.label}
          {disabled && (
            <span
              className="ml-2 font-mono text-[9px] uppercase tracking-[0.18em]"
              style={{ color: '#57534e' }}
            >
              {lockLabel}
            </span>
          )}
        </label>
        <span
          className="font-mono text-[11px] tabular-nums"
          style={{ color: disabled ? '#57534e' : '#fbbf24' }}
        >
          {def.fmt(value)}
        </span>
      </div>
      <input
        type="range"
        className="am-range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

export default function ControlPanel({
  params,
  setParam,
  isPlaying,
  engineId,
  engineParams,
  setEngineParam,
  arcLocked = false,
}: ControlPanelProps) {
  const caps = engineCapabilities(engineId);
  const structuralLock = isPlaying && caps.densityLockedWhilePlaying;
  const engineDefs = engineParamDefs(engineId);

  return (
    <>
      <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-3">
        {GROUPS.map((group) => (
          <div key={group}>
            <div
              className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em]"
              style={{ color: '#78716c' }}
            >
              {group}
            </div>
            <div className="space-y-5">
              {CONTROL_DEFS.filter((c) => c.group === group).map((c) => (
                <Slider
                  key={c.key}
                  def={c}
                  value={params[c.key]}
                  disabled={
                    arcLocked || (Boolean(c.lockWhilePlaying) && structuralLock)
                  }
                  lockLabel={arcLocked ? 'arc' : 'locked'}
                  onChange={(v) => setParam(c.key, v)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {engineDefs.length > 0 && (
        <div
          className={`mt-10 transition-opacity duration-300 ${
            engineId === 'granular' ? 'max-w-xl' : 'max-w-xs'
          }`}
        >
          <div className="mb-4 flex items-baseline gap-2">
            <span
              className="font-mono text-[10px] uppercase tracking-[0.22em]"
              style={{ color: '#78716c' }}
            >
              Engine
            </span>
            <span
              className="font-mono text-[10px] uppercase tracking-[0.22em]"
              style={{ color: '#57534e' }}
            >
              {ENGINE_LABELS[engineId]}
            </span>
          </div>
          {engineId === 'granular' && (
            <div className="mb-6">
              <SourcePicker
                value={engineParams.source ?? 0}
                disabled={arcLocked}
                isPlaying={isPlaying}
                onChange={(idx) => setEngineParam('source', idx)}
              />
            </div>
          )}
          <div className="space-y-5">
            {engineDefs
              .filter((def) => def.key !== 'source')
              .map((def) => (
                <Slider
                  key={def.key}
                  def={def}
                  value={engineParams[def.key] ?? def.default}
                  disabled={arcLocked}
                  lockLabel="arc"
                  onChange={(v) => setEngineParam(def.key, v)}
                />
              ))}
          </div>
        </div>
      )}

      <div className="mt-10 max-w-xs">
        <div className="mb-1.5 flex items-baseline justify-between">
          <label
            className="font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: '#78716c' }}
          >
            {VOLUME_DEF.label}
          </label>
          <span
            className="font-mono text-[11px] tabular-nums"
            style={{ color: '#a8a29e' }}
          >
            {VOLUME_DEF.fmt(params.volume)}
          </span>
        </div>
        <input
          type="range"
          className="am-range"
          min={VOLUME_DEF.min}
          max={VOLUME_DEF.max}
          step={VOLUME_DEF.step}
          value={params.volume}
          onChange={(e) => setParam('volume', parseFloat(e.target.value))}
        />
      </div>
    </>
  );
}
