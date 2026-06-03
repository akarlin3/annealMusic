import { useState } from 'react';
import { Circle, Square } from 'lucide-react';
import InfoTip from '@/components/InfoTip';
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
  variant = 'button',
}: {
  recorder: RecorderApi;
  variant?: 'button' | 'menuItem';
}) {
  const [format, setFormat] = useState<RecordingFormat>('opus');
  const recording = recorder.state === 'recording';

  if (variant === 'menuItem') {
    return (
      <div className="flex flex-col gap-1.5 p-1 border-b border-stone-900/50 pb-2 mb-1">
        {recorder.state === 'idle' && (
          <div className="flex items-center justify-between px-2.5 py-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500">
              Rec Format
            </span>
            <div
              role="radiogroup"
              aria-label="Recording format"
              className="flex items-center gap-1 rounded-full p-0.5 border border-stone-850"
            >
              {(['opus', 'wav'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={format === f}
                  disabled={f === 'opus' && !recorder.opusSupported}
                  onClick={() => setFormat(f)}
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em] transition-colors ${
                    format === f
                      ? 'bg-amber-500/20 text-amber-405 font-medium'
                      : 'text-stone-500 hover:text-stone-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          aria-label={recording ? 'Stop recording' : 'Record session'}
          onClick={() =>
            recording ? void recorder.stop() : void recorder.start(format)
          }
          disabled={recorder.state === 'saving'}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.16em] text-stone-300 hover:bg-stone-900/60 hover:text-stone-100 transition-colors cursor-pointer outline-none focus-visible:bg-stone-900/60"
        >
          {recording ? (
            <>
              <span
                className="inline-block h-2 w-2 animate-pulse rounded-full"
                style={{ background: '#dc2626' }}
              />
              <Square
                size={11}
                strokeWidth={1.5}
                style={{ color: '#dc2626' }}
              />
              <span className="text-red-400 font-semibold">
                {fmtElapsed(recorder.elapsedSec)} · Stop
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
              <span>
                {recorder.state === 'saving' ? 'Saving…' : 'Record Session'}
              </span>
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {recorder.state === 'idle' && (
        <InfoTip id="record.format" label="Format" />
      )}
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
      {recorder.state === 'idle' && (
        <InfoTip id="record.button" label="Record" />
      )}
    </div>
  );
}
