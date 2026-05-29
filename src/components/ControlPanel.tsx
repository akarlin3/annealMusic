import { useState, useEffect } from 'react';
import {
  CONTROL_DEFS,
  VOLUME_DEF,
  type ControlGroup,
  type AnnealMusicParams,
  type ParamKey,
  getClosestNote,
  pianoNoteToFreq,
} from '@/state/params';
import {
  ENGINE_LABELS,
  engineCapabilities,
  engineParamDefs,
} from '@/audio/engines/index';
import type { EngineId, EngineParams } from '@/audio/engines/types';
import SourcePicker from '@/components/SourcePicker';
import { PHYSICAL_MODELS } from '@/audio/engines/physical';
import InfoTip from '@/components/InfoTip';
import ControlCaption from '@/components/ControlCaption';

interface ControlPanelProps {
  params: AnnealMusicParams;
  setParam: (key: ParamKey, value: number) => void;
  isPlaying: boolean;
  engineId: EngineId;
  engineParams: EngineParams;
  setEngineParam: (key: string, value: number | string) => void;
  /** While an arc runs, all sculpt controls are read-only (live values shown). */
  arcLocked?: boolean;
  /**
   * Whether to render the always-visible captions under each control. Default on
   * for the main app; the minimal embed surface can pass `false` to save space.
   */
  showCaptions?: boolean;
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

function NoteConverter({
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const [inputText, setInputText] = useState(() => getClosestNote(value));
  const [isValid, setIsValid] = useState(true);
  const [isFocused, setIsFocused] = useState(false);

  // Sync input text with the slider if the user is not actively typing
  useEffect(() => {
    if (!isFocused) {
      setInputText(getClosestNote(value));
      setIsValid(true);
    }
  }, [value, isFocused]);

  const handleChange = (text: string) => {
    setInputText(text);
    const parsed = pianoNoteToFreq(text);
    if (parsed !== null) {
      setIsValid(true);
      const clamped = Math.min(max, Math.max(min, parsed));
      onChange(clamped);
    } else {
      setIsValid(text.trim() === '');
    }
  };

  return (
    <div className="mt-2.5 rounded-lg border border-[#2e2b28] bg-[#1a1715]/60 p-2.5 transition-all hover:border-[#44403c]">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#78716c]">
            Piano Note Converter
          </span>
          <span className="text-[9px] font-mono text-[#57534e]">
            (e.g., A4, C#3, Eb5)
          </span>
        </div>
        {inputText.trim() !== '' && (
          <span
            className="font-mono text-[9px] uppercase tracking-wider transition-colors duration-200"
            style={{ color: isValid ? '#10b981' : '#ef4444' }}
          >
            {isValid ? 'Valid' : 'Invalid'}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            disabled={disabled}
            value={inputText}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Type note (e.g. A4)"
            className="w-full rounded border bg-[#0d0c0b] px-2 py-1 text-xs font-mono text-[#e7e5e4] placeholder-[#44403c] transition-all focus:border-[#fbbf24] focus:outline-none disabled:opacity-50"
            style={{
              borderColor: isValid ? '#2e2b28' : '#ef4444',
            }}
          />
        </div>
        <div className="flex items-center justify-center rounded bg-[#1c1917] px-2.5 py-1 text-[11px] font-mono text-[#fbbf24]">
          {value.toFixed(0)} Hz
        </div>
      </div>
    </div>
  );
}

function Slider({
  def,
  value,
  disabled,
  lockLabel = 'locked',
  explainId,
  showCaption = true,
  tourId,
  onChange,
}: {
  def: SliderDef;
  value: number;
  disabled: boolean;
  lockLabel?: string;
  /** Explanation id for the info tooltip + caption (omit to show neither). */
  explainId?: string;
  showCaption?: boolean;
  /** Optional marker so the first-run tour can spotlight this control. */
  tourId?: string;
  onChange: (v: number) => void;
}) {
  const isRoot = explainId === 'rootFreq';
  const sliderMin = isRoot ? 55 : def.min;
  const sliderMax = isRoot ? 220 : def.max;
  const sliderVal = isRoot ? Math.min(220, Math.max(55, value)) : value;

  return (
    <div data-tour={tourId}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="flex items-center gap-1.5">
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
          {explainId && <InfoTip id={explainId} label={def.label} />}
        </span>
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
        min={sliderMin}
        max={sliderMax}
        step={def.step}
        value={sliderVal}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {explainId && showCaption && <ControlCaption id={explainId} />}
      {isRoot && (
        <NoteConverter
          value={value}
          min={def.min}
          max={def.max}
          disabled={disabled}
          onChange={onChange}
        />
      )}
    </div>
  );
}

const MODEL_LABELS: Record<string, string> = {
  string: 'String',
  tube: 'Tube',
  plate: 'Plate',
  membrane: 'Membrane',
  bowed: 'Bowed',
  mallet: 'Mallet',
  edge: 'Edge',
  bell: 'Bell',
};

const MODEL_HINTS: Record<string, string> = {
  string: 'Plucked Karplus-Strong',
  tube: 'Blown reed waveguide',
  plate: 'Struck modal bank',
  membrane: 'Circular drum modes',
  bowed: 'Friction-driven string',
  mallet: 'Vibraphone bar roll',
  edge: 'Jet-blown air column',
  bell: 'Bell partial modes',
};

/** Card selector for the physical engine sub-model (8 models, 2×4 grid). */
function ModelPicker({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (index: number) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Physical model"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      {PHYSICAL_MODELS.map((model, i) => {
        const active = i === Math.round(value);
        return (
          <button
            key={model}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(i)}
            className="rounded-md px-3 py-2.5 text-left transition-all"
            style={{
              background: active ? 'rgba(245, 158, 11, 0.10)' : 'transparent',
              border: `1px solid ${active ? '#f59e0b' : '#44403c'}`,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            <div
              className="font-mono text-[11px] uppercase tracking-[0.16em]"
              style={{ color: active ? '#fbbf24' : '#d6d3d1' }}
            >
              {MODEL_LABELS[model]}
            </div>
            <div className="mt-0.5 text-[10px]" style={{ color: '#78716c' }}>
              {MODEL_HINTS[model]}
            </div>
          </button>
        );
      })}
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
  showCaptions = true,
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
                  explainId={c.key}
                  showCaption={showCaptions}
                  tourId={c.key}
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
            engineId === 'granular' || engineId === 'physical'
              ? 'max-w-xl'
              : 'max-w-xs'
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
              <div className="mb-2 flex items-center gap-1.5">
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: '#78716c' }}
                >
                  Source
                </span>
                <InfoTip id="granular.source" label="Source" />
              </div>
              <SourcePicker
                value={engineParams.source ?? 0}
                disabled={arcLocked}
                isPlaying={isPlaying}
                onChange={(idx) => setEngineParam('source', idx)}
              />
              {showCaptions && <ControlCaption id="granular.source" />}
            </div>
          )}
          {engineId === 'physical' && (
            <div className="mb-6">
              <div className="mb-2 flex items-center gap-1.5">
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: '#78716c' }}
                >
                  Model
                </span>
                <InfoTip id="physical.model" label="Model" />
              </div>
              <ModelPicker
                value={
                  typeof engineParams.model === 'string'
                    ? parseFloat(engineParams.model)
                    : (engineParams.model ?? 0)
                }
                disabled={arcLocked}
                onChange={(idx) => setEngineParam('model', idx)}
              />
              {showCaptions && <ControlCaption id="physical.model" />}
            </div>
          )}
          <div className="space-y-5">
            {engineDefs
              .filter((def) => def.key !== 'source' && def.key !== 'model')
              .map((def) => (
                <Slider
                  key={def.key}
                  def={def}
                  value={
                    typeof (engineParams[def.key] ?? def.default) === 'string'
                      ? parseFloat(
                          (engineParams[def.key] ?? def.default) as string,
                        )
                      : ((engineParams[def.key] ?? def.default) as number)
                  }
                  disabled={arcLocked}
                  lockLabel="arc"
                  explainId={`${engineId}.${def.key}`}
                  showCaption={showCaptions}
                  onChange={(v) => setEngineParam(def.key, v)}
                />
              ))}
          </div>
        </div>
      )}

      <div className="mt-10 max-w-xs">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="flex items-center gap-1.5">
            <label
              className="font-mono text-[10px] uppercase tracking-[0.22em]"
              style={{ color: '#78716c' }}
            >
              {VOLUME_DEF.label}
            </label>
            <InfoTip id="volume" label={VOLUME_DEF.label} />
          </span>
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
        {showCaptions && <ControlCaption id="volume" />}
      </div>
    </>
  );
}
