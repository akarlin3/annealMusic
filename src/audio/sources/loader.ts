import {
  SOURCES,
  resolveSource,
  type SourceDef,
} from '@/audio/sources/registry';

/**
 * Lazy loader for granular source buffers. Fetches the source asset and decodes it
 * via the audio context, caching the decoded `AudioBuffer` per session. The cache
 * is keyed by a composite source key and stores the in-flight promise, so concurrent requests
 * for the same source dedupe to a single fetch+decode. A failed load is evicted
 * so a later attempt can retry cleanly.
 */
const cache = new Map<string, Promise<AudioBuffer>>();

export function loadSource(
  ctx: AudioContext,
  sourceVal: string | number,
): Promise<AudioBuffer> {
  const resolved = resolveSource(sourceVal);
  const cacheKey = `${resolved.type}:${resolved.id}`;

  const existing = cache.get(cacheKey);
  if (existing) return existing;

  const promise = fetch(resolved.url)
    .then((res) => {
      if (!res.ok) {
        if (resolved.type === 'user') {
          const msg =
            res.status === 451
              ? 'Reference source is unavailable due to a moderation action. Falling back to Glass Pad.'
              : 'Reference source was deleted or is inaccessible. Falling back to Glass Pad.';

          const event = new CustomEvent('anneal-toast', {
            detail: { message: msg },
          });
          window.dispatchEvent(event);

          console.warn(
            `[loader] User source ${resolved.id} failed with ${res.status}. Falling back to b:glasspad.`,
          );
          return fetch('/sources/glasspad.opus').then((fallbackRes) => {
            if (!fallbackRes.ok)
              throw new Error('failed to load fallback source');
            return fallbackRes.arrayBuffer();
          });
        }
        throw new Error(`failed to fetch source ${sourceVal}: ${res.status}`);
      }
      return res.arrayBuffer();
    })
    .then((bytes) => ctx.decodeAudioData(bytes))
    .catch((err: unknown) => {
      cache.delete(cacheKey);
      throw err;
    });

  cache.set(cacheKey, promise);
  return promise;
}

/** Load a source by its stable registry index. */
export function loadSourceByIndex(
  ctx: AudioContext,
  index: number,
): Promise<AudioBuffer> {
  const def: SourceDef | undefined = SOURCES[index];
  if (!def) return Promise.reject(new Error(`unknown source index: ${index}`));
  return loadSource(ctx, def.id);
}

/** Whether a source's buffer is already resolved in the cache (best-effort). */
export function isSourceCached(sourceVal: string | number): boolean {
  const resolved = resolveSource(sourceVal);
  return cache.has(`${resolved.type}:${resolved.id}`);
}

/** Drop the in-memory cache (tests + full teardown). */
export function clearSourceCache(): void {
  cache.clear();
}
