import { useEffect, useState } from 'react';
import { HelpCircle, Repeat } from 'lucide-react';
import LoopSlotCard from '@/components/LoopSlotCard';
import InfoTip from '@/components/InfoTip';
import { SLOT_IDS, type SlotId } from '@/loop/types';
import type { LoopsApi } from '@/hooks/useLoops';

interface LoopPedalProps {
  loops: LoopsApi;
  inputConnected: boolean;
}

const labelCaps = 'font-mono text-[10px] uppercase tracking-[0.22em]';

/** Map a digit key (`1`/`2`/`3`) to a slot id. */
const KEY_TO_SLOT: Record<string, SlotId> = { '1': 'A', '2': 'B', '3': 'C' };

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable
  );
}

/**
 * Loop pedal row: three slot cards plus first-class keyboard control.
 * `1`/`2`/`3` drive the context-aware primary action for slots A/B/C;
 * `Shift+1/2/3` toggle freeze. Keys are ignored while a form control is focused
 * (so sliders/selects keep working) and when a modifier other than Shift is held
 * (so browser tab shortcuts aren't shadowed).
 */
export default function LoopPedal({ loops, inputConnected }: LoopPedalProps) {
  const [showLegend, setShowLegend] = useState(false);
  const { primary, toggleFreeze } = loops;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (isTypingTarget(e.target)) return;
      const slot = KEY_TO_SLOT[e.key];
      if (!slot) return;
      e.preventDefault();
      if (e.shiftKey) toggleFreeze(slot);
      else primary(slot);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [primary, toggleFreeze]);

  return (
    <section
      className="mt-6 rounded-sm p-5"
      style={{
        background: 'rgba(245, 158, 11, 0.03)',
        border: '1px solid #1c1917',
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat size={12} strokeWidth={1.5} style={{ color: '#a8a29e' }} />
          <span className={labelCaps} style={{ color: '#a8a29e' }}>
            Loop Pedal
          </span>
          <InfoTip id="loop.slot" label="Loop pedal" />
        </div>
        <button
          type="button"
          aria-label="Loop pedal keyboard help"
          onClick={() => setShowLegend((v) => !v)}
          className="rounded-full p-1.5 transition-all"
          style={{ border: '1px solid #44403c', color: '#a8a29e' }}
        >
          <HelpCircle size={13} strokeWidth={1.5} />
        </button>
      </div>

      {showLegend && (
        <div
          className="mb-4 rounded-sm p-3 text-[12px] leading-relaxed"
          style={{
            background: '#0c0a09',
            border: '1px solid #1c1917',
            color: '#a8a29e',
          }}
        >
          <p>
            <span className="font-mono text-[#fbbf24]">1 / 2 / 3</span> — arm,
            then capture, then mute/unmute slots A / B / C.
          </p>
          <p>
            <span className="font-mono text-[#fbbf24]">Shift + 1/2/3</span> —
            freeze ↔ unfreeze (granular re-synthesis).
          </p>
          <p className="mt-1" style={{ color: '#a8a29e' }}>
            Capture starts on the first sound after arming, and auto-stops at 60
            s. Re-arming overwrites a slot — there is no undo.
          </p>
        </div>
      )}

      {!inputConnected && (
        <p className="mb-3 text-[12px]" style={{ color: '#a8a29e' }}>
          Connect an input above to capture loops.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SLOT_IDS.map((id) => (
          <LoopSlotCard
            key={id}
            id={id}
            view={loops.slots[id]}
            api={loops}
            inputConnected={inputConnected}
          />
        ))}
      </div>
    </section>
  );
}
