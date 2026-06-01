/**
 * Generates `schema/manifest.v<N>.json` — a machine-readable, language-neutral
 * view of the URL share schema, derived from the existing TypeScript source of
 * truth. The Python backend validates saved patch payloads against this file;
 * the client keeps using the TS definitions directly. A CI contract test
 * regenerates this and fails on drift, so the two can never disagree.
 *
 * Run with `npm run gen:schema` (vite-node, so `@/` aliases resolve).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  SCHEMA_VERSION,
  SUPPORTED_SCHEMA_VERSIONS,
  SHARED_KEYS,
  KEY_BOUNDS,
  decimalsForStep,
} from '@/share/schema';
import { GRAIN_FIELDS } from '@/share/encode';
import {
  ENGINE_ORDER,
  ENGINE_URL_NS,
  engineParamDefs,
} from '@/audio/engines/index';
import { PRESET_ARCS, ARC_DURATION } from '@/session/arcs';
import { SESSION_MODES } from '@/session/types';
import { SLOT_IDS, GRAIN_BOUNDS, MAX_CAPTURE_SEC } from '@/loop/types';

interface NumBound {
  min: number;
  max: number;
  decimals: number;
}

interface SchemaManifest {
  schemaVersion: number;
  supportedVersions: number[];
  maxPayloadChars: number;
  sharedKeys: Record<string, NumBound>;
  engineOrder: string[];
  engines: Record<string, Record<string, NumBound>>;
  session: {
    modes: string[];
    arcIds: string[];
    duration: { min: number; max: number };
  };
  loop: {
    slotIds: string[];
    flags: string[];
    grainFields: Record<string, NumBound & { key: string }>;
    maxCaptureSec: number;
  };
  polymorphicSchemas: {
    sonificationMapping: {
      sourceTypes: string[];
      transformTypes: string[];
      targetTypes: string[];
    };
    studyExport: {
      reproducibilityLevels: string[];
    };
    lessonStep: {
      stepTypes: string[];
    };
    experimentResponse: {
      randomizationSchemes: string[];
    };
  };
}

function buildManifest(): SchemaManifest {
  const sharedKeys: Record<string, NumBound> = {};
  for (const key of SHARED_KEYS) {
    const b = KEY_BOUNDS[key];
    sharedKeys[key] = { min: b.min, max: b.max, decimals: b.decimals };
  }

  // Keyed by URL namespace (sine/fm = id, granular = `gr`), matching the wire
  // form the validator parses from `<ns>.<param>` keys.
  const engines: Record<string, Record<string, NumBound>> = {};
  for (const id of ENGINE_ORDER) {
    const params: Record<string, NumBound> = {};
    for (const def of engineParamDefs(id)) {
      params[def.key] = {
        min: def.min,
        max: def.max,
        decimals: decimalsForStep(def.step),
      };
    }
    engines[ENGINE_URL_NS[id]] = params;
  }

  const grainFields: Record<string, NumBound & { key: string }> = {};
  for (const f of GRAIN_FIELDS) {
    const b = GRAIN_BOUNDS[f.key];
    grainFields[f.code] = {
      key: f.key,
      min: b.min,
      max: b.max,
      decimals: f.decimals,
    };
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    supportedVersions: [...SUPPORTED_SCHEMA_VERSIONS],
    // Generous ceiling; a real payload is well under this. Guards against abuse.
    maxPayloadChars: 4096,
    sharedKeys,
    engineOrder: [...ENGINE_ORDER],
    engines,
    session: {
      modes: [...SESSION_MODES],
      arcIds: PRESET_ARCS.map((a: { id: string }) => a.id),
      duration: { min: ARC_DURATION.min, max: ARC_DURATION.max },
    },
    loop: {
      slotIds: [...SLOT_IDS],
      // Boolean slot flags (1 = set). Mirrors `decodeLoopPair` in encode.ts.
      // `cap` marks a slot shipping with a server-stored capture (save links).
      flags: ['m', 'f', 'c', 'cap'],
      grainFields,
      maxCaptureSec: MAX_CAPTURE_SEC,
    },
    polymorphicSchemas: {
      sonificationMapping: {
        sourceTypes: ['file', 'live', 'synthetic', 'live-biosignal'],
        transformTypes: ['linear', 'log', 'exp', 'discrete', 'quantile'],
        targetTypes: ['param', 'engineParam'],
      },
      studyExport: {
        reproducibilityLevels: [
          'bytes-identical',
          'perceptually-identical',
          'statistically-equivalent',
        ],
      },
      lessonStep: {
        stepTypes: ['text', 'demo', 'prompt', 'reflection', 'audio-clip'],
      },
      experimentResponse: {
        randomizationSchemes: [
          'simple',
          'latin-square',
          'block-random',
          'custom',
        ],
      },
    },
  };
}

const manifest = buildManifest();
const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, `manifest.v${SCHEMA_VERSION}.json`);
writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
// eslint-disable-next-line no-console
console.log(`wrote ${outPath}`);
