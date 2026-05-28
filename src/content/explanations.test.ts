import { describe, expect, it } from 'vitest';
import { CONTROL_DEFS, VOLUME_DEF } from '@/state/params';
import { ENGINE_ORDER, engineParamDefs } from '@/audio/engines/index';
import {
  FEATURE_IDS,
  getExplain,
  engineParamId,
  explainByGroup,
  ALL_EXPLAIN_IDS,
  type Explain,
} from '@/content/explanations';

/**
 * The forcing function. The required id set is derived from the LIVE schema
 * (control defs + per-engine param defs) plus the explicit feature list, so
 * adding a new control or engine param to the app fails this test until its
 * copy is written. A missing or blank caption/tooltip/help fails loudly.
 */

/** Every id the app must explain, derived from the schema + feature list. */
function requiredIds(): string[] {
  const ids = new Set<string>();

  // Shared sound controls (grouped grid + the separate volume control).
  for (const def of [...CONTROL_DEFS, VOLUME_DEF]) ids.add(def.key);

  // The engine switcher itself.
  ids.add('engine');

  // Every engine's per-engine params, under the composite id scheme.
  for (const engineId of ENGINE_ORDER) {
    for (const def of engineParamDefs(engineId)) {
      ids.add(engineParamId(engineId, def.key));
    }
  }

  // Features + sub-controls with no schema entry.
  for (const id of FEATURE_IDS) ids.add(id);

  return [...ids];
}

const NONEMPTY_FIELDS: (keyof Explain)[] = [
  'label',
  'caption',
  'tooltip',
  'help',
];

describe('explanations registry completeness', () => {
  const ids = requiredIds();

  it('derives a non-trivial set of required ids', () => {
    // Sanity: 8 sound controls + 1 switcher + engine params + features.
    expect(ids.length).toBeGreaterThan(30);
  });

  it.each(ids)('has copy for "%s"', (id) => {
    const entry = getExplain(id);
    expect(entry, `missing explanation for id "${id}"`).toBeDefined();
    if (!entry) return;
    for (const field of NONEMPTY_FIELDS) {
      const value = entry[field];
      expect(
        typeof value === 'string' && value.trim().length > 0,
        `explanation "${id}" has empty ${field}`,
      ).toBe(true);
    }
  });

  it('captions stay to a single line', () => {
    for (const id of ids) {
      const entry = getExplain(id);
      expect(
        entry?.caption.includes('\n'),
        `caption for "${id}" is multi-line`,
      ).toBe(false);
    }
  });

  it('uses no banned synthesis jargon in any user-facing field', () => {
    const banned = [
      'oscillator',
      'partial',
      'harmonic lattice',
      'granular',
      'ornstein',
      'uhlenbeck',
      'coupling coefficient',
      'post-fx',
      'worklet',
      'dsp',
      'karplus',
      'waveguide',
    ];
    for (const id of ALL_EXPLAIN_IDS) {
      const entry = getExplain(id);
      if (!entry) continue;
      // The label may legitimately be the product term (e.g. engine "Granular");
      // banned-word screening targets the explanatory prose users read.
      const prose =
        `${entry.caption} ${entry.tooltip} ${entry.help}`.toLowerCase();
      for (const word of banned) {
        expect(
          prose.includes(word),
          `"${id}" prose contains banned word "${word}"`,
        ).toBe(false);
      }
    }
  });

  it('groups every entry under a known group', () => {
    const groups = [
      'sound',
      'engines',
      'arcs',
      'input',
      'loop',
      'record',
      'embed',
      'gallery',
      'share',
    ] as const;
    const seen = groups.flatMap((g) => explainByGroup(g).map((e) => e.id));
    expect(new Set(seen).size).toBe(ALL_EXPLAIN_IDS.length);
  });
});
