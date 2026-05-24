import { useCallback, useRef, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { buildShareUrl } from '@/share/url';
import type { AnnealMusicParams } from '@/state/params';
import type { EngineId, EngineParams } from '@/audio/engines/types';

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
  /** Surface user feedback (toast) for copy success/failure. */
  onResult?: (message: string) => void;
}

export default function CopyLinkButton({
  params,
  engineId = 'sine',
  engineParams = {},
  onResult,
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(async () => {
    const url = buildShareUrl(params, engineId, engineParams);
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
  }, [params, engineId, engineParams, onResult]);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Copy shareable link"
      className="group flex items-center gap-2 rounded-full px-4 py-2.5 transition-all"
      style={{
        background: 'rgba(245, 158, 11, 0.04)',
        border: '1px solid #44403c',
        color: '#d6d3d1',
      }}
    >
      {copied ? (
        <Check size={13} strokeWidth={1.5} style={{ color: '#f59e0b' }} />
      ) : (
        <Link2 size={13} strokeWidth={1.5} style={{ color: '#78716c' }} />
      )}
      <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
        {copied ? 'Copied' : 'Copy Link'}
      </span>
    </button>
  );
}
