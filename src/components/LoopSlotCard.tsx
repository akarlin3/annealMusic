import { Circle, Snowflake, Trash2, Volume2, VolumeX } from 'lucide-react';
import LevelMeter from '@/components/LevelMeter';
import WaveformThumbnail from '@/components/WaveformThumbnail';
import InfoTip from '@/components/InfoTip';
import { GRAIN_BOUNDS, type GrainParams, type SlotId } from '@/loop/types';
import type { LoopsApi, SlotView } from '@/hooks/useLoops';

interface LoopSlotCardProps {
  id: SlotId;
  view: SlotView;
  api: LoopsApi;
  inputConnected: boolean;
}

const labelCaps = 'font-mono text-[10px] uppercase tracking-[0.22em]';

const PRIMARY_LABEL: Record<SlotView['state'], string> = {
  empty: 'Arm',
  armed: 'Record',
  capturing: 'Stop',
  playing: 'Mute',
  frozen: 'Mute',
  muted: 'Unmute',
};

const STATE_LABEL: Record<SlotView['state'], string> = {
  empty: 'empty',
  armed: 'armed · waiting',
  capturing: 'capturing',
  playing: 'playing',
  frozen: 'frozen',
  muted: 'muted',
};

/** Glow alpha by state — amber intensity signals liveness. */
const GLOW: Record<SlotView['state'], number> = {
  empty: 0,
  armed: 0.18,
  capturing: 0.32,
  playing: 0.16,
  frozen: 0.24,
  muted: 0.04,
};

interface GrainSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  /** Explanation id for the info tooltip. */
  explainId: string;
  onChange: (v: number) => void;
}

function GrainSlider({
  label,
  value,
  min,
  max,
  step,
  fmt,
  explainId,
  onChange,
}: GrainSliderProps) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="flex items-center gap-1.5">
          <label className="text-[12px]" style={{ color: '#d6d3d1' }}>
            {label}
          </label>
          <InfoTip id={explainId} label={label} />
        </span>
        <span
          className="font-mono text-[11px] tabular-nums"
          style={{ color: '#fbbf24' }}
        >
          {fmt(value)}
        </span>
      </div>
      <input
        type="range"
        className="am-range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

/**
 * A single loop slot tile: state, waveform thumbnail, level meter, and the
 * freeze / mute / clear affordances. When frozen, the card reveals the four
 * grain sliders inline.
 */
export default function LoopSlotCard({
  id,
  view,
  api,
  inputConnected,
}: LoopSlotCardProps) {
  const { state, hasBuffer, config } = view;
  const grain = config.grain;
  const isFrozen = state === 'frozen';
  const isCapturing = state === 'capturing';
  const isMuted = state === 'muted';
  const primaryDisabled = state === 'empty' && !inputConnected;

  const setGrain = (patch: Partial<GrainParams>): void => {
    api.setGrain(id, { ...grain, ...patch });
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-sm p-4"
      style={{
        background: '#0c0a09',
        border: '1px solid #1c1917',
        boxShadow: `inset 0 0 24px rgba(245, 158, 11, ${GLOW[state]})`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display text-2xl" style={{ color: '#fef3c7' }}>
            {id}
          </span>
          <span className={labelCaps} style={{ color: '#a8a29e' }}>
            {STATE_LABEL[state]}
          </span>
        </div>
        {isCapturing && (
          <Circle
            size={9}
            fill="#ef4444"
            stroke="none"
            className="animate-pulse"
          />
        )}
      </div>

      <div
        className="flex items-center justify-center rounded-sm"
        style={{ height: 40, background: 'rgba(245, 158, 11, 0.03)' }}
      >
        {hasBuffer ? (
          <WaveformThumbnail buffer={api.getBuffer(id)} />
        ) : (
          <span className={labelCaps} style={{ color: '#a8a29e' }}>
            {state === 'armed'
              ? 'play to capture'
              : state === 'capturing'
                ? '● recording'
                : 'no capture'}
          </span>
        )}
      </div>

      {(state === 'playing' || state === 'frozen' || state === 'muted') && (
        <LevelMeter getAnalyser={() => api.getAnalyser(id)} />
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => api.primary(id)}
          disabled={primaryDisabled}
          className="flex-1 rounded-full px-3 py-1.5 transition-all"
          style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid #44403c',
            color: primaryDisabled ? '#57534e' : '#fef3c7',
            cursor: primaryDisabled ? 'not-allowed' : 'pointer',
          }}
          title={
            primaryDisabled ? 'Connect an input first' : PRIMARY_LABEL[state]
          }
        >
          <span className={labelCaps}>{PRIMARY_LABEL[state]}</span>
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={isFrozen}
          aria-label={`Freeze ${id}`}
          onClick={() => api.toggleFreeze(id)}
          disabled={!hasBuffer || isMuted}
          className="rounded-full p-2 transition-all"
          style={{
            background: isFrozen ? 'rgba(56, 189, 248, 0.14)' : 'transparent',
            border: '1px solid #44403c',
            color: isFrozen ? '#7dd3fc' : '#a8a29e',
            opacity: !hasBuffer || isMuted ? 0.4 : 1,
          }}
          title="Freeze into an endless drone"
        >
          <Snowflake size={13} strokeWidth={1.5} />
        </button>
        <InfoTip id="loop.freeze" label="Freeze" />

        <button
          type="button"
          role="switch"
          aria-checked={isMuted}
          aria-label={`Mute ${id}`}
          onClick={() => hasBuffer && api.primary(id)}
          disabled={!hasBuffer}
          className="rounded-full p-2 transition-all"
          style={{
            background: isMuted ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
            border: '1px solid #44403c',
            color: '#a8a29e',
            opacity: !hasBuffer ? 0.4 : 1,
          }}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <VolumeX size={13} strokeWidth={1.5} />
          ) : (
            <Volume2 size={13} strokeWidth={1.5} />
          )}
        </button>

        <button
          type="button"
          aria-label={`Clear ${id}`}
          onClick={() => api.clear(id)}
          disabled={!hasBuffer && state === 'empty'}
          className="rounded-full p-2 transition-all"
          style={{
            border: '1px solid #44403c',
            color: '#a8a29e',
            opacity: !hasBuffer && state === 'empty' ? 0.4 : 1,
          }}
          title="Clear (no undo)"
        >
          <Trash2 size={13} strokeWidth={1.5} />
        </button>
      </div>

      {isFrozen && (
        <div className="flex flex-col gap-2.5 pt-1">
          <GrainSlider
            label="Grain size"
            explainId="loop.grainSize"
            value={grain.sizeMs}
            min={GRAIN_BOUNDS.sizeMs.min}
            max={GRAIN_BOUNDS.sizeMs.max}
            step={1}
            fmt={(v) => `${v.toFixed(0)} ms`}
            onChange={(v) => setGrain({ sizeMs: v })}
          />
          <GrainSlider
            label="Density"
            explainId="loop.grainDensity"
            value={grain.density}
            min={GRAIN_BOUNDS.density.min}
            max={GRAIN_BOUNDS.density.max}
            step={1}
            fmt={(v) => `${v.toFixed(0)}/s`}
            onChange={(v) => setGrain({ density: v })}
          />
          <GrainSlider
            label="Position jitter"
            explainId="loop.posJitter"
            value={grain.posJitter}
            min={GRAIN_BOUNDS.posJitter.min}
            max={GRAIN_BOUNDS.posJitter.max}
            step={0.01}
            fmt={(v) => v.toFixed(2)}
            onChange={(v) => setGrain({ posJitter: v })}
          />
          <GrainSlider
            label="Pitch jitter"
            explainId="loop.pitchJitter"
            value={grain.pitchJitter}
            min={GRAIN_BOUNDS.pitchJitter.min}
            max={GRAIN_BOUNDS.pitchJitter.max}
            step={1}
            fmt={(v) => `${v.toFixed(0)}¢`}
            onChange={(v) => setGrain({ pitchJitter: v })}
          />
          <span className="flex items-center gap-1.5 self-start">
            <button
              type="button"
              role="switch"
              aria-checked={config.driftCoupled}
              onClick={() => api.setDriftCoupled(id, !config.driftCoupled)}
              className="rounded-full px-3 py-1 transition-all"
              style={{
                background: config.driftCoupled
                  ? 'rgba(245, 158, 11, 0.12)'
                  : 'transparent',
                border: '1px solid #44403c',
                color: config.driftCoupled ? '#fef3c7' : '#a8a29e',
              }}
              title="Couple grain wander to the drift field"
            >
              <span className={labelCaps}>
                Drift-coupled {config.driftCoupled ? 'on' : 'off'}
              </span>
            </button>
            <InfoTip id="loop.driftCoupled" label="Drift-coupled" />
          </span>
        </div>
      )}
    </div>
  );
}
