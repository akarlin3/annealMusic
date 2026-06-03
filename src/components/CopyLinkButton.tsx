import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { buildShareUrl } from '@/share/url';
import type { AnnealMusicParams } from '@/state/params';
import type { EngineId, EngineParams } from '@/audio/engines/types';
import type { LoopConfigMap } from '@/loop/types';
import { Button } from '@/design/components/Button';

/** Copy text to the clipboard, falling back to a legacy textarea + execCommand. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or unavailable — fall through to the legacy path.
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

interface CopyLinkButtonProps {
  params: AnnealMusicParams;
  engineId?: EngineId;
  engineParams?: EngineParams;
  /** Loop config to embed (buffers excluded); omitted ⇒ no loop params. */
  loops?: LoopConfigMap;
  /** Surface user feedback (toast) for copy success/failure. */
  onResult?: (message: string) => void;
  variant?: 'button' | 'menuItem';
}

export default function CopyLinkButton({
  params,
  engineId = 'sine',
  engineParams = {},
  loops,
  onResult,
  variant = 'button',
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (revertTimer.current) clearTimeout(revertTimer.current);
    };
  }, []);

  const handleClick = useCallback(async () => {
    const url = buildShareUrl(params, engineId, engineParams, undefined, loops);
    const ok = await copyToClipboard(url);

    if (ok) {
      setCopied(true);
      onResult?.('Link copied');
      if (revertTimer.current) clearTimeout(revertTimer.current);
      revertTimer.current = setTimeout(() => setCopied(false), 1500);
    } else {
      onResult?.('Copy failed — select the link to copy manually');
      window.prompt('Copy this link', url);
    }
  }, [params, engineId, engineParams, loops, onResult]);

  if (variant === 'menuItem') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.16em] text-stone-350 hover:bg-stone-900/60 hover:text-stone-100 transition-colors cursor-pointer outline-none focus-visible:bg-stone-900/60"
      >
        {copied ? (
          <Check
            size={13}
            strokeWidth={1.5}
            style={{ color: 'var(--color-accent)' }}
          />
        ) : (
          <Link2 size={13} strokeWidth={1.5} className="text-stone-400" />
        )}
        <span>{copied ? 'Copied' : 'Copy Link'}</span>
      </button>
    );
  }

  return (
    <Button
      variant="secondary"
      onClick={handleClick}
      className="group flex items-center gap-2 px-4 py-2.5"
    >
      {copied ? (
        <Check
          size={13}
          strokeWidth={1.5}
          style={{ color: 'var(--color-accent)' }}
        />
      ) : (
        <Link2
          size={13}
          strokeWidth={1.5}
          style={{ color: 'var(--color-muted)' }}
        />
      )}
      <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
        {copied ? 'Copied' : 'Copy Link'}
      </span>
    </Button>
  );
}
