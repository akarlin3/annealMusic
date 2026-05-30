import {
  resolveMidiNote,
  resolveLatticeRatio,
  snapToSolfeggio,
} from './resolver';
import type { TuningRef } from './types';
import { SOLFEGGIO_FREQS } from './systems';

describe('Tuning Resolver', () => {
  describe('Equal Temperament', () => {
    it('matches the standard frequency formula exactly', () => {
      const tuning: TuningRef = { system: 'equal', referenceA4Hz: 440 };

      // Test A4 (MIDI 69) should be exactly 440 Hz
      expect(resolveMidiNote(tuning, 69)).toBeCloseTo(440, 5);

      // Test standard MIDI notes
      const notesToTest = [36, 48, 60, 72, 84, 96]; // C octaves
      notesToTest.forEach((midi) => {
        const expected = 440 * Math.pow(2, (midi - 69) / 12);
        expect(resolveMidiNote(tuning, midi)).toBeCloseTo(expected, 5);
      });

      // Test with alternative A4 = 432 Hz
      const tuning432: TuningRef = { system: 'equal', referenceA4Hz: 432 };
      expect(resolveMidiNote(tuning432, 69)).toBeCloseTo(432, 5);
      expect(resolveMidiNote(tuning432, 60)).toBeCloseTo(
        432 * Math.pow(2, -9 / 12),
        5,
      );
    });
  });

  describe('Monotonicity of Built-in Systems', () => {
    it('produces monotonically ascending frequencies for sorted MIDI notes', () => {
      const systems: TuningRef['system'][] = [
        'equal',
        'just-5',
        'just-7',
        'pythagorean',
        'werckmeister3',
        'kirnberger3',
        'meantone-quarter',
        'valotti',
        'young',
      ];

      systems.forEach((sys) => {
        const tuning: TuningRef = { system: sys, referenceA4Hz: 440 };
        let lastFreq = 0;
        // Test chromatic range from MIDI 48 (C3) to 72 (C5)
        for (let midi = 48; midi <= 72; midi++) {
          const freq = resolveMidiNote(tuning, midi);
          expect(freq).toBeGreaterThan(lastFreq);
          lastFreq = freq;
        }
      });
    });
  });

  describe('Solfeggio Snapping and Mapping', () => {
    it('snaps arbitrary frequencies correctly to the nearest of the 9 frequencies', () => {
      expect(snapToSolfeggio(170)).toBe(174);
      expect(snapToSolfeggio(180)).toBe(174);
      expect(snapToSolfeggio(280)).toBe(285);
      expect(snapToSolfeggio(500)).toBe(528);
      expect(snapToSolfeggio(950)).toBe(963);
    });

    it('snaps notation MIDI notes to Solfeggio frequencies', () => {
      const tuning: TuningRef = { system: 'solfeggio', referenceA4Hz: 440 };
      for (let midi = 20; midi <= 100; midi++) {
        const freq = resolveMidiNote(tuning, midi);
        expect(SOLFEGGIO_FREQS).toContain(freq);
      }
    });

    it('maps lattice partials to the remaining 8 Solfeggio frequencies relative to the root', () => {
      const tuning: TuningRef = { system: 'solfeggio' };

      // Test each of the 9 frequencies as active root
      SOLFEGGIO_FREQS.forEach((root) => {
        const rIdx = SOLFEGGIO_FREQS.indexOf(root);
        expect(rIdx).not.toBe(-1);
        const resolvedRatios: number[] = [];

        for (let i = 0; i < 8; i++) {
          const ratio = resolveLatticeRatio(tuning, i, root);
          const freq = root * ratio;

          // Must resolve to one of the Solfeggio frequencies
          expect(SOLFEGGIO_FREQS).toContain(Math.round(freq));
          // Must not be equal to the root itself
          expect(Math.round(freq)).not.toBe(root);

          resolvedRatios.push(ratio);
        }

        // Must all be unique (8 distinct partials)
        const uniquePitches = new Set(
          resolvedRatios.map((r) => Math.round(root * r)),
        );
        expect(uniquePitches.size).toBe(8);
      });
    });
  });

  describe('Custom Scales', () => {
    it('correctly resolves pitches using a custom 12-tone scale', () => {
      const customScale = [
        1.0, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45, 1.5, 1.55, 2.0,
      ];
      const tuning: TuningRef = { system: 'custom', referenceA4Hz: 440 };

      // C4 is midi 60. A4 is midi 69 (index 9). customScale[9] = 1.45.
      // So C4 = 440 / 1.45 = 303.448
      const expectedC4 = 440 / 1.45;
      expect(resolveMidiNote(tuning, 60, customScale, 2.0)).toBeCloseTo(
        expectedC4,
        5,
      );

      // MIDI 72 (C5) should be exactly 2 * C4
      expect(resolveMidiNote(tuning, 72, customScale, 2.0)).toBeCloseTo(
        2 * expectedC4,
        5,
      );

      // Lattice partials should map to scale-derived intervals when K=12
      const ratio1 = resolveLatticeRatio(tuning, 1, 100, customScale, 2.0); // Step 7 (perfect fifth semitone equivalent)
      expect(ratio1).toBe(1.35); // customScale[7]
    });

    it('correctly resolves pitches using a non-12-tone (e.g. 5-tone pentatonic) microtonal scale', () => {
      const customScale = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0]; // K=5, eqRatio = 2.0
      const tuning: TuningRef = { system: 'custom', referenceA4Hz: 440 };

      // MIDI 69 is semitone step (69-60) % 5 = 4. customScale[4] = 1.8.
      // Octave is floor(9/5) = 1.
      // So A4 ratio relative to C4 is 1.8 * 2.0 = 3.6.
      // C4 = 440 / 3.6 = 122.222 Hz.
      const expectedC4 = 440 / 3.6;
      expect(resolveMidiNote(tuning, 60, customScale, 2.0)).toBeCloseTo(
        expectedC4,
        5,
      );

      // Test lattice dynamic step matching
      // H=2.0 should fit step 5 (octave: degree 0, octave 1 -> ratio 2.0)
      const ratio2 = resolveLatticeRatio(tuning, 2, 100, customScale, 2.0);
      expect(ratio2).toBe(2.0);
    });
  });
});
