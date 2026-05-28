import { useState } from 'react';
import { X } from 'lucide-react';
import { galleryApi } from '@/gallery/api';
import type { ReportReason } from '@/gallery/types';

interface Props {
  patchId: string;
  onClose: () => void;
  onDone: (message: string) => void;
}

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate', label: 'Inappropriate' },
  { value: 'other', label: 'Other' },
];

export default function ReportDialog({ patchId, onClose, onDone }: Props) {
  const [reason, setReason] = useState<ReportReason>('spam');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await galleryApi.report(patchId, reason, detail || undefined);
      onDone('Report submitted — thank you');
      onClose();
    } catch {
      onDone("Couldn't submit report");
      setSubmitting(false);
    }
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl" style={{ color: '#fef3c7' }}>
            Report patch
          </h2>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{ color: '#78716c' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 flex flex-col gap-2">
          {REASONS.map((r) => (
            <label
              key={r.value}
              className="flex items-center gap-2 text-sm"
              style={{ color: '#d6d3d1' }}
            >
              <input
                type="radio"
                name="reason"
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
              />
              {r.label}
            </label>
          ))}
        </div>

        <textarea
          placeholder="Details (optional)"
          value={detail}
          maxLength={2000}
          onChange={(e) => setDetail(e.target.value)}
          className="mb-4 w-full rounded-md p-2 text-sm outline-none"
          style={{
            background: '#0f0d0c',
            border: '1px solid #44403c',
            color: '#e7e5e4',
            minHeight: 70,
          }}
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em]"
            style={{ border: '1px solid #44403c', color: '#a8a29e' }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em]"
            style={{ border: '1px solid #b91c1c', color: '#fca5a5' }}
          >
            {submitting ? 'Sending…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
