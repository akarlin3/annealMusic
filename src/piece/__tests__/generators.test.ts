import { describe, expect, it } from 'vitest';
import {
  createSeededRng,
  generateRandomWalk,
  generateWaypointTour,
  generateBellCurveVariation,
  generateSpectralEvolution,
  generateMetaArc,
} from '@/piece/generators';
import type { ArcSegment } from '@/session/types';

describe('Seeded RNG', () => {
  it('is completely deterministic for identical seeds', () => {
    const rng1 = createSeededRng('music-seed');
    const rng2 = createSeededRng('music-seed');
    for (let i = 0; i < 50; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('differs for different seeds', () => {
    const rng1 = createSeededRng('seed-a');
    const rng2 = createSeededRng('seed-b');
    let matches = 0;
    for (let i = 0; i < 20; i++) {
      if (rng1() === rng2()) matches++;
    }
    expect(matches).toBeLessThan(5);
  });
});

describe('Meta-Arc Generators', () => {
  const sumFractions = (segments: ArcSegment[]) =>
    segments.reduce((acc, s) => acc + s.fraction, 0);

  describe('random-walk', () => {
    it('generates correct number of segments and sums to 1.0', () => {
      const arc = generateRandomWalk({ steps: 20 }, 'test-walk');
      expect(arc.segments.length).toBe(20);
      expect(sumFractions(arc.segments)).toBeCloseTo(1.0, 5);

      // Every segment is linear and has targets
      for (const seg of arc.segments) {
        expect(seg.curve).toBe('linear');
        expect(seg.targets).not.toBe('restoreStart');
      }
    });

    it('clamps values inside the designated parameter bounds', () => {
      const customConfig = {
        params: ['brightness' as const],
        bounds: {
          brightness: { min: 0.8, max: 1.2 },
        },
        driftStrength: 1.5, // strong noise to hit bounds
        steps: 10,
      };
      const arc = generateRandomWalk(customConfig, 'limit-seed');
      for (const seg of arc.segments) {
        if (seg.targets !== 'restoreStart') {
          const targets = seg.targets as Record<string, number>;
          const val = targets.brightness;
          expect(val).toBeGreaterThanOrEqual(0.8);
          expect(val).toBeLessThanOrEqual(1.2);
        }
      }
    });
  });

  describe('waypoint-tour', () => {
    it('produces waypoint segments with chosen curves', () => {
      const arc = generateWaypointTour(
        { waypointsCount: 6, easing: 'exponential' },
        'tour-seed',
      );
      expect(arc.segments.length).toBe(5);
      expect(sumFractions(arc.segments)).toBeCloseTo(1.0, 5);
      for (const seg of arc.segments) {
        expect(seg.curve).toBe('exponential');
      }
    });

    it('limits waypoint steps to maximum delta distances', () => {
      const customConfig = {
        params: ['space' as const],
        waypointsCount: 5,
        maxDistance: 0.1, // tiny max travel distance
        bounds: { space: { min: 0.0, max: 2.0 } }, // range is 2.0, max delta is 0.2
      };
      const arc = generateWaypointTour(customConfig, 'waypoints');
      let prevVal = 1.0;
      for (const seg of arc.segments) {
        if (seg.targets !== 'restoreStart') {
          const targets = seg.targets as Record<string, number>;
          const currentVal = targets.space ?? 1.0;
          expect(Math.abs(currentVal - prevVal)).toBeLessThanOrEqual(0.2001);
          prevVal = currentVal;
        }
      }
    });
  });

  describe('bell-curve-variation', () => {
    it('produces exactly 3 segments with restoreStart ending', () => {
      const arc = generateBellCurveVariation({}, 'bell-seed');
      expect(arc.segments.length).toBe(3);
      expect(sumFractions(arc.segments)).toBeCloseTo(1.0, 5);

      expect(arc.segments[0]!.curve).toBe('easeInOut');
      expect(arc.segments[1]!.curve).toBe('linear');
      expect(arc.segments[2]!.curve).toBe('easeInOut');
      expect(arc.segments[2]!.targets).toBe('restoreStart');
    });

    it('adheres to bounds bounds constraints on params', () => {
      const config = {
        params: ['rootFreq' as const],
        paramBounds: { rootFreq: { min: 0.7, max: 0.9 } },
      };
      const arc = generateBellCurveVariation(config, 'bell-b');
      const t0 = arc.segments[0]!.targets as Record<string, number>;
      const t1 = arc.segments[1]!.targets as Record<string, number>;
      expect(t0.rootFreq).toBeGreaterThanOrEqual(0.7);
      expect(t0.rootFreq).toBeLessThanOrEqual(0.9);
      expect(t1.rootFreq).toBeGreaterThanOrEqual(0.7);
      expect(t1.rootFreq).toBeLessThanOrEqual(0.9);
    });
  });

  describe('spectral-evolution', () => {
    it('coordinates inverse-crossover trajectory correctly', () => {
      const arc = generateSpectralEvolution(
        { coordinationType: 'inverse-crossover' },
        'spec-seed',
      );
      expect(arc.segments.length).toBe(3);
      expect(sumFractions(arc.segments)).toBeCloseTo(1.0, 5);

      const w1 = arc.segments[0]!.targets as Record<string, number>;
      const w2 = arc.segments[1]!.targets as Record<string, number>;

      // In inverse-crossover: w1 density is high, w2 is low. w1 brightness is low, w2 is high.
      expect(w1.density!).toBeGreaterThan(w2.density!);
      expect(w1.brightness!).toBeLessThan(w2.brightness!);
    });

    it('coordinates parallel-sweep trajectory correctly', () => {
      const arc = generateSpectralEvolution(
        { coordinationType: 'parallel-sweep' },
        'sweep-seed',
      );
      const w1 = arc.segments[0]!.targets as Record<string, number>;
      const w2 = arc.segments[1]!.targets as Record<string, number>;

      // In parallel-sweep: density and brightness both sweep high in w1, low in w2.
      expect(w1.density!).toBeGreaterThan(w2.density!);
      expect(w1.brightness!).toBeGreaterThan(w2.brightness!);
    });
  });

  describe('Top-level Dispatcher', () => {
    it('properly routes and is deterministic', () => {
      const config = {
        randomWalk: { steps: 10 },
      };
      const arc1 = generateMetaArc('random-walk', config, 'dispatch-seed');
      const arc2 = generateMetaArc('random-walk', config, 'dispatch-seed');

      expect(arc1.segments.length).toBe(10);
      expect(arc1).toEqual(arc2);
    });
  });
});
