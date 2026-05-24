import { useEffect } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
  durationMs?: number;
}

/**
 * Minimal single-slot toast: the newest message replaces any current one and
 * auto-dismisses. Matches the warm-dark, hairline-bordered UI aesthetic.
 */
export default function Toast({
  toast,
  onDismiss,
  durationMs = 2000,
}: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [toast, onDismiss, durationMs]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em]"
      style={{
        background: 'rgba(12, 10, 9, 0.92)',
        border: '1px solid #44403c',
        color: '#fef3c7',
        backdropFilter: 'blur(4px)',
      }}
    >
      {toast.text}
    </div>
  );
}
