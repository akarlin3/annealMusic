import { useState } from 'react';
import { Circle, Square } from 'lucide-react';
import type { RecorderApi } from '@/record/useRecorder';
import type { RecordingFormat } from '@/record/RealtimeRecorder';

function fmtElapsed(sec: number): string {
  const total = Math.floor(sec);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/**
 * Header record control: a format toggle (Opus/WAV) when idle, and a
 * record/stop button. While recording, a pulsing dot + mono counter replaces
 * the label. Format is chosen up front because the Opus and WAV capture paths
 * differ (MediaRecorder vs lossless PCM tap) — see docs/RECORDING.md.
 */
export default function RecordControls({
  recorder,
}: {
  recorder: RecorderApi;
}) {
  const [format, setFormat] = useState<RecordingFormat>('opus');
  const recording = recorder.state === 'recording';

  return (
    <div className="flex items-center gap-2">
      {recorder.state === 'idle' && (
        <div
          role="radiogroup"
          aria-label="Recording format"
          className="flex items-center gap-1 rounded-full p-0.5"
          style={{ border: '1px solid #292524' }}
        >
          {(['opus', 'wav'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={format === f}
              disabled={f === 'opus' && !recorder.opusSupported}
              onClick={() => setFormat(f)}
              className="rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em]"
              style={{
                background:
                  format === f ? 'rgba(245,158,11,0.15)' : 'transparent',
                color: format === f ? '#fbbf24' : '#57534e',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        aria-label={recording ? 'Stop recording' : 'Record session'}
        onClick={() =>
          recording ? void recorder.stop() : void recorder.start(format)
        }
        disabled={recorder.state === 'saving'}
        className="group flex items-center gap-2 rounded-full px-4 py-2.5 transition-all"
        style={{
          background: recording
            ? 'rgba(220, 38, 38, 0.12)'
            : 'rgba(245, 158, 11, 0.04)',
          border: `1px solid ${recording ? '#dc2626' : '#44403c'}`,
          color: '#d6d3d1',
        }}
      >
        {recording ? (
          <>
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full"
              style={{ background: '#dc2626' }}
            />
            <Square size={11} strokeWidth={1.5} style={{ color: '#dc2626' }} />
            <span className="font-mono text-[11px] tabular-nums tracking-[0.1em]">
              {fmtElapsed(recorder.elapsedSec)}
            </span>
          </>
        ) : (
          <>
            <Circle
              size={11}
              strokeWidth={1.5}
              fill="#dc2626"
              style={{ color: '#dc2626' }}
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
              {recorder.state === 'saving' ? 'Saving…' : 'Record'}
            </span>
          </>
        )}
      </button>
    </div>
  );
}
