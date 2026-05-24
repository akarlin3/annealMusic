import { useCallback, useEffect, useState } from 'react';
import { adminApi, type AdminReport } from '@/admin/api';
import { ApiError } from '@/api/types';

const KEY_STORAGE = 'am_admin_key';

export default function AdminPage() {
  const [key, setKey] = useState<string | null>(() =>
    sessionStorage.getItem(KEY_STORAGE),
  );
  const [keyInput, setKeyInput] = useState('');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (k: string) => {
    setLoading(true);
    setError(null);
    try {
      setReports(await adminApi.listReports(k));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
        sessionStorage.removeItem(KEY_STORAGE);
        setKey(null);
        setError('Invalid admin key');
      } else {
        setError('Failed to load reports');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (key) void load(key);
  }, [key, load]);

  const submitKey = () => {
    const k = keyInput.trim();
    if (!k) return;
    sessionStorage.setItem(KEY_STORAGE, k);
    setKey(k);
  };

  const resolve = async (id: string, status: 'dismissed' | 'upheld') => {
    if (!key) return;
    await adminApi.resolve(key, id, status);
    void load(key);
  };

  if (!key) {
    return (
      <Shell>
        <div className="mx-auto max-w-sm pt-24">
          <h1 className="mb-4 font-display text-3xl" style={{ color: '#fef3c7' }}>
            Admin
          </h1>
          <input
            type="password"
            aria-label="Admin key"
            placeholder="Admin key"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitKey()}
            className="mb-3 w-full rounded-md p-2 text-sm outline-none"
            style={{ background: '#1c1917', border: '1px solid #44403c', color: '#e7e5e4' }}
          />
          {error && (
            <p className="mb-3 text-sm" style={{ color: '#fca5a5' }}>
              {error}
            </p>
          )}
          <button
            onClick={submitKey}
            className="rounded-full px-5 py-2 font-mono text-[11px] uppercase tracking-[0.2em]"
            style={{ border: '1px solid #44403c', color: '#fef3c7' }}
          >
            Enter
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-3xl pt-12">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-3xl" style={{ color: '#fef3c7' }}>
            Open reports
          </h1>
          <button
            onClick={() => {
              sessionStorage.removeItem(KEY_STORAGE);
              setKey(null);
            }}
            className="font-mono text-[10px] uppercase tracking-[0.2em]"
            style={{ color: '#78716c' }}
          >
            Sign out
          </button>
        </div>

        {error && (
          <p className="mb-4 text-sm" style={{ color: '#fca5a5' }}>
            {error}
          </p>
        )}
        {loading && <p style={{ color: '#78716c' }}>Loading…</p>}
        {!loading && reports.length === 0 && (
          <p style={{ color: '#78716c' }}>No open reports.</p>
        )}

        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <div
              key={r.id}
              className="rounded-md p-4"
              style={{ background: '#0f0d0c', border: '1px solid #292524' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-lg" style={{ color: '#fef3c7' }}>
                    {r.patch_title || 'Untitled'}
                  </div>
                  <div className="mt-1 font-mono text-[11px]" style={{ color: '#a8a29e' }}>
                    {r.reason} · {r.reporter} · {new Date(r.created_at).toLocaleString()}
                  </div>
                  {r.detail && (
                    <p className="mt-2 text-sm" style={{ color: '#d6d3d1' }}>
                      {r.detail}
                    </p>
                  )}
                  <a
                    href={adminApi.previewUrl(r.patch_slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block font-mono text-[11px]"
                    style={{ color: '#f59e0b' }}
                  >
                    preview ↗
                  </a>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => void resolve(r.id, 'dismissed')}
                    className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em]"
                    style={{ border: '1px solid #44403c', color: '#a8a29e' }}
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => void resolve(r.id, 'upheld')}
                    className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em]"
                    style={{ border: '1px solid #b91c1c', color: '#fca5a5' }}
                  >
                    Uphold
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full px-6" style={{ background: '#0c0a09', color: '#f5f5f4' }}>
      {children}
    </div>
  );
}
