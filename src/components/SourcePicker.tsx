import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  AudioLines,
  CloudRain,
  Disc,
  Loader2,
  Piano,
  Radio,
  Sparkles,
  Waves,
  Wind,
  Music2,
  Plus,
  Settings2,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';
import { SOURCES, resolveSource } from '@/audio/sources/registry';
import { isSourceCached } from '@/audio/sources/loader';
import { api } from '@/api/client';
import type { UserSource } from '@/api/types';
import TrimDialog from '@/sources/TrimDialog';
import MySourcesPanel from '@/sources/MySourcesPanel';

const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Disc,
  Piano,
  Wind,
  Waves,
  AudioLines,
  CloudRain,
  Radio,
};

let sharedPreviewCtx: AudioContext | null = null;
function getSharedPreviewCtx(): AudioContext {
  if (!sharedPreviewCtx) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sharedPreviewCtx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
  }
  return sharedPreviewCtx;
}

interface SourcePickerProps {
  /** Selected source index or namespaced identifier. */
  value: string | number;
  onChange: (value: string | number) => void;
  disabled?: boolean;
  /** When playing, a freshly-selected source shows a loading spinner. */
  isPlaying?: boolean;
}

export default function SourcePicker({
  value,
  onChange,
  disabled = false,
  isPlaying = false,
}: SourcePickerProps) {
  const resolved = useMemo(() => resolveSource(value), [value]);

  // Tab State
  const [activeTab, setActiveTab] = useState<'bundled' | 'mine'>(() => {
    return resolved.type === 'user' ? 'mine' : 'bundled';
  });

  // User Sources State
  const [userSources, setUserSources] = useState<UserSource[]>([]);
  const [showManager, setShowManager] = useState(false);

  // Upload/Trim Dialog State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [trimBuffer, setTrimBuffer] = useState<AudioBuffer | null>(null);
  const [trimFilename, setTrimFilename] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Spinner Loading State per source ID (for both bundled & user sources)
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Keyboard navigation focus state (defaults to matching entry or 0)
  const selectedIndex = useMemo(() => {
    if (resolved.type === 'bundled') {
      const idx = SOURCES.findIndex((s) => s.id === resolved.id);
      return idx !== -1 ? idx : 0;
    }
    return 0;
  }, [resolved]);

  const [focusIdx, setFocusIdx] = useState(selectedIndex);

  // Fetch custom sources
  const fetchUserSources = useCallback(async () => {
    if (!api.isBackendConfigured()) return;
    try {
      const res = await api.myUserSources();
      setUserSources(res.items);
    } catch (err) {
      console.error('Failed to load user sources in picker', err);
    }
  }, []);

  useEffect(() => {
    void fetchUserSources();
  }, [fetchUserSources]);

  // Sync active tab with external value changes
  useEffect(() => {
    setActiveTab(resolved.type === 'user' ? 'mine' : 'bundled');
  }, [resolved]);

  // Handle spinner for in-flight decoding
  useEffect(() => {
    const key = resolved.type === 'user' ? `u:${resolved.id}` : resolved.id;
    if (!isPlaying || isSourceCached(key)) {
      setLoadingId(null);
      return;
    }
    setLoadingId(resolved.id);
    const timer = setInterval(() => {
      if (isSourceCached(key)) {
        setLoadingId(null);
        clearInterval(timer);
      }
    }, 120);
    const stop = setTimeout(() => {
      setLoadingId(null);
      clearInterval(timer);
    }, 8000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [resolved, isPlaying]);

  // File uploading triggers
  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const ctx = getSharedPreviewCtx();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      setTrimBuffer(decoded);
      setTrimFilename(file.name);
    } catch (err) {
      console.error('Failed to decode file', err);
      setUploadError('Failed to decode audio. Please check file format.');
    }
    // Clear value so the same file can be selected again
    e.target.value = '';
  };

  const handleUploadSubmit = async (blob: Blob, displayName: string) => {
    try {
      const res = await api.uploadUserSource(blob, displayName);
      await fetchUserSources();
      onChange(`u:${res.id}`);
      setTrimBuffer(null);
    } catch (err) {
      console.error('File upload failed inside picker', err);
      throw err; // throw back to let TrimDialog handle error codes (e.g. quota, moderation)
    }
  };

  // Keyboard navigation defs
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled || activeTab !== 'bundled') return;
      let next = focusIdx;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        next = (focusIdx + 1) % SOURCES.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        next = (focusIdx - 1 + SOURCES.length) % SOURCES.length;
      } else if (e.key === 'Enter' || e.key === ' ') {
        onChange(focusIdx);
        e.preventDefault();
        return;
      } else {
        return;
      }
      e.preventDefault();
      setFocusIdx(next);
    },
    [focusIdx, onChange, disabled, activeTab],
  );

  // Footer metadata matching focus or active selection
  const footerContent = useMemo(() => {
    if (activeTab === 'bundled') {
      const def = SOURCES[focusIdx] ?? SOURCES[selectedIndex];
      if (!def) return null;
      return {
        description: def.description,
        license: def.license,
        attribution: def.attribution,
      };
    } else {
      // Find matching user source
      const currentId = resolved.type === 'user' ? resolved.id : '';
      const src = userSources.find((s) => s.id === currentId);
      if (!src) {
        return {
          description:
            'Load custom audio slices up to 60s as granular sources.',
          license: 'USER CONTENT',
        };
      }
      const sizeKB = (src.bytes / 1024).toFixed(1);
      return {
        description: `Custom source: ${src.display_name || 'Untitled'} (${(src.duration_ms / 1000).toFixed(2)}s, ${sizeKB} KB)`,
        license: 'PRIVATE',
      };
    }
  }, [activeTab, focusIdx, selectedIndex, resolved, userSources]);

  const backendConfigured = api.isBackendConfigured();

  return (
    <div>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="audio/wav,audio/mp3,audio/mpeg,audio/flac,audio/ogg,audio/aac,audio/opus,audio/m4a"
        style={{ display: 'none' }}
      />

      {/* Tabs Header */}
      <div className="flex items-center justify-between border-b border-stone-850 pb-2 mb-3.5">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('bundled')}
            className={`font-mono text-[10px] uppercase tracking-[0.18em] pb-1 border-b transition-all focus:outline-none ${
              activeTab === 'bundled'
                ? 'border-amber-500 text-amber-500 font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-300'
            }`}
          >
            Bundled Bank
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mine')}
            className={`font-mono text-[10px] uppercase tracking-[0.18em] pb-1 border-b transition-all focus:outline-none ${
              activeTab === 'mine'
                ? 'border-amber-500 text-amber-500 font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-300'
            }`}
          >
            Mine
          </button>
        </div>

        {/* Manage Sources button (visible in Mine tab) */}
        {activeTab === 'mine' && backendConfigured && (
          <button
            type="button"
            onClick={() => setShowManager(true)}
            className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-stone-500 hover:text-amber-500 transition-colors"
          >
            <Settings2 size={11} />
            <span>Manage ({userSources.length})</span>
          </button>
        )}
      </div>

      {/* Tab Panels */}
      {activeTab === 'bundled' ? (
        <div
          role="radiogroup"
          aria-label="Granular source"
          onKeyDown={onKeyDown}
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          style={{ opacity: disabled ? 0.5 : 1 }}
        >
          {SOURCES.map((src, i) => {
            const active = resolved.type === 'bundled' && i === selectedIndex;
            const Icon = ICONS[src.icon] ?? Disc;
            const loading = loadingId === src.id;
            return (
              <button
                key={src.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={src.label}
                tabIndex={i === focusIdx ? 0 : -1}
                disabled={disabled}
                onClick={() => onChange(i)}
                onFocus={() => setFocusIdx(i)}
                onMouseEnter={() => setFocusIdx(i)}
                className="relative flex flex-col items-center gap-1.5 rounded-lg px-2 py-3 transition-all"
                style={{
                  background: active
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'transparent',
                  border: `1px solid ${active ? '#f59e0b' : '#1c1917'}`,
                  color: active ? '#fbbf24' : '#a8a29e',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" aria-hidden />
                ) : (
                  <Icon size={18} aria-hidden />
                )}
                <span className="text-center text-[11px] leading-tight font-mono">
                  {src.label}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        /* MINE CUSTOM PANEL */
        <div className="space-y-3">
          {!backendConfigured ? (
            <div className="rounded-lg border border-dashed border-stone-850 p-6 text-center bg-stone-950/10">
              <AlertCircle size={20} className="mx-auto text-stone-600 mb-2" />
              <p className="text-xs text-stone-500 font-mono">
                Persistent backend storage is offline. Custom audio uploads are
                unavailable.
              </p>
            </div>
          ) : (
            <div>
              {uploadError && (
                <div className="mb-3 rounded-lg border border-red-950/50 bg-red-950/10 px-3 py-2 text-[11px] font-mono text-red-400">
                  {uploadError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {/* Upload Action Card */}
                <button
                  type="button"
                  onClick={triggerFileSelect}
                  disabled={disabled || userSources.length >= 20}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-800 bg-stone-950/15 py-3 hover:border-amber-500/50 hover:bg-stone-900/10 active:bg-stone-950/50 transition-all group disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus
                    size={16}
                    className="text-stone-500 group-hover:text-amber-500 transition-colors"
                  />
                  <span className="text-[11px] font-mono text-stone-400 group-hover:text-stone-200 transition-colors">
                    Upload Audio
                  </span>
                </button>

                {/* Uploaded User Sources list */}
                {userSources.map((src) => {
                  const active =
                    resolved.type === 'user' && resolved.id === src.id;
                  const loading = loadingId === src.id;
                  return (
                    <button
                      key={src.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange(`u:${src.id}`)}
                      className="relative flex flex-col items-center gap-1.5 rounded-lg px-2 py-3 transition-all"
                      style={{
                        background: active
                          ? 'rgba(245, 158, 11, 0.12)'
                          : 'transparent',
                        border: `1px solid ${active ? '#f59e0b' : '#1c1917'}`,
                        color: active ? '#fbbf24' : '#a8a29e',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {loading ? (
                        <Loader2
                          size={18}
                          className="animate-spin"
                          aria-hidden
                        />
                      ) : (
                        <Music2 size={18} aria-hidden />
                      )}
                      <span className="text-center text-[11px] leading-tight truncate w-full px-1 font-mono">
                        {src.display_name || 'Untitled'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Info */}
      {footerContent && (
        <div
          className="mt-3 flex items-baseline justify-between gap-3 font-mono text-[10px] leading-relaxed"
          style={{ color: '#78716c' }}
        >
          <span style={{ color: '#a8a29e' }}>{footerContent.description}</span>
          <span
            className="shrink-0 uppercase tracking-[0.14em]"
            title={footerContent.attribution ?? 'Private user-uploaded asset'}
          >
            {footerContent.license}
          </span>
        </div>
      )}

      {/* Draggable Trim Modal */}
      {trimBuffer && (
        <TrimDialog
          buffer={trimBuffer}
          filename={trimFilename}
          onClose={() => setTrimBuffer(null)}
          onUpload={handleUploadSubmit}
        />
      )}

      {/* Full Account Custom Sources Manager Modal */}
      {showManager && (
        <MySourcesPanel
          onClose={() => setShowManager(false)}
          onRefreshPicker={fetchUserSources}
        />
      )}
    </div>
  );
}
