import { useState } from 'react';
import { api } from '@/api/client';
import { ApiError, NetworkError, type Visibility } from '@/api/types';
import type { RealtimeRecording } from '@/record/RealtimeRecorder';

interface RecordingDialogProps {
  recording: RealtimeRecording;
  /** Source patch id to reference, if the live session came from a saved patch. */
  patchId?: string | null;
  onClose: () => void;
  onSaved: (shortSlug: string) => void;
  showToast: (msg: string) => void;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

/** Post-recording save dialog: title + visibility + size estimate, then upload. */
export default function RecordingDialog({
  recording,
  patchId,
  onClose,
  onSaved,
  showToast,
}: RecordingDialogProps) {
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('unlisted');
  const [busy, setBusy] = useState(false);

  const save = async (): Promise<void> => {
    setBusy(true);
    try {
      const rec = await api.uploadRecording({
        blob: recording.blob,
        format: recording.format,
        durationMs: recording.durationMs,
        title: title.trim() || undefined,
        visibility,
        patchId: patchId ?? undefined,
      });
      onSaved(rec.short_slug);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'quota_exceeded') {
        showToast('Recording quota reached');
      } else if (err instanceof NetworkError) {
        showToast('Network error — recording not saved');
      } else {
        showToast('Could not save recording');
      }
      setBusy(false);
    }
  };

  const download = (): void => {
    const url = URL.createObjectURL(recording.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annealmusic-recording.${recording.format === 'wav' ? 'wav' : 'webm'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg p-5"
        style={{ background: '#1c1917', border: '1px solid #44403c' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em]"
          style={{ color: '#fef3c7' }}
        >
          Save recording
        </h2>
        <p
          className="mb-4 font-mono text-[10px] uppercase tracking-[0.16em]"
          style={{ color: '#78716c' }}
        >
          {recording.format} · {fmtDuration(recording.durationMs)} ·{' '}
          {fmtBytes(recording.blob.size)}
        </p>

        <label
          className="mb-1 block font-body text-xs"
          style={{ color: '#a8a29e' }}
        >
          Title
        </label>
        <input
          type="text"
          value={title}
          maxLength={120}
          placeholder="Untitled session"
          onChange={(e) => setTitle(e.target.value)}
          className="mb-4 w-full rounded-md px-3 py-2 font-body text-sm"
          style={{
            background: '#0c0a09',
            border: '1px solid #44403c',
            color: '#f5f5f4',
          }}
        />

        <div className="mb-5 flex items-center gap-2">
          {(['unlisted', 'public'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVisibility(v)}
              className="rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em]"
              style={{
                background: visibility === v ? '#f59e0b' : 'transparent',
                color: visibility === v ? '#0c0a09' : '#78716c',
                border: '1px solid #44403c',
              }}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={download}
            className="font-mono text-[10px] uppercase tracking-[0.16em]"
            style={{ color: '#a8a29e' }}
          >
            Download
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ border: '1px solid #44403c', color: '#a8a29e' }}
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ background: '#f59e0b', color: '#0c0a09' }}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
