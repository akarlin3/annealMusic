import { ARC_DURATION, PRESET_ARCS, getArcById } from '@/session/arcs';
import { engineCapabilities } from '@/audio/engines/index';
import type { ArcTargetKey } from '@/session/types';
import type { EngineId } from '@/audio/engines/types';

interface ArcPanelProps {
  arcId: string;
  setArcId: (id: string) => void;
  durationSec: number;
  setDurationSec: (sec: number) => void;
  engineId: EngineId;
  disabled?: boolean;
}

/** True if any segment of the arc targets `density`. */
function arcTargetsDensity(id: string): boolean {
  const arc = getArcById(id);
  if (!arc) return false;
  return arc.segments.some(
    (seg) =>
      seg.targets !== 'restoreStart' &&
      ('density' as ArcTargetKey) in seg.targets,
  );
}

function minutesLabel(sec: number): string {
  return `${Math.round(sec / 60)} min`;
}

/**
 * Arc configuration surface: a preset picker, a duration slider, and a one-line
 * summary. Rendered only when session mode is "arc". Locked (read-only) while a
 * session is running.
 */
export default function ArcPanel({
  arcId,
  setArcId,
  durationSec,
  setDurationSec,
  engineId,
  disabled = false,
}: ArcPanelProps) {
  const selected = getArcById(arcId) ?? PRESET_ARCS[0]!;
  const densityHeld =
    engineCapabilities(engineId).densityLockedWhilePlaying &&
    arcTargetsDensity(selected.id);

  return (
    <div
      className="mt-6 transition-opacity duration-300"
      style={{ opacity: disabled ? 0.6 : 1 }}
    >
      <div
        role="radiogroup"
        aria-label="Preset arc"
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {PRESET_ARCS.map((arc) => {
          const active = arc.id === selected.id;
          return (
            <button
              key={arc.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => setArcId(arc.id)}
              className="rounded-sm px-4 py-3 text-left transition-all"
              style={{
                background: active
                  ? 'rgba(245, 158, 11, 0.10)'
                  : 'rgba(245, 158, 11, 0.02)',
                border: active ? '1px solid #f59e0b' : '1px solid #1c1917',
                boxShadow: active ? '0 0 12px rgba(245,158,11,0.12)' : 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <div
                className="font-mono text-[11px] uppercase tracking-[0.18em]"
                style={{ color: active ? '#fef3c7' : '#a8a29e' }}
              >
                {arc.name}
              </div>
              <div className="mt-1 text-[12px]" style={{ color: '#78716c' }}>
                {arc.description}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 max-w-xs">
        <div className="mb-1.5 flex items-baseline justify-between">
          <label
            className="font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: '#78716c' }}
          >
            Duration
          </label>
          <span
            className="font-mono text-[11px] tabular-nums"
            style={{ color: disabled ? '#57534e' : '#fbbf24' }}
          >
            {minutesLabel(durationSec)}
          </span>
        </div>
        <input
          type="range"
          aria-label="Arc duration"
          className="am-range"
          min={ARC_DURATION.min}
          max={ARC_DURATION.max}
          step={ARC_DURATION.step}
          value={durationSec}
          disabled={disabled}
          onChange={(e) => setDurationSec(parseFloat(e.target.value))}
        />
      </div>

      <div
        className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em]"
        style={{ color: '#57534e' }}
      >
        {selected.name} · {minutesLabel(durationSec)} ·{' '}
        {selected.description.replace(/\.$/, '').toLowerCase()}
        {densityHeld && (
          <span style={{ color: '#78716c' }}> · density held</span>
        )}
      </div>
    </div>
  );
}
