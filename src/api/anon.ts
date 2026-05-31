/**
 * Anonymous identity. Every browser/shell gets a stable `anonId` (UUID) on first
 * save, stored in the active platform's persistent store (localStorage for web,
 * Preferences for native). Header-primary: the id rides every
 * authenticated request as `x-anon-id`. A non-httpOnly cookie set by the server
 * is a best-effort recovery mirror if standard storage is cleared but cookies are
 * not — otherwise the id is lost (accepted; a future auth slice lets users claim
 * content by email).
 */
import { platform } from '@/platform';

const COOKIE_NAME = 'am_anon';

let cachedAnonId: string | null = null;
let isInitialized = false;

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

/**
 * Initialize the anonymous ID cache from the active platform's persistence layers.
 * Must be awaited on app startup (e.g. inside the AuthProvider initialization).
 */
export async function initAnonId(): Promise<string | null> {
  if (isInitialized) return cachedAnonId;

  try {
    const stored = await platform.getPersistedAnonId();
    if (stored && isUuid(stored)) {
      cachedAnonId = stored;
      isInitialized = true;
      return cachedAnonId;
    }
  } catch (e) {
    console.error('Failed to read persisted anon ID from platform', e);
  }

  // Soft recovery: a server-set cookie can survive local storage clears (web only)
  const cookie = readCookie(COOKIE_NAME);
  if (cookie && isUuid(cookie)) {
    cachedAnonId = cookie;
    await platform.setPersistedAnonId(cookie);
    isInitialized = true;
    return cachedAnonId;
  }

  isInitialized = true;
  return null;
}

/** The current anonId, or `null` if none has been established yet. */
export function getAnonId(): string | null {
  return cachedAnonId;
}

/** Persist an anonId (e.g. one freshly minted by the server). */
export function setAnonId(id: string): void {
  if (isUuid(id)) {
    cachedAnonId = id;
    void platform.setPersistedAnonId(id);
  }
}

/** Clear the local anonId (testing / "forget me"). */
export function clearAnonId(): void {
  cachedAnonId = null;
  isInitialized = false;
  void platform.clearPersistedAnonId();
}
