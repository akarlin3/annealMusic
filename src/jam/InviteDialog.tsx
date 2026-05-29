import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check } from 'lucide-react';

interface InviteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

const fieldClass =
  'w-full rounded-md bg-transparent px-3 py-2 font-mono text-[11px] outline-none transition-all text-stone-300';
const fieldStyle = { border: '1px solid #44403c', background: '#1c1917' };

export default function InviteDialog({
  isOpen,
  onClose,
  sessionId,
}: InviteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  const inviteUrl = `${window.location.origin}/jam/${sessionId}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      setCopied(false);
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  // Generate QR Code on canvas
  useEffect(() => {
    if (isOpen && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        inviteUrl,
        {
          width: 160,
          margin: 1,
          color: {
            dark: '#0c0a09', // Dark cells matching overall background
            light: '#f5f5f4', // Off-white beige light background for high camera contrast
          },
        },
        (err) => {
          if (err) console.error('[Jam] QR Code generation failed:', err);
        },
      );
    }
  }, [isOpen, inviteUrl]);

  const handleClose = () => {
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('[Jam] Clipboard copy failed:', err);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          handleClose();
        }
      }}
      className="p-0 bg-transparent border-0 outline-none backdrop:bg-[rgba(12,10,9,0.7)] backdrop:backdrop-blur-sm"
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 font-mono"
        style={{
          background: '#0c0a09',
          border: '1px solid #44403c',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-[11px] uppercase tracking-[0.22em]"
            style={{ color: '#fef3c7' }}
          >
            Invite Collaborator
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-full text-stone-500 hover:text-stone-300 transition-colors"
            aria-label="Close dialog"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-6">
          {/* QR Code Container */}
          <div className="p-3 bg-stone-900 rounded-xl border border-stone-800 shadow-inner flex items-center justify-center">
            <canvas ref={canvasRef} className="rounded-lg shadow-md" />
          </div>

          <p className="text-[11px] text-stone-400 text-center leading-relaxed max-w-xs">
            Share the invite link or scan the QR code. Your collaborator will
            sculpt the sound field with you in real time.
          </p>

          <div className="w-full space-y-2">
            <label className="block text-[9px] uppercase tracking-[0.18em] text-stone-500">
              Invite Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className={fieldClass}
                style={fieldStyle}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                onClick={copyToClipboard}
                className="p-2.5 rounded-md flex items-center justify-center transition-colors bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-white border border-stone-700"
                title="Copy Link"
              >
                {copied ? (
                  <Check size={14} className="text-green-500" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
