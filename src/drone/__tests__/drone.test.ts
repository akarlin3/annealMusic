import { describe, expect, it } from 'vitest';
import {
  clampSharedParamsForDrone,
  enforceDroneConstraints,
} from '../ModeConstraints';
import { encodeState, decodeState } from '@/share/encode';
import { DEFAULT_PARAMS } from '@/state/params';

describe('Drone Mode Constraints', () => {
  it('clamps shared parameters for Drone mode (drift, coupling, spread, space)', () => {
    // 1. Partial clamp
    const partial = {
      drift: 0.5, // should be capped to 0.2
      coupling: 0.3, // should be raised to 0.6
      spread: 0.5, // should be forced to 1.0
      space: 0.2, // should be raised to 0.5
      rootFreq: 220, // should remain unchanged
    };

    const clamped = clampSharedParamsForDrone(partial);
    expect(clamped.drift).toBe(0.2);
    expect(clamped.coupling).toBe(0.6);
    expect(clamped.spread).toBe(1.0);
    expect(clamped.space).toBe(0.5);
    expect(clamped.rootFreq).toBe(220);

    // 2. Full clamp
    const full = {
      ...DEFAULT_PARAMS,
      drift: 0.8,
      coupling: 0.1,
      spread: 0.3,
      space: 0.0,
    };

    const enforced = enforceDroneConstraints(full);
    expect(enforced.drift).toBe(0.2);
    expect(enforced.coupling).toBe(0.6);
    expect(enforced.spread).toBe(1.0);
    expect(enforced.space).toBe(0.5);
  });
});

describe('URL Schema v18 — Drone UI Mode Roundtrip', () => {
  it('serializes and deserializes uiMode correctly in URL query string', () => {
    const encodedDrone = encodeState(
      DEFAULT_PARAMS,
      'sine',
      {},
      undefined,
      undefined,
      undefined,
      'drone',
    );
    expect(encodedDrone).toContain('app_mode=drone');

    const decodedDrone = decodeState(18, encodedDrone);
    expect(decodedDrone.kind).toBe('patch');
    if (decodedDrone.kind === 'patch') {
      expect(decodedDrone.uiMode).toBe('drone');
    }

    const encodedSketch = encodeState(
      DEFAULT_PARAMS,
      'sine',
      {},
      undefined,
      undefined,
      undefined,
      'sketch',
    );
    expect(encodedSketch).toContain('app_mode=sketch');

    const decodedSketch = decodeState(18, encodedSketch);
    expect(decodedSketch.kind).toBe('patch');
    if (decodedSketch.kind === 'patch') {
      expect(decodedSketch.uiMode).toBe('sketch');
    }
  });
});
