export default function App() {
  return (
    <div className="min-h-screen w-full bg-[#0c0a09] text-[#f5f5f4]">
      <div className="mx-auto max-w-5xl px-6 py-10 font-body">
        <header className="mb-8">
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
        </header>

        <div
          className="flex h-[360px] w-full items-center justify-center rounded-sm"
          style={{ background: '#0c0a09', border: '1px solid #1c1917' }}
        >
          <span
            className="font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: '#57534e' }}
          >
            scaffold · port arrives in checkpoint 2
          </span>
        </div>
      </div>
    </div>
  );
}
