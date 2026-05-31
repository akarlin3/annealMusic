import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { X, Mail } from 'lucide-react';

const ChromeIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <line x1="21.17" y1="8" x2="12" y2="8" />
    <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
    <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
  </svg>
);

const GithubIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  intent?: 'login' | 'signup' | 'add-email-to-account';
}

const fieldClass =
  'w-full rounded-md bg-transparent px-3 py-2 font-mono text-xs outline-none transition-all';
const fieldStyle = { border: '1px solid #44403c', color: '#f5f5f4' };

export default function LoginDialog({
  isOpen,
  onClose,
  intent = 'login',
}: LoginDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { requestMagicLink, triggerOAuth, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      clearError();
      setSuccess(false);
      setEmail('');
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen, clearError]);

  const handleClose = () => {
    clearError();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  const submitMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    clearError();
    try {
      await requestMagicLink(email.trim(), intent);
      setSuccess(true);
    } catch {
      // Error is set in AuthContext
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        // Close if click is outside the dialog contents
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
            {intent === 'signup'
              ? 'Create Account'
              : intent === 'add-email-to-account'
                ? 'Add Email'
                : 'Sign In'}
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

        {success ? (
          <div className="py-4 text-center">
            <Mail
              className="mx-auto mb-4"
              size={24}
              style={{ color: '#f59e0b' }}
            />
            <p className="text-xs text-stone-300 leading-relaxed">
              If <span className="text-stone-100">{email}</span> is valid, a
              magic link has been sent. Check your inbox to complete sign-in.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <form onSubmit={submitMagicLink} className="space-y-4">
              <div>
                <label
                  htmlFor="auth-email-input"
                  className="mb-2 block text-[9px] uppercase tracking-[0.18em] text-stone-500"
                >
                  Email address
                </label>
                <input
                  id="auth-email-input"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldClass}
                  style={fieldStyle}
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="rounded px-3 py-2 text-[10px] uppercase tracking-wider text-red-400 bg-red-950/20 border border-red-900/30">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full flex items-center justify-center gap-2 rounded-md py-2.5 transition-all font-semibold hover:opacity-90 disabled:opacity-50"
                style={{
                  background: '#f59e0b',
                  color: '#0c0a09',
                  boxShadow: '0 0 10px rgba(245, 158, 11, 0.2)',
                }}
              >
                <Mail size={12} />
                <span className="text-[10px] uppercase tracking-[0.2em]">
                  {loading ? 'Sending...' : 'Send Magic Link'}
                </span>
              </button>
            </form>

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-800" />
              </div>
              <span className="relative px-3 text-[9px] uppercase tracking-[0.2em] bg-[#0c0a09] text-stone-600">
                Or Continue With
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => triggerOAuth('google')}
                className="flex items-center justify-center gap-2 border rounded-md py-2 text-stone-300 hover:text-white hover:bg-stone-900/50 transition-colors"
                style={{ borderColor: '#44403c' }}
              >
                <ChromeIcon size={12} />
                <span className="text-[9px] uppercase tracking-wider font-semibold">
                  Google
                </span>
              </button>
              <button
                type="button"
                onClick={() => triggerOAuth('github')}
                className="flex items-center justify-center gap-2 border rounded-md py-2 text-stone-300 hover:text-white hover:bg-stone-900/50 transition-colors"
                style={{ borderColor: '#44403c' }}
              >
                <GithubIcon size={12} />
                <span className="text-[9px] uppercase tracking-wider font-semibold">
                  GitHub
                </span>
              </button>
            </div>

            <p className="mt-6 text-center text-[9px] uppercase tracking-[0.08em] text-stone-600 leading-normal">
              By continuing, you agree to our{' '}
              <Link
                to="/legal/terms"
                onClick={handleClose}
                className="hover:text-amber-500 underline underline-offset-2 transition-colors"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                to="/legal/privacy"
                onClick={handleClose}
                className="hover:text-amber-500 underline underline-offset-2 transition-colors"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </dialog>
  );
}
