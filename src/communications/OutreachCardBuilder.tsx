import { useState } from 'react';
import { api, getErrorMessage } from '@/api/client';
import type { RenderedArtifactOut } from '@/api/types';
import { Share2, Sparkles, Loader2, Play } from 'lucide-react';

interface OutreachCardBuilderProps {
  sourceKind: 'patch' | 'piece' | 'sonification' | 'listening_session';
  sourceId: string;
  title: string;
  creator: string;
  doi?: string;
  showToast: (msg: string) => void;
  onCardGenerated?: (artifact: RenderedArtifactOut) => void;
}

const PRESET_PALETTES = [
  { name: 'Amber Glow', bg: '0c0a09', fg: 'faf9f6', accent: 'f59e0b' },
  { name: 'Ocean Frost', bg: '0f172a', fg: 'f8fafc', accent: '38bdf8' },
  { name: 'Amethyst Calm', bg: '181024', fg: 'fcfaff', accent: 'c084fc' },
];

export default function OutreachCardBuilder({
  sourceKind,
  sourceId,
  title,
  creator,
  doi,
  showToast,
  onCardGenerated,
}: OutreachCardBuilderProps) {
  const [bg, setBg] = useState('0c0a09');
  const [fg, setFg] = useState('faf9f6');
  const [accent, setAccent] = useState('f59e0b');
  const [loading, setLoading] = useState(false);

  const applyPreset = (preset: (typeof PRESET_PALETTES)[0]) => {
    setBg(preset.bg);
    setFg(preset.fg);
    setAccent(preset.accent);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const art = await api.generateOutreachCard({
        source_kind: sourceKind,
        source_id: sourceId,
        resolution: '1280x720',
      });
      showToast('Outreach Social Card pack generated successfully!');
      if (onCardGenerated) onCardGenerated(art);
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to generate outreach card'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-6 border border-stone-850 grid grid-cols-1 md:grid-cols-2 gap-6 relative overflow-hidden"
      style={{
        background: 'rgba(12, 10, 9, 0.9)',
        backdropFilter: 'blur(20px)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Configuration Controls */}
      <div className="space-y-5">
        <div>
          <h3 className="text-stone-200 text-sm font-semibold mb-1 flex items-center gap-2">
            <Share2 size={16} className="text-violet-400" />
            Outreach Card Pack Builder
          </h3>
          <p className="text-[11px] text-stone-400 leading-relaxed">
            Customize colors to style the Open Graph social cards and audio
            abstracts for maximum outreach impact.
          </p>
        </div>

        {/* Color Presets */}
        <div className="space-y-2">
          <label className="text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono">
            Presets
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_PALETTES.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyPreset(preset)}
                className="px-3 py-1.5 rounded-lg border border-stone-800 text-[10px] text-stone-300 hover:text-white transition-colors bg-stone-900/60 hover:bg-stone-850 flex items-center gap-1.5"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: `#${preset.accent}` }}
                />
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Custom hex colors */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label
              htmlFor="custom-bg"
              className="mb-2 block text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono"
            >
              BG Color
            </label>
            <input
              id="custom-bg"
              type="text"
              value={bg}
              onChange={(e) => setBg(e.target.value.replace(/#/g, ''))}
              className="w-full rounded-lg px-2.5 py-1.5 font-mono text-[11px] bg-stone-950 border border-stone-800 text-stone-300 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="custom-fg"
              className="mb-2 block text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono"
            >
              FG Color
            </label>
            <input
              id="custom-fg"
              type="text"
              value={fg}
              onChange={(e) => setFg(e.target.value.replace(/#/g, ''))}
              className="w-full rounded-lg px-2.5 py-1.5 font-mono text-[11px] bg-stone-950 border border-stone-800 text-stone-300 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="custom-accent"
              className="mb-2 block text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono"
            >
              Accent Color
            </label>
            <input
              id="custom-accent"
              type="text"
              value={accent}
              onChange={(e) => setAccent(e.target.value.replace(/#/g, ''))}
              className="w-full rounded-lg px-2.5 py-1.5 font-mono text-[11px] bg-stone-950 border border-stone-800 text-stone-300 focus:outline-none"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl py-3 font-mono text-[10px] uppercase tracking-[0.2em] bg-violet-600 hover:bg-violet-500 text-white transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Compiling Card Pack...
            </>
          ) : (
            <>
              <Sparkles size={12} />
              Build Card Pack
            </>
          )}
        </button>
      </div>

      {/* Mock Interactive Card Preview */}
      <div className="flex flex-col justify-center items-center">
        <label className="mb-2 block text-[9px] uppercase tracking-[0.18em] text-stone-500 font-mono self-start">
          Social Preview Mockup
        </label>
        <div
          className="w-full aspect-[16/9] rounded-2xl p-4 border relative flex flex-col justify-between overflow-hidden shadow-2xl transition-all"
          style={{
            background: `#${bg}`,
            borderColor: `rgba(255, 255, 255, 0.08)`,
            color: `#${fg}`,
          }}
        >
          {/* Subtle accent glow */}
          <div
            className="absolute top-1/2 left-1/2 w-48 h-48 rounded-full pointer-events-none filter blur-[50px] -translate-x-1/2 -translate-y-1/2 opacity-30"
            style={{ background: `#${accent}` }}
          />

          {/* Social header banner */}
          <div className="flex items-center justify-between z-10">
            <span
              className="text-[8px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border"
              style={{
                borderColor: `#${accent}40`,
                color: `#${accent}`,
                background: `#${accent}10`,
              }}
            >
              Scholarly Output
            </span>
            {doi && (
              <span className="text-[8px] opacity-60 font-mono">
                DOI: {doi}
              </span>
            )}
          </div>

          {/* Simulated orbit visualizer rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
            <div
              className="w-20 h-20 rounded-full border border-dashed animate-spin"
              style={{ borderColor: `#${accent}30`, animationDuration: '20s' }}
            />
            <div
              className="w-32 h-32 absolute rounded-full border animate-reverse-spin"
              style={{ borderColor: `#${accent}15`, animationDuration: '30s' }}
            />
          </div>

          {/* Player controls preview */}
          <div className="flex items-center gap-3.5 z-10">
            <button
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105 shrink-0"
              style={{ background: `#${accent}`, color: `#${bg}` }}
            >
              <Play size={14} fill={`#${bg}`} />
            </button>
            <div className="min-w-0">
              <h4 className="text-xs font-semibold truncate leading-snug">
                {title}
              </h4>
              <p className="text-[9px] opacity-70 truncate mt-0.5">
                by {creator}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
