import { useMemo, useState } from 'react';
import InfoTip from '@/components/InfoTip';

interface EmbedDialogProps {
  /** Patch slug or id for the `/embed/<slug>` URL. */
  slug: string;
  title: string;
  onClose: () => void;
  showToast: (msg: string) => void;
}

const SIZE_PRESETS = [
  { label: 'Compact', w: 420, h: 80 },
  { label: 'Standard', w: 560, h: 80 },
  { label: 'Wide', w: 720, h: 120 },
];

/** Shows copy-pastable `<iframe>` HTML for embedding a public patch. */
export default function EmbedDialog({
  slug,
  title,
  onClose,
  showToast,
}: EmbedDialogProps) {
  const [preset, setPreset] = useState(1);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const snippet = useMemo(() => {
    const size = SIZE_PRESETS[preset] ?? SIZE_PRESETS[1]!;
    const src = `${window.location.origin}/embed/${slug}?theme=${theme}`;
    return (
      `<iframe src="${src}" width="${size.w}" height="${size.h}" ` +
      `frameborder="0" loading="lazy" ` +
      `title="${title.replace(/"/g, '&quot;')} — AnnealMusic"></iframe>`
    );
  }, [preset, theme, slug, title]);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(snippet);
      showToast('Embed code copied');
    } catch {
      showToast('Copy failed — select and copy manually');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg p-5"
        style={{ background: '#1c1917', border: '1px solid #44403c' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="mb-4 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.22em]"
          style={{ color: '#fef3c7' }}
        >
          Embed this patch
          <InfoTip id="embed.code" label="Embed code" />
        </h2>

        <div className="mb-3 flex flex-wrap gap-2">
          {SIZE_PRESETS.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setPreset(i)}
              className="rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em]"
              style={{
                background: preset === i ? '#f59e0b' : 'transparent',
                color: preset === i ? '#0c0a09' : '#a8a29e',
                border: '1px solid #44403c',
              }}
            >
              {s.label}
            </button>
          ))}
          <span className="mx-1 self-center" style={{ color: '#44403c' }}>
            ·
          </span>
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className="rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em]"
              style={{
                background: theme === t ? '#f59e0b' : 'transparent',
                color: theme === t ? '#0c0a09' : '#a8a29e',
                border: '1px solid #44403c',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <textarea
          readOnly
          value={snippet}
          rows={4}
          onClick={(e) => e.currentTarget.select()}
          className="mb-4 w-full rounded-md p-3 font-mono text-[11px]"
          style={{
            background: '#0c0a09',
            border: '1px solid #44403c',
            color: '#d6d3d1',
            resize: 'none',
          }}
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ border: '1px solid #44403c', color: '#a8a29e' }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            className="rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ background: '#f59e0b', color: '#0c0a09' }}
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}
