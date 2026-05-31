/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import {
  CONTROL_DEFS,
  VOLUME_DEF,
  type ControlGroup,
  type AnnealMusicParams,
  type ParamKey,
  getClosestNote,
  pianoNoteToFreq,
  useParamStore,
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
import { HelpTooltip } from '@/components/HelpTooltip';
import ControlCaption from '@/components/ControlCaption';
import { Wand2, Trash2 } from 'lucide-react';
import { parseScl } from '@/audio/tuning/sclParser';
import { api } from '@/api/client';
import ModifyPatchDialog from '@/components/ModifyPatchDialog';

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
  showToast: (msg: string) => void;
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

  const [highlighted, setHighlighted] = useState(false);

  useEffect(() => {
    const handleHighlight = (e: Event) => {
      const customEvent = e as CustomEvent<{ controlKey: string }>;
      if (customEvent.detail.controlKey === explainId) {
        setHighlighted(true);
        const timer = setTimeout(() => setHighlighted(false), 3000);
        return () => clearTimeout(timer);
      }
    };
    window.addEventListener('anneal-highlight', handleHighlight);
    return () =>
      window.removeEventListener('anneal-highlight', handleHighlight);
  }, [explainId]);

  return (
    <div
      data-tour={tourId}
      className={`transition-all duration-300 ${
        highlighted
          ? 'rounded-lg p-2 bg-[#fbbf24]/10 shadow-[0_0_15px_rgba(251,191,36,0.3)] ring-2 ring-[#fbbf24]'
          : ''
      }`}
    >
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
          {explainId === 'coupling' && (
            <HelpTooltip
              title="Phase Coupling Factor"
              description="Controls the synchronization strength between independent frequency loops. High coupling locks the phase loops into clean harmonic intervals, while low coupling allows organic, microtonal drifts."
              tips="Increase to lock phase loops together for clean harmonic intervals; decrease for organic drifts."
            />
          )}
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
  showToast,
}: ControlPanelProps) {
  const [aiModifyOpen, setAiModifyOpen] = useState(false);
  const backendOn = api.isBackendConfigured();
  const caps = engineCapabilities(engineId);
  const structuralLock = isPlaying && caps.densityLockedWhilePlaying;
  const engineDefs = engineParamDefs(engineId);

  // --- Tuning & Custom Scales (v4.1) ---------------------------------------
  const { tuning, customScales, setTuning, setCustomScales, constraints } =
    useParamStore();
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (api.isBackendConfigured()) {
      api
        .listCustomTunings()
        .then((res) => {
          setCustomScales(res.items);
        })
        .catch((err) => {
          console.error('Failed to fetch custom tunings:', err);
        });
    }
  }, [setCustomScales]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleImportSclText = async (filename: string, text: string) => {
    try {
      const parsed = parseScl(text);
      const baseName = filename.replace(/\.scl$/i, '');
      const name = parsed.description
        ? parsed.description.substring(0, 80)
        : baseName;

      if (!api.isBackendConfigured()) {
        const localId = `local-${Math.random().toString(36).substr(2, 9)}`;
        const localTuning = {
          id: localId,
          user_id: 'local-user',
          name,
          scl_text: text,
          parsed_scale: parsed.scaleRatios,
          reference_a4_hz: 440.0,
          created_at: new Date().toISOString(),
        };
        setCustomScales([...customScales, localTuning]);
        setTuning({ system: 'custom', sclId: localId, referenceA4Hz: 440 });
        showToast('Scale imported locally (Offline mode)');
        return;
      }

      const res = await api.createCustomTuning({
        name,
        scl_text: text,
        parsed_scale: parsed.scaleRatios,
        reference_a4_hz: 440.0,
      });

      setCustomScales([res, ...customScales]);
      setTuning({ system: 'custom', sclId: res.id, referenceA4Hz: 440 });
      showToast('Scala scale imported and saved successfully!');
    } catch (err) {
      console.error(err);
      showToast(
        err instanceof Error ? err.message : 'Invalid Scala file format.',
      );
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      void handleImportSclText(file.name, text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      void handleImportSclText(file.name, text);
    };
    reader.readAsText(file);
  };

  const handleDeleteCustomScale = async (id: string) => {
    try {
      if (api.isBackendConfigured()) {
        await api.deleteCustomTuning(id);
      }
      setCustomScales(customScales.filter((s) => s.id !== id));
      if (tuning.system === 'custom' && tuning.sclId === id) {
        setTuning({ system: 'equal', referenceA4Hz: tuning.referenceA4Hz });
      }
      showToast('Scale deleted successfully.');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete custom scale.');
    }
  };

  const handleSystemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
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

  const handleRefA4Change = (val: number) => {
    setTuning({ ...tuning, referenceA4Hz: val });
  };

  let disclaimerText = '';
  if (tuning.system === 'solfeggio') {
    disclaimerText =
      'These nine frequencies are a modern reconstruction often associated with healing claims. AnnealMusic supports them because they produce a distinct non-octave-equivalent texture. The peer-reviewed evidence for specific clinical effects of these frequencies is absent.';
  } else if (tuning.referenceA4Hz === 432) {
    disclaimerText =
      'The claim that 432 Hz possesses unique natural healing or acoustic properties is unsupported by scientific literature. AnnealMusic includes this option because the slight downward pitch shift produces a subtly warmer and different timbre.';
  } else if (tuning.system !== 'equal' && tuning.system !== 'custom') {
    disclaimerText =
      'Historical Western temperaments give different keys unique "colors" due to unevenly distributed intervals. They produce beautiful acoustic textures but do not offer targeted physiological or medical benefits.';
  }

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
              {CONTROL_DEFS.filter((c) => c.group === group).map((c) => {
                const allowedByLesson =
                  !constraints || constraints.includes(c.key);
                return (
                  <Slider
                    key={c.key}
                    def={c}
                    value={params[c.key]}
                    disabled={
                      arcLocked ||
                      (Boolean(c.lockWhilePlaying) && structuralLock) ||
                      !allowedByLesson
                    }
                    lockLabel={
                      !allowedByLesson ? 'lesson' : arcLocked ? 'arc' : 'locked'
                    }
                    explainId={c.key}
                    showCaption={showCaptions}
                    tourId={c.key}
                    onChange={(v) => setParam(c.key, v)}
                  />
                );
              })}
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
          <div className="mb-4 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
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
            {backendOn && (
              <button
                type="button"
                onClick={() => setAiModifyOpen(true)}
                className="flex items-center gap-1.5 hover:text-violet-300 transition-colors"
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: '#a78bfa',
                }}
              >
                <Wand2 size={11} className="animate-pulse" />
                <span className="font-mono text-[9px] uppercase tracking-[0.15em]">
                  AI Modify
                </span>
              </button>
            )}
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
              {(() => {
                const allowedByLesson =
                  !constraints ||
                  constraints.includes('source') ||
                  constraints.includes('granular.source');
                return (
                  <SourcePicker
                    value={engineParams.source ?? 0}
                    disabled={arcLocked || !allowedByLesson}
                    isPlaying={isPlaying}
                    onChange={(idx) => setEngineParam('source', idx)}
                  />
                );
              })()}
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
              {(() => {
                const allowedByLesson =
                  !constraints ||
                  constraints.includes('model') ||
                  constraints.includes('physical.model');
                return (
                  <ModelPicker
                    value={
                      typeof engineParams.model === 'string'
                        ? parseFloat(engineParams.model)
                        : (engineParams.model ?? 0)
                    }
                    disabled={arcLocked || !allowedByLesson}
                    onChange={(idx) => setEngineParam('model', idx)}
                  />
                );
              })()}
              {showCaptions && <ControlCaption id="physical.model" />}
            </div>
          )}
          <div className="space-y-5">
            {engineDefs
              .filter((def) => def.key !== 'source' && def.key !== 'model')
              .map((def) => {
                const allowedByLesson =
                  !constraints ||
                  constraints.includes(def.key) ||
                  constraints.includes(`${engineId}.${def.key}`);
                return (
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
                    disabled={arcLocked || !allowedByLesson}
                    lockLabel={!allowedByLesson ? 'lesson' : 'arc'}
                    explainId={`${engineId}.${def.key}`}
                    showCaption={showCaptions}
                    onChange={(v) => setEngineParam(def.key, v)}
                  />
                );
              })}
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

      {/* Tuning Settings Panel (v4.1) */}
      <div className="mt-10 max-w-xl rounded-xl border border-[#2e2b28] bg-[#141210]/90 p-5">
        <div className="mb-4 flex items-baseline justify-between border-b border-[#292524] pb-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#78716c]">
            Tuning & Scales
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#57534e]">
            v4.1 Tuning Engine
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Left Column: Selector & Reference A4 */}
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-mono uppercase tracking-[0.16em] text-[#a8a29e]">
                Tuning System
              </label>
              <select
                value={
                  tuning.system === 'custom'
                    ? `custom:${tuning.sclId}`
                    : tuning.system
                }
                onChange={handleSystemChange}
                disabled={arcLocked}
                className="w-full rounded border border-[#2e2b28] bg-[#0d0c0b] px-3 py-2 text-xs font-mono text-[#e7e5e4] transition-all focus:border-[#fbbf24] focus:outline-none"
              >
                <option value="equal">Equal Temperament</option>
                <option value="just-5">Just Intonation (5-limit)</option>
                <option value="just-7">Just Intonation (7-limit)</option>
                <option value="pythagorean">Pythagorean</option>
                <option value="solfeggio">Solfeggio Frequencies</option>
                <option value="werckmeister3">Werckmeister III</option>
                <option value="kirnberger3">Kirnberger III</option>
                <option value="meantone-quarter">Quarter-Comma Meantone</option>
                <option value="valotti">Vallotti</option>
                <option value="young">Young</option>

                {customScales.length > 0 && (
                  <optgroup label="Custom Scala Scales">
                    {customScales.map((s) => (
                      <option key={s.id} value={`custom:${s.id}`}>
                        {s.name} ({s.parsed_scale.length - 1}-tone)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label
                  className="text-[11px] font-mono uppercase tracking-[0.16em]"
                  style={{
                    color:
                      tuning.system === 'solfeggio' || arcLocked
                        ? '#57534e'
                        : '#a8a29e',
                  }}
                >
                  Reference A4
                </label>
                <span
                  className="font-mono text-xs text-[#fbbf24] tabular-nums"
                  style={{
                    color:
                      tuning.system === 'solfeggio' || arcLocked
                        ? '#57534e'
                        : '#fbbf24',
                  }}
                >
                  {tuning.system === 'solfeggio'
                    ? 'N/A (snapped)'
                    : `${tuning.referenceA4Hz ?? 440} Hz`}
                </span>
              </div>
              <input
                type="range"
                className="am-range"
                min="400"
                max="480"
                step="0.1"
                value={tuning.referenceA4Hz ?? 440}
                disabled={tuning.system === 'solfeggio' || arcLocked}
                onChange={(e) => handleRefA4Change(parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Right Column: Scala File Drag & Drop */}
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-mono uppercase tracking-[0.16em] text-[#a8a29e]">
                Import Scala (.scl)
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-all ${
                  dragActive
                    ? 'border-[#fbbf24] bg-[#fbbf24]/5'
                    : 'border-[#2e2b28] bg-[#0d0c0b]/40 hover:border-[#44403c]'
                }`}
              >
                <input
                  type="file"
                  accept=".scl"
                  onChange={handleFileInput}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  disabled={arcLocked}
                />
                <span className="text-[10px] font-mono text-[#78716c]">
                  Drag & Drop .scl File
                </span>
                <span className="mt-1 text-[9px] text-[#57534e]">
                  or click to browse
                </span>
              </div>
            </div>

            {customScales.length > 0 && (
              <div>
                <span className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-[#57534e]">
                  Your Imported Scales
                </span>
                <div className="max-h-[80px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                  {customScales.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded bg-[#1a1715]/60 px-2 py-1 border border-[#2e2b28]"
                    >
                      <span
                        className="truncate text-[10px] font-mono text-[#d6d3d1]"
                        title={s.name}
                      >
                        {s.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomScale(s.id)}
                        disabled={arcLocked}
                        className="text-[#78716c] hover:text-[#ef4444] transition-colors"
                        title="Delete scale"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {disclaimerText && (
          <div className="mt-4 rounded-lg bg-[#18120c] p-3.5 border border-[#45270f]/40">
            <div className="text-[10px] font-mono text-[#e0a96d]/90 leading-relaxed font-medium">
              {disclaimerText}
            </div>
          </div>
        )}
      </div>
      {backendOn && (
        <ModifyPatchDialog
          isOpen={aiModifyOpen}
          onClose={() => setAiModifyOpen(false)}
          showToast={showToast}
        />
      )}
    </>
  );
}
