import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { X, Mail, Chrome, Github } from 'lucide-react';

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
                <Chrome size={12} />
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
                <Github size={12} />
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
