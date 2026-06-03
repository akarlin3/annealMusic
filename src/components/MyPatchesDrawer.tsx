import { useCallback, useState } from 'react';
import { Library, Trash2, Music2, Code } from 'lucide-react';
import type { PatchPersistence } from '@/api/usePatches';
import type { Patch } from '@/api/types';
import EmbedDialog from '@/embed/EmbedDialog';

interface MyPatchesDrawerProps {
  patches: PatchPersistence;
  /** Load a patch by slug/id into the live session. */
  onLoad: (idOrSlug: string) => Promise<boolean>;
  /** Surface a toast (e.g. "embed code copied"). */
  showToast?: (msg: string) => void;
}

export default function MyPatchesDrawer({
  patches,
  onLoad,
  showToast,
}: MyPatchesDrawerProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Patch[]>([]);
  const [busy, setBusy] = useState(false);
  const [embedTarget, setEmbedTarget] = useState<Patch | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setItems(await patches.listMine());
    setBusy(false);
  }, [patches]);

  const toggle = useCallback(() => {
    const next = !open;
    setOpen(next);
    if (next) void refresh();
  }, [open, refresh]);

  const remove = useCallback(
    async (id: string) => {
      if (await patches.deletePatch(id)) {
        setItems((prev) => prev.filter((p) => p.id !== id));
      }
    },
    [patches],
  );

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label="Open your saved patches"
        className="group flex items-center gap-2 rounded-full px-4 py-2.5 transition-all"
        style={{
          background: 'rgba(245, 158, 11, 0.04)',
          border: '1px solid #44403c',
          color: '#d6d3d1',
        }}
      >
        <Library size={13} strokeWidth={1.5} style={{ color: '#78716c' }} />
        <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
          Patches
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: 'rgba(12, 10, 9, 0.6)' }}
          onClick={() => setOpen(false)}
        >
          <aside
            className="h-full w-full max-w-sm overflow-y-auto p-6"
            style={{ background: '#0c0a09', borderLeft: '1px solid #44403c' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em]"
              style={{ color: '#fef3c7' }}
            >
              My patches
            </h2>

            {busy && (
              <p
                className="font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: '#78716c' }}
              >
                Loading…
              </p>
            )}
            {!busy && items.length === 0 && (
              <p className="font-body text-sm" style={{ color: '#78716c' }}>
                No saved patches yet.
              </p>
            )}

            <ul className="flex flex-col gap-2">
              {items.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl p-3"
                  style={{ border: '1px solid #292524' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={async () => {
                        const ok = await onLoad(p.short_slug);
                        if (ok) setOpen(false);
                      }}
                    >
                      <div
                        className="font-body text-sm"
                        style={{ color: '#f5f5f4' }}
                      >
                        {p.title || 'Untitled'}
                      </div>
                      <div
                        className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em]"
                        style={{ color: '#78716c' }}
                      >
                        <span>
                          {new Date(p.created_at).toLocaleDateString()}
                        </span>
                        {p.capture_refs.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Music2 size={10} strokeWidth={1.5} />
                            {p.capture_refs.length}
                          </span>
                        )}
                        <span>{p.visibility}</span>
                      </div>
                    </button>
                    <div className="flex items-center gap-3">
                      {p.visibility === 'public' && (
                        <button
                          type="button"
                          aria-label="Get embed code"
                          onClick={() => setEmbedTarget(p)}
                          style={{ color: '#78716c' }}
                        >
                          <Code size={14} strokeWidth={1.5} />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label="Delete patch"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Are you sure you want to delete "${p.title || 'Untitled Patch'}"?`,
                            )
                          ) {
                            void remove(p.id);
                          }
                        }}
                        style={{ color: '#78716c' }}
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}

      {embedTarget && (
        <EmbedDialog
          slug={embedTarget.short_slug}
          title={embedTarget.title ?? 'Untitled'}
          onClose={() => setEmbedTarget(null)}
          showToast={showToast ?? (() => undefined)}
        />
      )}
    </>
  );
}
