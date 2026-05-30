/* eslint-disable */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(
  __dirname,
  '../../../schema/manifest.v20.json',
);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePayloadString(payload: string): ValidationResult {
  const errors: string[] = [];

  if (!fs.existsSync(manifestPath)) {
    return {
      valid: false,
      errors: [`Manifest schema file not found at: ${manifestPath}`],
    };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  if (payload.length > manifest.maxPayloadChars) {
    errors.push(
      `Payload too long (${payload.length} > ${manifest.maxPayloadChars})`,
    );
    return { valid: false, errors };
  }

  const shared = manifest.sharedKeys;
  const engines = manifest.engines;
  const engineOrder = manifest.engineOrder;
  const session = manifest.session;
  const loop = manifest.loop;

  const seenKeys = new Set<string>();

  const checkNumInBounds = (
    raw: string,
    bound: { min: number; max: number },
    label: string,
  ) => {
    const value = parseFloat(raw);
    if (isNaN(value)) {
      errors.push(`${label}: non-numeric value '${raw}'`);
      return;
    }
    if (!isFinite(value)) {
      errors.push(`${label}: non-finite value '${raw}'`);
      return;
    }
    if (value < bound.min || value > bound.max) {
      errors.push(
        `${label}: ${value} out of range [${bound.min}, ${bound.max}]`,
      );
    }
  };

  for (const pair of payload.split('&')) {
    if (pair === '') continue;
    if (!pair.includes('=')) {
      errors.push(`malformed pair (no '='): ${pair}`);
      continue;
    }

    const eqIndex = pair.indexOf('=');
    const key = pair.slice(0, eqIndex);
    const raw = pair.slice(eqIndex + 1);

    if (seenKeys.has(key)) {
      errors.push(`duplicate key: ${key}`);
      continue;
    }
    seenKeys.add(key);

    // Session mode
    if (key === 'm') {
      if (!session.modes.includes(raw)) {
        errors.push(`unknown mode '${raw}'`);
      }
      continue;
    }
    if (key === 'arc') {
      if (!session.arcIds.includes(raw)) {
        errors.push(`unknown arc '${raw}'`);
      }
      continue;
    }
    if (key === 'dur') {
      checkNumInBounds(raw, session.duration, 'dur');
      continue;
    }

    // Engine selector
    if (key === 'e') {
      if (!engineOrder.includes(raw)) {
        errors.push(`unknown engine '${raw}'`);
      }
      continue;
    }

    // Loop slot config: L<id>.<field>
    const loopMatch = key.match(/^L([A-Za-z])\.(.+)$/);
    if (loopMatch) {
      const slotId = loopMatch[1];
      const field = loopMatch[2];
      if (!slotId || !field || !loop.slotIds.includes(slotId)) {
        errors.push(`unknown loop slot: ${key}`);
      } else if (loop.flags.includes(field)) {
        if (raw !== '0' && raw !== '1') {
          errors.push(`${key}: flag must be 0 or 1, got '${raw}'`);
        }
      } else if (field in loop.grainFields) {
        checkNumInBounds(raw, loop.grainFields[field], key);
      } else {
        errors.push(`unknown loop field: ${key}`);
      }
      continue;
    }

    // Namespaced engine param: <engine>.<param>
    const nsMatch = key.match(/^([A-Za-z0-9]+)\.(.+)$/);
    if (nsMatch) {
      const ns = nsMatch[1];
      const param = nsMatch[2];
      if (!ns || !param || !(ns in engines)) {
        errors.push(`unknown engine namespace: ${key}`);
      } else if (!(param in engines[ns])) {
        errors.push(`unknown engine param: ${key}`);
      } else {
        checkNumInBounds(raw, engines[ns][param], key);
      }
      continue;
    }

    // Shared param
    if (!(key in shared)) {
      errors.push(`unknown key: ${key}`);
      continue;
    }
    checkNumInBounds(raw, shared[key], key);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateFile(filePath: string): ValidationResult {
  if (!fs.existsSync(filePath)) {
    return { valid: false, errors: [`File not found: ${filePath}`] };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();

    // Handle JSON vs raw payload string
    if (content.startsWith('{')) {
      const json = JSON.parse(content);
      if (json.payload) {
        return validatePayloadString(json.payload);
      } else if (json.base && json.base.payload) {
        // Sweep / Batch file
        return validatePayloadString(json.base.payload);
      } else {
        return {
          valid: false,
          errors: ['JSON missing "payload" field for validation.'],
        };
      }
    } else {
      return validatePayloadString(content);
    }
  } catch (err: any) {
    return { valid: false, errors: [`Failed to parse file: ${err.message}`] };
  }
}
