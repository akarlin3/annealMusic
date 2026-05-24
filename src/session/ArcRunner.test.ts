import { describe, expect, it } from 'vitest';
import { ArcRunner } from '@/session/ArcRunner';
import { getArcById } from '@/session/arcs';
import { DEFAULT_PARAMS } from '@/state/params';
import type { Arc } from '@/session/types';
import type { AnnealEngineCapabilities } from '@/audio/engines/types';

const LOCKED: AnnealEngineCapabilities = {
  densityLockedWhilePlaying: true,
  params: [],
};
const UNLOCKED: AnnealEngineCapabilities = {
  densityLockedWhilePlaying: false,
  params: [],
};

const bell = getArcById('bell') as Arc;
const dawn = getArcById('dawn') as Arc;

describe('ArcRunner — bell curve interpolation', () => {
  // duration 300s → settle [0,99), dwell [99,201), return [201,300].
  const runner = new ArcRunner(bell, 300, DEFAULT_PARAMS, LOCKED);

  // rootFreq: start 110, settle/dwell target 0.7×110 = 77, return → 110.
  // table: [elapsed, expected rootFreq, expected segmentIndex]
  const table: Array<[number, number, number]> = [
    [0, 110, 0], // settle start
    [49.5, 93.5, 0], // settle midpoint: easeInOut(0.5)=0.5 → lerp(110,77,0.5)
    [99, 77, 1], // dwell start = settle end
    [150, 77, 1], // dwell holds rootFreq at 77
    [201, 77, 2], // return start
    [250.5, 93.5, 2], // return midpoint → halfway back to 110
  ];

  it.each(table)(
    'at t=%d s, rootFreq≈%d (segment %d)',
    (elapsed, expectedRoot, expectedSeg) => {
      const frame = runner.tick(elapsed);
      expect(frame.params.rootFreq).toBeCloseTo(expectedRoot, 4);
      expect(frame.segmentIndex).toBe(expectedSeg);
      expect(frame.done).toBe(false);
    },
  );

  it('tracks coupling/drift/space through the settle segment', () => {
    const frame = runner.tick(49.5); // eased 0.5
    expect(frame.params.coupling).toBeCloseTo(0.345, 4); // lerp(0.3, 0.39)
    expect(frame.params.drift).toBeCloseTo(0.4, 4); // lerp(0.5, 0.3)
    expect(frame.params.space).toBeCloseTo(0.48, 4); // lerp(0.4, 0.56)
  });

  it('reports progress as elapsed / duration', () => {
    expect(runner.tick(0).progress).toBeCloseTo(0, 5);
    expect(runner.tick(150).progress).toBeCloseTo(0.5, 5);
  });
});

describe('ArcRunner — restoreStart', () => {
  it('returns every active key to its captured start at arc end', () => {
    const runner = new ArcRunner(bell, 300, DEFAULT_PARAMS, LOCKED);
    const frame = runner.tick(300);
    expect(frame.done).toBe(true);
    expect(frame.progress).toBe(1);
    expect(frame.params.rootFreq).toBeCloseTo(DEFAULT_PARAMS.rootFreq, 6);
    expect(frame.params.coupling).toBeCloseTo(DEFAULT_PARAMS.coupling, 6);
    expect(frame.params.drift).toBeCloseTo(DEFAULT_PARAMS.drift, 6);
    expect(frame.params.space).toBeCloseTo(DEFAULT_PARAMS.space, 6);
  });

  it('eases back toward start near the end of the return segment', () => {
    const runner = new ArcRunner(bell, 300, DEFAULT_PARAMS, LOCKED);
    const near = runner.tick(299).params.rootFreq!;
    // Closer to start (110) than to the deep floor (77).
    expect(Math.abs(near - 110)).toBeLessThan(Math.abs(near - 77));
  });
});

describe('ArcRunner — density target gating', () => {
  it('drops density for engines that lock it, with a warning', () => {
    const runner = new ArcRunner(dawn, 100, DEFAULT_PARAMS, LOCKED);
    expect(runner.warnings).toHaveLength(1);
    expect(runner.warnings[0]).toMatch(/density/);

    const frame = runner.tick(100);
    expect(frame.params.density).toBeUndefined();
    expect(frame.params.brightness).toBeDefined();
    expect(frame.params.spread).toBeDefined();
  });

  it('applies density (as an integer) for engines that allow it', () => {
    const runner = new ArcRunner(dawn, 100, DEFAULT_PARAMS, UNLOCKED);
    expect(runner.warnings).toHaveLength(0);

    const frame = runner.tick(100); // done → end anchor (density 'max' = 8)
    expect(frame.params.density).toBe(8);
    expect(Number.isInteger(frame.params.density)).toBe(true);
  });
});

describe('ArcRunner — validation & clock fidelity', () => {
  it('throws when segment fractions do not sum to 1', () => {
    const bad: Arc = {
      id: 'bad',
      name: 'Bad',
      description: '',
      segments: [{ fraction: 0.5, curve: 'linear', targets: { drift: 1 } }],
    };
    expect(() => new ArcRunner(bad, 100, DEFAULT_PARAMS, LOCKED)).toThrow();
  });

  it('lands precisely on the elapsed clock, independent of tick cadence', () => {
    const runner = new ArcRunner(bell, 3600, DEFAULT_PARAMS, LOCKED); // 60 min
    expect(runner.tick(1800).progress).toBeCloseTo(0.5, 6);
    expect(runner.tick(3599.9).done).toBe(false);
    expect(runner.tick(3600).done).toBe(true);
    expect(runner.tick(3600.0001).done).toBe(true); // idempotent past the end
  });
});
