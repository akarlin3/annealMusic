import { useState, useMemo, useEffect } from 'react';
import { Sparkles, Sliders, ChevronDown, ChevronUp } from 'lucide-react';
import {
  PRESET_CATEGORIES,
  PRESET_SOUNDS,
  type MusicPreset,
} from '@/content/presets';
import { useParamStore, type AnnealMusicParams } from '@/state/params';
import type { EngineId } from '@/audio/engines/types';
import InfoTip from '@/components/InfoTip';

interface PresetsPanelProps {
  /** Callback for showing toast alerts (e.g. "Loaded Cosmic Hum"). */
  showToast: (msg: string) => void;
  /** Whether the panel should be disabled (e.g. while an arc is running). */
  disabled?: boolean;
}

/** Check if the live store parameters exactly match a preset's defined values. */
function isPresetActive(
  preset: MusicPreset,
  params: AnnealMusicParams,
  engineId: EngineId,
  engineParams: Record<string, number>,
): boolean {
  if (engineId !== preset.engineId) return false;

  // Check shared params (except volume)
  for (const k of Object.keys(
    preset.params,
  ) as (keyof typeof preset.params)[]) {
    if (params[k] !== preset.params[k]) return false;
  }

  // Check engine-specific params
  if (preset.engineParams) {
    for (const [key, val] of Object.entries(preset.engineParams)) {
      if (engineParams[key] !== val) return false;
    }
  }

  return true;
}

export default function PresetsPanel({
  showToast,
  disabled = false,
}: PresetsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeCategoryId, setActiveCategoryId] =
    useState<string>('ambient-space');

  const params = useParamStore((s) => s.params);
  const engineId = useParamStore((s) => s.engineId);
  const allEngineParams = useParamStore((s) => s.engineParams);
  const setMany = useParamStore((s) => s.setMany);
  const setEngine = useParamStore((s) => s.setEngine);
  const setEngineParam = useParamStore((s) => s.setEngineParam);

  // Detect which preset (if any) is currently active
  const activePreset = useMemo(() => {
    return PRESET_SOUNDS.find((p) =>
      isPresetActive(p, params, engineId, allEngineParams[p.engineId] ?? {}),
    );
  }, [params, engineId, allEngineParams]);

  // Sync category tab if activePreset is found in another category (e.g. on external link hydration)
  useEffect(() => {
    if (activePreset) {
      const parentCat = PRESET_CATEGORIES.find((cat) =>
        cat.presets.some((p) => p.id === activePreset.id),
      );
      if (parentCat && parentCat.id !== activeCategoryId) {
        setActiveCategoryId(parentCat.id);
      }
    }
  }, [activePreset, activeCategoryId]);

  const handleSelectPreset = (preset: MusicPreset) => {
    if (disabled) return;

    // Apply engine
    setEngine(preset.engineId);

    // Apply shared params
    setMany(preset.params);

    // Apply engine-specific params
    if (preset.engineParams) {
      for (const [key, val] of Object.entries(preset.engineParams)) {
        setEngineParam(preset.engineId, key, val);
      }
    }

    showToast(`Loaded preset "${preset.name}"`);
  };

  return (
    <div
      className="mt-6 rounded-xl p-4 transition-all duration-300"
      style={{
        background: 'rgba(28, 25, 23, 0.25)',
        border: '1px solid #1c1917',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.22em] font-semibold"
            style={{ color: '#78716c' }}
          >
            Sound Presets
          </span>
          <InfoTip id="presets" label="Presets" />
          {activePreset && (
            <span
              className="ml-2 font-mono text-[9px] uppercase tracking-[0.1em] px-2 py-0.5 rounded"
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                color: '#fbbf24',
                border: '1px solid rgba(245, 158, 11, 0.2)',
              }}
            >
              Active: {activePreset.name}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors"
          style={{ color: '#a8a29e' }}
        >
          {collapsed ? (
            <>
              <span>Show Presets</span>
              <ChevronDown size={11} strokeWidth={2} />
            </>
          ) : (
            <>
              <span>Collapse</span>
              <ChevronUp size={11} strokeWidth={2} />
            </>
          )}
        </button>
      </div>

      {/* Category Tabs Switcher */}
      {!collapsed && (
        <div
          className="mt-4 flex flex-wrap gap-1 p-1 rounded-lg border"
          style={{
            background: 'rgba(28, 25, 23, 0.4)',
            borderColor: '#292524',
          }}
        >
          {PRESET_CATEGORIES.map((cat) => {
            const isSelected = activeCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                disabled={disabled}
                onClick={() => setActiveCategoryId(cat.id)}
                className="flex-1 min-w-[110px] px-2.5 py-1.5 rounded-md font-mono text-[9px] uppercase tracking-[0.1em] font-semibold text-center transition-all duration-200"
                style={{
                  background: isSelected
                    ? 'rgba(245, 158, 11, 0.08)'
                    : 'transparent',
                  color: isSelected ? '#fbbf24' : '#78716c',
                  border: isSelected
                    ? '1px solid rgba(245, 158, 11, 0.2)'
                    : '1px solid transparent',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Category Description */}
      {!collapsed && (
        <p
          className="mt-2.5 px-1 font-mono text-[9px] uppercase tracking-[0.05em] transition-all duration-300"
          style={{ color: '#57534e' }}
        >
          {
            PRESET_CATEGORIES.find((c) => c.id === activeCategoryId)
              ?.description
          }
        </p>
      )}

      {/* Expanded Grid */}
      {!collapsed && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PRESET_SOUNDS.map((preset) => {
            const active = activePreset?.id === preset.id;
            const parentCat = PRESET_CATEGORIES.find((cat) =>
              cat.presets.some((p) => p.id === preset.id),
            );
            const isVisible = parentCat?.id === activeCategoryId;

            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => handleSelectPreset(preset)}
                className="group relative flex flex-col justify-between rounded-lg p-3 text-left transition-all duration-200"
                style={{
                  display: isVisible ? 'flex' : 'none',
                  background: active
                    ? 'rgba(245, 158, 11, 0.08)'
                    : 'rgba(28, 25, 23, 0.5)',
                  border: active ? '1px solid #f59e0b' : '1px solid #1c1917',
                  boxShadow: active
                    ? '0 0 10px rgba(245, 158, 11, 0.08)'
                    : 'none',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
              >
                {/* Title & Badge */}
                <div className="w-full">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className="font-body text-xs font-medium transition-colors group-hover:text-amber-300"
                      style={{ color: active ? '#fef3c7' : '#e7e5e4' }}
                    >
                      {preset.name}
                    </span>
                    <span
                      className="font-mono text-[8px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border"
                      style={{
                        color: active ? '#fbbf24' : '#78716c',
                        borderColor: active
                          ? 'rgba(245, 158, 11, 0.3)'
                          : '#292524',
                        background: active
                          ? 'rgba(245, 158, 11, 0.04)'
                          : 'transparent',
                      }}
                    >
                      {preset.engineId}
                    </span>
                  </div>

                  {/* Description */}
                  <p
                    className="mt-1 text-[11px] leading-relaxed transition-colors"
                    style={{ color: active ? '#a8a29e' : '#78716c' }}
                  >
                    {preset.description}
                  </p>
                </div>

                {/* Footer specs */}
                <div
                  className="mt-3 w-full flex items-center justify-between border-t pt-2 font-mono text-[8px] uppercase tracking-[0.1em]"
                  style={{
                    borderColor: active
                      ? 'rgba(245, 158, 11, 0.15)'
                      : '#1c1917',
                    color: active ? '#fbbf24' : '#57534e',
                  }}
                >
                  <span className="flex items-center gap-1">
                    <Sparkles size={8} />
                    {preset.params.rootFreq} Hz
                  </span>
                  <span className="flex items-center gap-1 font-semibold">
                    <Sliders size={8} />
                    {preset.engineId === 'granular' ? (
                      <span>src {preset.engineParams?.source}</span>
                    ) : preset.engineId === 'physical' ? (
                      <span>
                        {preset.engineParams?.model === 0
                          ? 'string'
                          : preset.engineParams?.model === 1
                            ? 'pipe'
                            : 'plate'}
                      </span>
                    ) : preset.engineId === 'fm' ? (
                      <span>r: {preset.engineParams?.modRatio}</span>
                    ) : (
                      <span>clean</span>
                    )}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
