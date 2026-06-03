import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HelpCircle, User } from 'lucide-react';
import { ModeSwitcher } from '@/mode/ModeSwitcher';
import { useAuth } from '@/auth/AuthProvider';
import { LissajousAvatar } from '@/components/LissajousAvatar';

interface HeaderProps {
  subtitle?: string;
  showHelp?: boolean;
  onHelpClick?: () => void;
  onSignInClick?: () => void;
  children?: React.ReactNode;
}

/**
 * Intent-based navigation, ported from the Anneal design prototype
 * (`prototypes/anneal/`): 5 primary groups, each owning one or more routes.
 * Grouped destinations expose a calm sub-nav pill so related surfaces read as
 * one place. Routes map onto the production app as follows:
 *
 *   Listen   -> /                (the instrument / sandbox)
 *   Sounds   -> /listen Curated, /gallery Community
 *   Breathe  -> /timer  Paced
 *   Learn    -> /learn.html Lessons, /experiment/preview Studies
 *   History  -> /me/sessions
 *
 * Mappings to surfaces that production structures differently (e.g. the patch
 * bank lives inside the instrument; biofeedback has no standalone route) point
 * at the closest existing destination and are noted here for future passes.
 */
interface NavChild {
  to: string;
  label: string;
  /** True for links to a separate build (full page load, not client routing). */
  external?: boolean;
}
interface NavGroup {
  id: string;
  label: string;
  children: NavChild[];
}

const NAV_GROUPS: NavGroup[] = [
  { id: 'listen', label: 'Listen', children: [{ to: '/', label: 'Listen' }] },
  {
    id: 'sounds',
    label: 'Sounds',
    children: [
      { to: '/listen', label: 'Curated' },
      { to: '/gallery', label: 'Community' },
    ],
  },
  {
    id: 'breathe',
    label: 'Breathe',
    children: [{ to: '/timer', label: 'Paced' }],
  },
  {
    id: 'learn',
    label: 'Learn',
    children: [
      { to: '/learn.html', label: 'Lessons', external: true },
      { to: '/experiment/preview', label: 'Studies' },
    ],
  },
  {
    id: 'history',
    label: 'History',
    children: [{ to: '/me/sessions', label: 'History' }],
  },
];

function groupForPath(pathname: string): NavGroup | undefined {
  // First group whose child route matches wins, so `/` resolves to Listen.
  return NAV_GROUPS.find((g) =>
    g.children.some((c) => {
      if (c.to === pathname) return true;
      if (
        c.to === '/' &&
        (pathname.startsWith('/p/') || pathname.startsWith('/jam/'))
      )
        return true;
      if (c.to === '/listen' && pathname.startsWith('/listening/')) return true;
      if (c.to === '/experiment/preview' && pathname.startsWith('/experiment/'))
        return true;
      return false;
    }),
  );
}

const PRIMARY_LINK =
  'flex items-center rounded-full px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-all';

const NavLink = React.forwardRef<
  HTMLAnchorElement,
  { child: NavChild; className: string }
>(function NavLink({ child, className }, ref) {
  return child.external ? (
    <a ref={ref} href={child.to} className={className}>
      {child.label}
    </a>
  ) : (
    <Link ref={ref} to={child.to} className={className}>
      {child.label}
    </Link>
  );
});

export function Header({
  subtitle,
  showHelp = false,
  onHelpClick,
  onSignInClick,
  children,
}: HeaderProps) {
  const { account } = useAuth();
  const location = useLocation();
  const activeGroup = groupForPath(location.pathname);

  return (
    <header className="mb-8 flex flex-col gap-5">
      {/* Row 1 — brand identity and primary navigation */}
      <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3">
            <Link to="/" className="hover:opacity-90 transition-opacity">
              <h1
                className="font-display text-5xl tracking-tight italic"
                style={{ color: '#fef3c7' }}
              >
                Anneal
              </h1>
            </Link>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone-400">
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
          {/* Primary navigation — 5 intent-based groups */}
          <nav className="flex items-center gap-0.5">
            {NAV_GROUPS.map((g) => {
              const isActive = activeGroup?.id === g.id;
              return (
                <NavLink
                  key={g.id}
                  child={g.children[0]!}
                  className={`${PRIMARY_LINK} ${
                    isActive
                      ? 'text-amber-200 bg-amber-500/[0.08]'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                />
              );
            })}
          </nav>

          {/* Persistent Mode Switcher (the three voices) */}
          <ModeSwitcher />

          <div className="flex items-center gap-3 border-l border-[var(--color-border)] pl-3">
            {/* Help Action */}
            {showHelp && onHelpClick && (
              <button
                type="button"
                aria-label="What is Anneal? Open help"
                onClick={onHelpClick}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all border border-stone-800 text-stone-400 hover:text-stone-200 bg-stone-950/20 cursor-pointer"
              >
                <HelpCircle size={13} strokeWidth={1.5} />
                <span className="font-mono text-[11px] uppercase tracking-[0.18em]">
                  Help
                </span>
              </button>
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
                  onClick={onSignInClick}
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

      {/* Sub-nav — segmented pill for grouped destinations, so related
          surfaces read as one place (matches the prototype's calm sub-nav). */}
      {activeGroup && activeGroup.children.length > 1 && (
        <div className="flex justify-center">
          <div className="flex gap-0.5 rounded-full border border-stone-800 bg-stone-900/70 p-1 backdrop-blur-md">
            {activeGroup.children.map((c) => {
              const isActive =
                c.to === location.pathname ||
                (c.to === '/listen' &&
                  location.pathname.startsWith('/listening/')) ||
                (c.to === '/experiment/preview' &&
                  location.pathname.startsWith('/experiment/'));
              return (
                <NavLink
                  key={c.to}
                  child={c}
                  className={`rounded-full px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-all ${
                    isActive
                      ? 'bg-amber-500 text-stone-950'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                />
              );
            })}
          </div>
        </div>
      )}

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
