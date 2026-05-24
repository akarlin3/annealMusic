import { clampParam, type AnnealMusicParams } from '@/state/params';
import { KEY_BOUNDS, SHARED_KEYS, type SharedKey } from '@/share/schema';

const SHARED_KEY_SET: ReadonlySet<string> = new Set(SHARED_KEYS);

function roundTo(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

/**
 * Encode the shared params into the payload portion of a URL fragment, e.g.
 * `rootFreq=147&spread=1.08&...`. Does not include the `#s=1:` prefix and never
 * includes volume.
 */
export function encodeParams(params: AnnealMusicParams): string {
  return SHARED_KEYS.map((key) => {
    const value = params[key].toFixed(KEY_BOUNDS[key].decimals);
    return `${key}=${value}`;
  }).join('&');
}

/**
 * Decode a payload into a partial param set. Never throws: unknown keys and
 * unparseable values are dropped, out-of-range values are clamped, and every
 * such adjustment is recorded as a warning.
 */
export function decodeParams(payload: string): {
  params: Partial<AnnealMusicParams>;
  warnings: string[];
} {
  const params: Partial<AnnealMusicParams> = {};
  const warnings: string[] = [];

  for (const pair of payload.split('&')) {
    if (pair === '') continue;

    const eq = pair.indexOf('=');
    if (eq === -1) {
      warnings.push(`malformed pair (no '='): ${pair}`);
      continue;
    }

    const key = pair.slice(0, eq);
    const raw = pair.slice(eq + 1);

    if (!SHARED_KEY_SET.has(key)) {
      warnings.push(`unknown key ignored: ${key}`);
      continue;
    }
    const sharedKey = key as SharedKey;

    const num = raw.trim() === '' ? NaN : Number(raw);
    if (!Number.isFinite(num)) {
      warnings.push(`non-numeric value dropped for ${key}: ${raw}`);
      continue;
    }

    const clamped = clampParam(sharedKey, num);
    if (clamped !== num) {
      warnings.push(
        `value out of range for ${key}: ${num} clamped to ${clamped}`,
      );
    }
    params[sharedKey] = roundTo(clamped, KEY_BOUNDS[sharedKey].decimals);
  }

  return { params, warnings };
}
