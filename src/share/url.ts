import type { StoreApi } from 'zustand';
import { decodeParams, encodeParams } from '@/share/encode';
import { SCHEMA_VERSION } from '@/share/schema';
import type { AnnealMusicParams, ParamStore } from '@/state/params';

const PREFIX = 's=';

/**
 * Read shared state from `window.location.hash`. Returns `null` when there is
 * no state fragment or when the schema version is unknown (caller decides UX).
 * Never throws.
 */
export function readStateFromHash(): {
  params: Partial<AnnealMusicParams>;
  warnings: string[];
} | null {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash;
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw.startsWith(PREFIX)) return null;

  const body = raw.slice(PREFIX.length);
  const colon = body.indexOf(':');
  if (colon === -1) return null;

  const version = Number(body.slice(0, colon));
  if (!Number.isInteger(version) || version !== SCHEMA_VERSION) return null;

  return decodeParams(body.slice(colon + 1));
}

/**
 * Write the current params to the URL fragment using `history.replaceState`,
 * so sculpting updates the shareable link without adding browser-history
 * entries or triggering navigation.
 */
export function writeStateToHash(params: AnnealMusicParams): void {
  if (typeof window === 'undefined') return;

  const hash = `#${PREFIX}${SCHEMA_VERSION}:${encodeParams(params)}`;
  const { pathname, search } = window.location;
  window.history.replaceState(
    window.history.state,
    '',
    pathname + search + hash,
  );
}

/**
 * Subscribe a param store to the URL: on every change, debounce and write the
 * latest params to the hash. Returns an unsubscribe function that also cancels
 * any pending write.
 */
export function subscribeStoreToHash(
  store: StoreApi<ParamStore>,
  debounceMs = 500,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = store.subscribe(() => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      writeStateToHash(store.getState().params);
    }, debounceMs);
  });

  return () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    unsubscribe();
  };
}
