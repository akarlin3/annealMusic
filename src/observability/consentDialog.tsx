import { useState, useEffect } from 'react';
import { Shield, Check, X } from 'lucide-react';
import { getOptInStatus, setOptInStatus } from './errorReporter';

export function ConsentDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Show dialog only if opt-in status has not been chosen yet
    if (getOptInStatus() === null) {
      setMounted(true);
      // Brief delay to allow entry animation
      const t = setTimeout(() => setIsOpen(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const handleDecision = (optIn: boolean) => {
    setOptInStatus(optIn);
    setIsOpen(false);
    // Unmount after transition finishes
    setTimeout(() => setMounted(false), 300);
  };

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 font-mono ${
        isOpen
          ? 'bg-black/60 backdrop-blur-sm'
          : 'bg-transparent pointer-events-none'
      }`}
    >
      <div
        className={`w-full max-w-md overflow-hidden rounded-2xl border transition-all duration-300 transform shadow-2xl ${
          isOpen
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-4 scale-95 opacity-0'
        }`}
        style={{
          background: 'rgba(20, 18, 16, 0.85)',
          borderColor: 'rgba(245, 158, 11, 0.15)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        }}
      >
        {/* Header decoration */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />

        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-full bg-amber-500/10 p-2 text-amber-500">
              <Shield size={20} strokeWidth={1.5} />
            </div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-100">
              Help Improve AnnealMusic?
            </h2>
          </div>

          <p className="text-xs leading-relaxed text-stone-400 mb-6 font-body">
            We prioritize your calm and privacy. To help us catch and fix audio
            glitches, websocket drops, and performance spikes, we can collect
            anonymized crash reports. All telemetry is aggressively scrubbed: we
            never collect usernames, IP addresses, audio buffers, or custom
            tuning state.
          </p>

          <div className="space-y-3 mb-6 bg-stone-950/40 rounded-xl p-3 border border-stone-900 text-[10px] uppercase tracking-wider text-stone-500">
            <div className="flex items-center gap-2">
              <Check size={11} className="text-emerald-500" />
              <span>What is shared: Error stacks & browser OS class</span>
            </div>
            <div className="flex items-center gap-2">
              <X size={11} className="text-rose-500" />
              <span>What is NOT shared: Audio, IP, credentials, & slugs</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleDecision(true)}
              className="flex-1 rounded-lg px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all duration-250 active:scale-98 hover:brightness-105"
              style={{ background: '#f59e0b', color: '#0c0a09' }}
            >
              Opt-In (Anonymized)
            </button>
            <button
              onClick={() => handleDecision(false)}
              className="flex-1 rounded-lg border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-stone-400 transition-all duration-250 active:scale-98 hover:bg-stone-900/50 hover:text-white"
              style={{ borderColor: '#292524' }}
            >
              No Thanks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
