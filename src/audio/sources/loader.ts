import { SOURCES, sourceById, type SourceDef } from '@/audio/sources/registry';

/**
 * Lazy loader for granular source buffers. Fetches the Opus asset and decodes it
 * via the audio context, caching the decoded `AudioBuffer` per session. The cache
 * is keyed by source id and stores the in-flight promise, so concurrent requests
 * for the same source dedupe to a single fetch+decode. A failed load is evicted
 * so a later attempt can retry cleanly.
 */
const cache = new Map<string, Promise<AudioBuffer>>();

export function loadSource(
  ctx: AudioContext,
  id: string,
): Promise<AudioBuffer> {
  const def = sourceById(id);
  if (!def) {
    return Promise.reject(new Error(`unknown source: ${id}`));
  }
  const existing = cache.get(id);
  if (existing) return existing;

  const promise = fetch(def.url)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`failed to fetch source ${id}: ${res.status}`);
      }
      return res.arrayBuffer();
    })
    .then((bytes) => ctx.decodeAudioData(bytes))
    .catch((err: unknown) => {
      cache.delete(id);
      throw err;
    });

  cache.set(id, promise);
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
export function isSourceCached(id: string): boolean {
  return cache.has(id);
}

/** Drop the in-memory cache (tests + full teardown). */
export function clearSourceCache(): void {
  cache.clear();
}
