import { ComponentType } from 'react';
import { useMode } from './useMode';
import type { AppMode } from './types';
import { Wind, Music, FlaskConical } from 'lucide-react';

export function FirstTimeModePicker() {
  const { showPicker, setMode, setShowPicker } = useMode();

  if (!showPicker) return null;

  const handleSelect = (modeId: AppMode) => {
    void setMode(modeId).then(() => {
      setShowPicker(false);
      // Hard redirect to default landing
      if (modeId === 'researcher') {
        window.location.href = '/research.html';
      } else if (modeId === 'meditation') {
        window.location.href = '/listen';
      } else {
        window.location.href = '/';
      }
    });
  };

  const handleSkip = () => {
    // Default to musician sandbox on skip
    void setMode('musician').then(() => {
      setShowPicker(false);
    });
  };

  const cards: {
    id: AppMode;
    title: string;
    description: string;
    icon: ComponentType<{
      size?: number;
      strokeWidth?: number;
      className?: string;
    }>;
    color: string;
    border: string;
    glow: string;
  }[] = [
    {
      id: 'meditation',
      title: 'Meditation Focus',
      description:
        'A minimalist ambient sanctuary. Features curated libraries, immersive breathing, focus timers, and pure physical drone sculpting.',
      icon: Wind,
      color: 'text-indigo-400',
      border: 'hover:border-indigo-500/40',
      glow: 'group-hover:bg-indigo-500/5',
    },
    {
      id: 'musician',
      title: 'Musician Sandbox',
      description:
        'The full creative soundscape engine. Multi-track loops, patches, timeline sequencing, MIDI mapping, and collaborative jam sessions.',
      icon: Music,
      color: 'text-amber-400',
      border: 'hover:border-amber-500/40',
      glow: 'group-hover:bg-amber-500/5',
    },
    {
      id: 'researcher',
      title: 'Research Console',
      description:
        'Scientific analysis tools. Features telemetry streams, OSC bridging, biofeedback datalogging, and Python-scripted psychoacoustic experiments.',
      icon: FlaskConical,
      color: 'text-sky-400',
      border: 'hover:border-sky-500/40',
      glow: 'group-hover:bg-sky-500/5',
    },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-md animate-fade-in">
      <div className="max-w-4xl w-full rounded-2xl border border-stone-800 bg-stone-900/40 backdrop-blur-xl p-8 shadow-2xl relative overflow-hidden flex flex-col items-center">
        {/* Background decorative glows */}
        <div className="absolute top-0 left-1/4 -translate-x-1/2 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 translate-x-1/2 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center max-w-xl mb-10">
          <h2
            className="font-display text-4xl tracking-tight text-stone-100 font-semibold"
            style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
          >
            Welcome to <em>AnnealMusic</em>
          </h2>
          <p className="mt-3 text-sm text-stone-400 font-body leading-relaxed">
            Choose your focus. Your selection determines the default surfaces
            and tools shown, keeping your space clean. You can switch instantly
            any time or navigate directly via URL.
          </p>
        </div>

        {/* 3 cards layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-8">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                onClick={() => handleSelect(c.id)}
                className={`group text-left p-6 rounded-xl border border-stone-850 bg-stone-950/30 hover:bg-stone-950/50 ${c.border} transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-64 shadow-lg hover:shadow-2xl cursor-pointer`}
              >
                {/* Micro glow behind icon */}
                <div
                  className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl transition-all duration-300 pointer-events-none ${c.glow}`}
                />

                <div className="flex flex-col gap-4">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-lg bg-stone-900 border border-stone-800 ${c.color} group-hover:scale-105 transition-transform duration-300`}
                  >
                    <Icon size={20} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-base font-mono uppercase tracking-wider font-semibold text-stone-200">
                      {c.title}
                    </h3>
                    <p className="mt-2 text-xs text-stone-400 font-body leading-relaxed">
                      {c.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-amber-500 font-medium group-hover:translate-x-1 transition-transform duration-200 mt-4">
                  <span>Enter Mode</span>
                  <span>→</span>
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleSkip}
          className="text-xs font-mono uppercase tracking-[0.2em] text-stone-500 hover:text-stone-300 transition-colors border border-transparent hover:border-stone-800 rounded-full px-5 py-2.5 bg-stone-900/20"
        >
          Skip to Musician Sandbox
        </button>
      </div>
    </div>
  );
}
