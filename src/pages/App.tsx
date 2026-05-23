import { Pause, Play } from 'lucide-react';
import { useAnnealMusic } from '@/hooks/useAnnealMusic';
import Visualizer from '@/components/Visualizer';
import ControlPanel from '@/components/ControlPanel';
import ArchitectureDiagram from '@/components/ArchitectureDiagram';

export default function App() {
  const { params, setParam, isPlaying, toggle, engineRef } = useAnnealMusic();

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: '#0c0a09', color: '#f5f5f4' }}
    >
      <div className="mx-auto max-w-5xl px-6 py-10 font-body">
        <header className="mb-8 flex items-baseline justify-between">
          <div>
            <div className="flex items-baseline gap-3">
              <h1
                className="font-display text-5xl tracking-tight"
                style={{ color: '#fef3c7' }}
              >
                <em>AnnealMusic</em>
              </h1>
              <span
                className="font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: '#78716c' }}
              >
                v0.1 · prototype
              </span>
            </div>
            <p
              className="mt-1 max-w-md font-body text-sm"
              style={{ color: '#a8a29e' }}
            >
              A generative ambient sandbox. Coupled oscillators drift over a
              harmonic lattice; you sculpt the field.
            </p>
          </div>

          <button
            onClick={toggle}
            className="group flex items-center gap-3 rounded-full px-5 py-2.5 transition-all"
            style={{
              background: isPlaying
                ? 'rgba(245, 158, 11, 0.10)'
                : 'rgba(245, 158, 11, 0.04)',
              border: '1px solid #44403c',
              color: '#fef3c7',
            }}
          >
            {isPlaying ? (
              <Pause size={14} strokeWidth={1.5} style={{ color: '#f59e0b' }} />
            ) : (
              <Play size={14} strokeWidth={1.5} style={{ color: '#f59e0b' }} />
            )}
            <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
              {isPlaying ? 'Settle' : 'Begin'}
            </span>
          </button>
        </header>

        <Visualizer engineRef={engineRef} isPlaying={isPlaying} />

        <ControlPanel
          params={params}
          setParam={setParam}
          isPlaying={isPlaying}
        />

        <div className="am-hairline my-12" />

        <ArchitectureDiagram />

        <footer
          className="mb-4 mt-16 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: '#44403c' }}
        >
          <span>annealmusic · working title</span>
          <span>kuramoto · ornstein–uhlenbeck</span>
        </footer>
      </div>
    </div>
  );
}
