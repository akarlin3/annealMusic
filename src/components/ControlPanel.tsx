import {
  CONTROL_DEFS,
  VOLUME_DEF,
  type ControlDef,
  type ControlGroup,
  type AnnealMusicParams,
  type ParamKey,
} from '@/state/params';

interface ControlPanelProps {
  params: AnnealMusicParams;
  setParam: (key: ParamKey, value: number) => void;
  isPlaying: boolean;
}

const GROUPS: ControlGroup[] = ['Pitch', 'Physics', 'Tone'];

function Slider({
  def,
  value,
  disabled,
  onChange,
}: {
  def: ControlDef;
  value: number;
  disabled: boolean;
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
              locked
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
}: ControlPanelProps) {
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
                  disabled={Boolean(c.lockWhilePlaying && isPlaying)}
                  onChange={(v) => setParam(c.key, v)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

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
