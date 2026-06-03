import { getBellById } from './registry';

export class BellLoader {
  private static cache = new Map<string, AudioBuffer>();
  private static pending = new Map<string, Promise<AudioBuffer>>();

  /**
   * Lazily loads, decodes, and caches a bell sample.
   * Uses BaseAudioContext for compatibility with OfflineAudioContext.
   */
  static async loadBell(
    ctx: BaseAudioContext,
    id: string,
  ): Promise<AudioBuffer> {
    const cached = this.cache.get(id);
    if (cached) return cached;

    // Deduplicate concurrent load requests for the same bell
    const existingPending = this.pending.get(id);
    if (existingPending) return existingPending;

    const promise = (async () => {
      const def = getBellById(id);
      if (!def) {
        throw new Error(`[BellLoader] unknown bell id: ${id}`);
      }

      // Check if running on user client, absolute path or relative to base
      const baseUrl = import.meta.env.BASE_URL || '/';
      const url = `${baseUrl}${def.file}`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();

        // Decode audio data safely
        const audioBuffer = await new Promise<AudioBuffer>(
          (resolve, reject) => {
            ctx.decodeAudioData(arrayBuffer, resolve, reject);
          },
        );

        this.cache.set(id, audioBuffer);
        return audioBuffer;
      } catch (err) {
        console.error(`[BellLoader] Failed to load/decode bell ${id}:`, err);
        throw err;
      } finally {
        this.pending.delete(id);
      }
    })();

    this.pending.set(id, promise);
    return promise;
  }

  /** Force preloading a list of bells (useful for offline rendering / standalone timer) */
  static async preloadBells(
    ctx: BaseAudioContext,
    ids: string[],
  ): Promise<void> {
    await Promise.all(
      ids.map((id) => this.loadBell(ctx, id).catch(() => undefined)),
    );
  }

  /** Clears the cache to release memory */
  static clearCache(): void {
    this.cache.clear();
    this.pending.clear();
  }
}
