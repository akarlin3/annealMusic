import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Square,
  MoreHorizontal,
  Flag,
  Download,
  Code,
} from 'lucide-react';
import { drawCardFrame } from '@/gallery/cardVisual';
import { galleryApi } from '@/gallery/api';
import type { GalleryItem } from '@/gallery/types';

const CARD_W = 320;
const CARD_H = 180;

interface Props {
  item: GalleryItem;
  playing: boolean;
  onTogglePreview: () => void;
  onReport: () => void;
  onEmbed: () => void;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export default function GalleryCard({
  item,
  playing,
  onTogglePreview,
  onReport,
  onEmbed,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CARD_W * dpr;
    canvas.height = CARD_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCardFrame(ctx, item.state, CARD_W, CARD_H);
  }, [item.state]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (playing) {
        void audio.play().catch(() => undefined);
      } else {
        audio.pause();
        audio.currentTime = 0;
      }
    } catch {
      // jsdom (tests) doesn't implement media playback; harmless.
    }
  }, [playing]);

  const previewReady = item.preview_status === 'ready';
  const title = item.title?.trim() || 'Untitled';

  const onLoad = async () => {
    await galleryApi.load(item.short_slug);
    navigate(`/p/${item.short_slug}`);
  };

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg"
      style={{ border: '1px solid #292524', background: '#0f0d0c' }}
    >
      <div className="relative">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: CARD_H, display: 'block' }}
        />
        <div className="absolute left-2 top-2 flex gap-1.5">
          <Badge>{item.engine}</Badge>
          <Badge>{item.mode}</Badge>
          {item.has_captures && <Badge>captures</Badge>}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="font-display text-lg leading-tight"
            style={{ color: '#fef3c7' }}
          >
            {truncate(title, 48)}
          </h3>
          <div className="relative">
            <button
              aria-label="More"
              onClick={() => setMenuOpen((v) => !v)}
              style={{ color: '#78716c' }}
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 z-10 mt-1 rounded-md py-1"
                style={{ background: '#1c1917', border: '1px solid #292524' }}
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onEmbed();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs"
                  style={{ color: '#d6d3d1' }}
                >
                  <Code size={12} /> Get embed code
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onReport();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs"
                  style={{ color: '#d6d3d1' }}
                >
                  <Flag size={12} /> Report
                </button>
              </div>
            )}
          </div>
        </div>

        {item.description && (
          <p className="text-xs" style={{ color: '#a8a29e' }}>
            {truncate(item.description, 110)}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            {previewReady ? (
              <button
                onClick={onTogglePreview}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em]"
                style={{
                  border: '1px solid #44403c',
                  color: '#fef3c7',
                  background: playing ? 'rgba(245,158,11,0.12)' : 'transparent',
                }}
              >
                {playing ? <Square size={11} /> : <Play size={11} />}
                {playing ? 'Stop' : 'Preview'}
              </button>
            ) : (
              <span
                className="font-mono text-[10px] uppercase tracking-[0.15em]"
                style={{ color: '#57534e' }}
              >
                {item.preview_status === 'failed'
                  ? 'no preview'
                  : 'preview rendering'}
              </span>
            )}
            <span
              className="font-mono text-[10px]"
              style={{ color: '#57534e' }}
            >
              {item.load_count} loads
            </span>
          </div>

          <button
            onClick={onLoad}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em]"
            style={{ border: '1px solid #44403c', color: '#f59e0b' }}
          >
            <Download size={11} /> Load
          </button>
        </div>
      </div>

      {previewReady && (
        <audio
          ref={audioRef}
          src={galleryApi.previewUrl(item.short_slug)}
          preload="none"
          onEnded={onTogglePreview}
        />
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]"
      style={{ background: 'rgba(0,0,0,0.55)', color: '#d6d3d1' }}
    >
      {children}
    </span>
  );
}
