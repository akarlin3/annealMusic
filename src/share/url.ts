import type { StoreApi } from 'zustand';
import {
  decodeState,
  encodeState,
  type DecodedState,
  type SessionConfig,
} from '@/share/encode';
import { SCHEMA_VERSION, SUPPORTED_SCHEMA_VERSIONS } from '@/share/schema';
import type { AnnealMusicParams, ParamStore } from '@/state/params';
import type { EngineId, EngineParams } from '@/audio/engines/types';

const PREFIX = 's=';

/**
 * Read shared state from `window.location.hash`. Returns `null` when there is
 * no state fragment or when the schema version is unsupported (caller decides
 * UX). Never throws. v1 fragments decode with `engine=sine`.
 */
export function readStateFromHash(): DecodedState | null {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash;
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw.startsWith(PREFIX)) return null;

  const body = raw.slice(PREFIX.length);
  const colon = body.indexOf(':');
  if (colon === -1) return null;

  const version = Number(body.slice(0, colon));
  if (!Number.isInteger(version)) return null;
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(version)) return null;

  return decodeState(version, body.slice(colon + 1));
}

/**
 * Write the current state to the URL fragment via `history.replaceState`, so
 * sculpting updates the shareable link without adding history entries or
 * triggering navigation.
 */
export function writeStateToHash(
  params: AnnealMusicParams,
  engineId: EngineId = 'sine',
  engineParams: EngineParams = {},
  session?: SessionConfig,
): void {
  if (typeof window === 'undefined') return;

  const hash = `#${PREFIX}${SCHEMA_VERSION}:${encodeState(params, engineId, engineParams, session)}`;
  const { pathname, search } = window.location;
  window.history.replaceState(
    window.history.state,
    '',
    pathname + search + hash,
  );
}

/**
 * Build the full shareable URL (origin + path + `#s=N:` + payload) for the
 * given state, without mutating the current location.
 */
export function buildShareUrl(
  params: AnnealMusicParams,
  engineId: EngineId = 'sine',
  engineParams: EngineParams = {},
  session?: SessionConfig,
): string {
  const base =
    typeof window === 'undefined'
      ? ''
      : window.location.origin + window.location.pathname;
  return `${base}#${PREFIX}${SCHEMA_VERSION}:${encodeState(params, engineId, engineParams, session)}`;
}

/**
 * Subscribe a param store to the URL: on every change, debounce and write the
 * latest state to the hash. Returns an unsubscribe function that also cancels
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
      const state = store.getState();
      writeStateToHash(
        state.params,
        state.engineId,
        state.engineParams[state.engineId] ?? {},
        {
          mode: state.sessionMode,
          arcId: state.arcId,
          durationSec: state.arcDurationSec,
        },
      );
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
