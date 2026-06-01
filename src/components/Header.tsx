import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HelpCircle, User } from 'lucide-react';
import { useMode } from '@/mode/useMode';
import { ModeSwitcher } from '@/mode/ModeSwitcher';
import { useAuth } from '@/auth/AuthProvider';
import { LissajousAvatar } from '@/components/LissajousAvatar';
import { MODE_VISIBILITY } from '@/mode/modeVisibility';

interface HeaderProps {
  subtitle?: string;
  showHelp?: boolean;
  onHelpClick?: () => void;
  children?: React.ReactNode;
}

export function Header({
  subtitle,
  showHelp = false,
  onHelpClick,
  children,
}: HeaderProps) {
  const { mode } = useMode();
  const { account } = useAuth();
  const location = useLocation();

  const affordances = mode ? MODE_VISIBILITY[mode] : null;

  return (
    <header className="mb-8 flex flex-col gap-5">
      {/* Row 1 — brand identity and primary navigation */}
      <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3">
            <Link to="/" className="hover:opacity-90 transition-opacity">
              <h1
                className="font-display text-5xl tracking-tight"
                style={{ color: '#fef3c7' }}
              >
                <em>AnnealMusic</em>
              </h1>
            </Link>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone-500">
              v9.0
            </span>
          </div>
          {subtitle && (
            <p className="mt-1 max-w-md font-body text-sm leading-relaxed text-stone-400">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Persistent Mode Switcher */}
          <ModeSwitcher />

          {/* Dynamic Mode-aware Navigation Links */}
          <div className="flex items-center gap-3 border-l border-[var(--color-border)] pl-3">
            {/* Help Action */}
            {showHelp && onHelpClick && (
              <button
                type="button"
                aria-label="What is AnnealMusic? Open help"
                onClick={onHelpClick}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all border border-stone-800 text-stone-400 hover:text-stone-200 bg-stone-950/20 cursor-pointer"
              >
                <HelpCircle size={13} strokeWidth={1.5} />
                <span className="font-mono text-[11px] uppercase tracking-[0.18em]">
                  Help
                </span>
              </button>
            )}

            {/* Musician/Meditation Links */}
            {affordances?.showGallery && (
              <Link
                to="/gallery"
                className={`font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
                  location.pathname === '/gallery'
                    ? 'text-amber-400 font-semibold'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Gallery
              </Link>
            )}

            {affordances?.showTimeline && (
              <Link
                to="/piece"
                className={`font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
                  location.pathname === '/piece'
                    ? 'text-amber-400 font-semibold'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Timeline
              </Link>
            )}

            {affordances?.showCuratedLibrary && (
              <Link
                to="/listen"
                className={`font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
                  location.pathname === '/listen'
                    ? 'text-amber-400 font-semibold'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Listen
              </Link>
            )}

            {mode === 'meditation' && (
              <Link
                to="/timer"
                className={`font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
                  location.pathname === '/timer'
                    ? 'text-amber-400 font-semibold'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Timer
              </Link>
            )}

            {/* User Account / Sign In */}
            {account ? (
              <Link
                to="/account"
                className="flex items-center gap-2 rounded-full pl-2 pr-3 py-1 transition-all border border-stone-800 hover:border-stone-700 bg-stone-950/20"
                title={`Logged in as ${account.display_name ?? account.email}`}
              >
                <LissajousAvatar
                  seed={account.avatar_seed ?? 'default'}
                  size={20}
                />
                <span className="font-mono text-[10px] uppercase tracking-wider text-stone-300 max-w-[80px] truncate">
                  {account.display_name ?? 'Settings'}
                </span>
              </Link>
            ) : (
              location.pathname !== '/research.html' && (
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all border border-stone-800 text-stone-400 hover:text-stone-200 bg-stone-950/20 cursor-pointer"
                >
                  <User size={12} strokeWidth={1.5} />
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em]">
                    Sign In
                  </span>
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Row 2 — page-specific action toolbar, on its own line so it never
          crowds the brand/nav row and wraps as a single coherent group. */}
      {children && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-4">
          {children}
        </div>
      )}
    </header>
  );
}
export default Header;
