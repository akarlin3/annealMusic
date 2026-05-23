import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

function ArchLayer({
  label,
  items,
  muted = false,
}: {
  label: string;
  items: string[];
  muted?: boolean;
}) {
  return (
    <div className="grid grid-cols-12 items-stretch gap-3">
      <div className="col-span-2 flex items-center">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: muted ? '#44403c' : '#78716c' }}
        >
          {label}
        </span>
      </div>
      <div
        className="col-span-10 grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
      >
        {items.map((it) => (
          <div
            key={it}
            className="rounded-sm px-3 py-2.5 text-[12px]"
            style={{
              background: muted ? 'transparent' : '#14110f',
              border: muted ? '1px dashed #292524' : '1px solid #292524',
              color: muted ? '#78716c' : '#d6d3d1',
            }}
          >
            {it}
          </div>
        ))}
      </div>
    </div>
  );
}

function ArchArrow() {
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-2" />
      <div className="col-span-10 flex justify-center">
        <div style={{ width: 1, height: 12, background: '#292524' }} />
      </div>
    </div>
  );
}

export default function ArchitectureDiagram() {
  const [showArch, setShowArch] = useState(true);

  return (
    <section>
      <button
        onClick={() => setShowArch((s) => !s)}
        className="group flex items-center gap-2"
      >
        <span
          className="font-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: '#a8a29e' }}
        >
          Architecture
        </span>
        {showArch ? (
          <ChevronUp size={12} style={{ color: '#78716c' }} />
        ) : (
          <ChevronDown size={12} style={{ color: '#78716c' }} />
        )}
      </button>

      {showArch && (
        <div className="mt-6 space-y-3">
          <ArchLayer
            label="Interaction"
            items={['Sculpt Controls', 'Visualizer', 'Session Controls']}
          />
          <ArchArrow />
          <ArchLayer label="State" items={['Parameter Model (React)']} />
          <ArchArrow />
          <ArchLayer
            label="Engine"
            items={['Audio Graph (Web Audio)', 'Visual Loop (Canvas)']}
          />
          <ArchArrow />
          <ArchLayer
            label="Physics"
            items={['Coupled Oscillators', 'OU Drift', 'Harmonic Lattice']}
          />

          <div className="pt-6">
            <div
              className="mb-3 font-mono text-[9px] uppercase tracking-[0.22em]"
              style={{ color: '#57534e' }}
            >
              Future
            </div>
            <ArchLayer
              label=""
              items={[
                'Instrument Input',
                'Session Arc',
                'Persistence / Sessions',
                'Capacitor → Android',
              ]}
              muted
            />
          </div>
        </div>
      )}
    </section>
  );
}
