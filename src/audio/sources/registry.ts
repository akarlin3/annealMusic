/**
 * Curated granular source bank (v0.9). Every entry ships as an Ogg/Opus file in
 * `public/sources/` and is original work released CC0 — see `LICENSES.md` and
 * `docs/SOURCES.md`. The files are regenerated deterministically by
 * `scripts/gen-sources.ts` (`npm run gen:sources`).
 *
 * INVARIANT — append-only: `index` is the stable wire identifier used by the URL
 * schema (`gr.source=<index>`, schema v5). Never reorder or remove an entry, or
 * old share links would resolve to a different source. Add new sources at the
 * end with the next index. A test enforces `index === array position` and that
 * every source has a non-empty license.
 */

export interface SourceDef {
  /** Stable wire index (append-only) — encoded in the share URL as `gr.source`. */
  readonly index: number;
  /** Stable string id; also the asset filename stem (`/sources/<id>.opus`). */
  readonly id: string;
  /** Human-facing name shown in the source picker. */
  readonly label: string;
  /** One-line description of the texture. */
  readonly description: string;
  /** SPDX-style license string (non-empty — CI enforced). */
  readonly license: string;
  /** Optional attribution line (for non-original/licensed sources). */
  readonly attribution?: string;
  /** Same-origin asset URL. */
  readonly url: string;
  /** Source duration in milliseconds. */
  readonly durationMs: number;
  /**
   * Tagged fundamental (Hz) for pitched sources, so the bank can align to
   * musical pitch; `null` for unpitched textures (the lowest partial then plays
   * at the source's native rate). See `GranularEngine` pitch mapping.
   */
  readonly fundamentalHz: number | null;
  /** lucide-react icon name for the picker tile. */
  readonly icon: string;
}

export const SOURCES: readonly SourceDef[] = [
  {
    index: 0,
    id: 'glasspad',
    label: 'Glass Pad',
    description: 'Slow-attack additive glass chord, shimmering harmonics.',
    license: 'CC0-1.0',
    url: '/sources/glasspad.opus',
    durationMs: 28000,
    fundamentalHz: 110,
    icon: 'Sparkles',
  },
  {
    index: 1,
    id: 'bowedmetal',
    label: 'Bowed Metal',
    description: 'Inharmonic bowed-bowl sustain with beating partials.',
    license: 'CC0-1.0',
    url: '/sources/bowedmetal.opus',
    durationMs: 26000,
    fundamentalHz: null,
    icon: 'Disc',
  },
  {
    index: 2,
    id: 'tapeorgan',
    label: 'Tape Organ',
    description: 'Tape-saturated organ stack with slow wow and flutter.',
    license: 'CC0-1.0',
    url: '/sources/tapeorgan.opus',
    durationMs: 28000,
    fundamentalHz: 82,
    icon: 'Piano',
  },
  {
    index: 3,
    id: 'pinewind',
    label: 'Pine Wind',
    description: 'Filtered-noise wind through pine needles, gusting.',
    license: 'CC0-1.0',
    url: '/sources/pinewind.opus',
    durationMs: 30000,
    fundamentalHz: null,
    icon: 'Wind',
  },
  {
    index: 4,
    id: 'deepdrone',
    label: 'Deep Drone',
    description: 'Low sine/triangle drone with slow detuned beating.',
    license: 'CC0-1.0',
    url: '/sources/deepdrone.opus',
    durationMs: 30000,
    fundamentalHz: 55,
    icon: 'Waves',
  },
  {
    index: 5,
    id: 'choirair',
    label: 'Choir Air',
    description: 'Formant-filtered noise, a breathy vocal-pad texture.',
    license: 'CC0-1.0',
    url: '/sources/choirair.opus',
    durationMs: 26000,
    fundamentalHz: 147,
    icon: 'AudioLines',
  },
  {
    index: 6,
    id: 'rainglass',
    label: 'Rain Glass',
    description: 'Sparse decaying raindrops on glass, transient field.',
    license: 'CC0-1.0',
    url: '/sources/rainglass.opus',
    durationMs: 28000,
    fundamentalHz: null,
    icon: 'CloudRain',
  },
  {
    index: 7,
    id: 'warmtape',
    label: 'Warm Tape',
    description: 'Pink-noise hiss and low hum, a blank-tape ambience bed.',
    license: 'CC0-1.0',
    url: '/sources/warmtape.opus',
    durationMs: 26000,
    fundamentalHz: null,
    icon: 'Radio',
  },
];

/** Default source (the one pre-warmed when granular is first selected). */
export const DEFAULT_SOURCE_INDEX = 0;

/** Look up a source by its stable index (the URL/wire identifier). */
export function sourceByIndex(index: number): SourceDef | undefined {
  return SOURCES[index];
}

/** Look up a source by its string id. */
export function sourceById(id: string): SourceDef | undefined {
  return SOURCES.find((s) => s.id === id);
}

/** Clamp an arbitrary number to a valid source index. */
export function clampSourceIndex(index: number): number {
  if (!Number.isFinite(index)) return DEFAULT_SOURCE_INDEX;
  return Math.max(0, Math.min(SOURCES.length - 1, Math.round(index)));
}

export interface ResolvedSource {
  readonly type: 'bundled' | 'user';
  readonly id: string;
  readonly url: string;
  readonly label: string;
}

/**
 * Resolve an arbitrary wire representation of a granular engine source
 * (bare index, bare string, namespaced bundled, or namespaced user UUID)
 * to a clean, canonical format with an asset URL.
 */
export function resolveSource(sourceVal: string | number): ResolvedSource {
  const baseUrl = import.meta.env.BASE_URL || '/';
  const apiBase = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
  const getBundledUrl = (url: string) => `${baseUrl}${url.replace(/^\//, '')}`;

  if (typeof sourceVal === 'number') {
    const def = SOURCES[sourceVal] ?? SOURCES[0]!;
    return {
      type: 'bundled',
      id: def.id,
      url: getBundledUrl(def.url),
      label: def.label,
    };
  }

  const str = String(sourceVal).trim();
  if (str.startsWith('b:')) {
    const cleanId = str.slice(2);
    const def = SOURCES.find((s) => s.id === cleanId) ?? SOURCES[0]!;
    return {
      type: 'bundled',
      id: def.id,
      url: getBundledUrl(def.url),
      label: def.label,
    };
  }

  if (str.startsWith('u:')) {
    const cleanId = str.slice(2);
    return {
      type: 'user',
      id: cleanId,
      url: `${apiBase}/api/v1/user-sources/${cleanId}`,
      label: 'User Source',
    };
  }

  // Backward-compat: bare numeric string (e.g. "2")
  const num = parseInt(str, 10);
  if (!isNaN(num) && String(num) === str) {
    const def = SOURCES[num] ?? SOURCES[0]!;
    return {
      type: 'bundled',
      id: def.id,
      url: getBundledUrl(def.url),
      label: def.label,
    };
  }

  // Backward-compat: bare id string (e.g. "wind-pine")
  const def = SOURCES.find((s) => s.id === str) ?? SOURCES[0]!;
  return {
    type: 'bundled',
    id: def.id,
    url: getBundledUrl(def.url),
    label: def.label,
  };
}
