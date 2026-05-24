/**
 * Anonymous identity. Every browser gets a stable `anonId` (UUID) on first
 * save, stored in `localStorage`. Header-primary: the id rides every
 * authenticated request as `x-anon-id`. A non-httpOnly cookie set by the server
 * is a best-effort recovery mirror if `localStorage` is cleared but cookies are
 * not — otherwise the id is lost (accepted; a future auth slice lets users claim
 * content by email).
 */

const STORAGE_KEY = 'am_anon_id';
const COOKIE_NAME = 'am_anon';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** The current anonId, or `null` if none has been established yet. */
export function getAnonId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && isUuid(stored)) return stored;

  // Soft recovery: a server-set cookie can survive a localStorage clear.
  const cookie = readCookie(COOKIE_NAME);
  if (cookie && isUuid(cookie)) {
    localStorage.setItem(STORAGE_KEY, cookie);
    return cookie;
  }
  return null;
}

/** Persist an anonId (e.g. one freshly minted by the server). */
export function setAnonId(id: string): void {
  if (isUuid(id) && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, id);
  }
}

/** Clear the local anonId (testing / "forget me"). */
export function clearAnonId(): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
}
