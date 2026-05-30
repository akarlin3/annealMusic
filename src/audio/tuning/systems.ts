import type { TuningSystem, TuningSystemId } from './types';

export const SOLFEGGIO_FREQS = [174, 285, 396, 417, 528, 639, 741, 852, 963];

// Helper to convert cents to pitch ratio
export function centsToRatio(cents: number): number {
  return Math.pow(2, cents / 1200);
}

// Semitone steps matching standard harmonics [1, 1.5, 2, 2.5, 3, 4, 5, 6]
// index 0: H1.0 -> 0 semitones
// index 1: H1.5 -> 7 semitones (fifth)
// index 2: H2.0 -> 12 semitones (octave)
// index 3: H2.5 -> 16 semitones (octave + major third)
// index 4: H3.0 -> 19 semitones (octave + fifth)
// index 5: H4.0 -> 24 semitones (two octaves)
// index 6: H5.0 -> 28 semitones (two octaves + major third)
// index 7: H6.0 -> 31 semitones (two octaves + fifth)
export const LATTICE_STEPS = [0, 7, 12, 16, 19, 24, 28, 31];

// Resolves a semitone step (greater than 12) for any 12-tone scale
export function getScaleDerivedRatio(step: number, scale: number[]): number {
  const octave = Math.floor(step / 12);
  const degree = ((step % 12) + 12) % 12;
  const ratio = scale[degree] ?? 1.0;
  return ratio * Math.pow(2, octave);
}

// 1. Equal Temperament
const EQUAL_RATIOS = Array.from({ length: 12 }, (_, i) => Math.pow(2, i / 12));

// 2. Just Intonation 5-limit
const JUST_5_RATIOS = [
  1 / 1, // Unison
  16 / 15, // Minor second
  9 / 8, // Major second
  6 / 5, // Minor third
  5 / 4, // Major third
  4 / 3, // Perfect fourth
  45 / 32, // Tritone
  3 / 2, // Perfect fifth
  8 / 5, // Minor sixth
  5 / 3, // Major sixth
  16 / 9, // Minor seventh
  15 / 8, // Major seventh
];

// 3. Just Intonation 7-limit
const JUST_7_RATIOS = [
  1 / 1, // Unison
  15 / 14, // Septimal minor second
  8 / 7, // Septimal major second
  7 / 6, // Septimal minor third
  5 / 4, // Just major third
  4 / 3, // Perfect fourth
  7 / 5, // Septimal tritone
  3 / 2, // Perfect fifth
  8 / 5, // Just minor sixth
  12 / 7, // Septimal major sixth
  7 / 4, // Septimal minor seventh
  15 / 8, // Just major seventh
];

// 4. Pythagorean
const PYTHAGOREAN_RATIOS = [
  1 / 1,
  256 / 243,
  9 / 8,
  32 / 27,
  81 / 64,
  4 / 3,
  729 / 512,
  3 / 2,
  128 / 81,
  27 / 16,
  16 / 9,
  243 / 128,
];

// 5. Werckmeister III cents values
const WERCKMEISTER_CENTS = [
  0.0, 90.225, 192.18, 294.135, 390.225, 498.045, 588.27, 696.09, 792.18,
  888.27, 996.09, 1092.18,
];
const WERCKMEISTER_RATIOS = WERCKMEISTER_CENTS.map(centsToRatio);

// 6. Kirnberger III cents values
const KIRNBERGER_CENTS = [
  0.0, 90.22, 196.09, 294.13, 386.31, 498.05, 590.22, 696.58, 792.18, 889.74,
  994.13, 1086.31,
];
const KIRNBERGER_RATIOS = KIRNBERGER_CENTS.map(centsToRatio);

// 7. Meantone (quarter-comma) cents values
const MEANTONE_CENTS = [
  0.0, 75.64, 193.16, 310.26, 386.31, 503.42, 579.47, 696.58, 772.63, 889.74,
  1006.84, 1082.89,
];
const MEANTONE_RATIOS = MEANTONE_CENTS.map(centsToRatio);

// 8. Valotti cents values
const VALOTTI_CENTS = [
  0.0, 90.0, 196.0, 294.0, 391.0, 498.0, 590.0, 698.0, 792.0, 895.0, 996.0,
  1092.0,
];
const VALOTTI_RATIOS = VALOTTI_CENTS.map(centsToRatio);

// 9. Young cents values
const YOUNG_CENTS = [
  0.0, 96.1, 202.0, 296.1, 402.0, 500.0, 598.0, 703.9, 800.0, 905.9, 1002.0,
  1103.9,
];
const YOUNG_RATIOS = YOUNG_CENTS.map(centsToRatio);

// Pure harmonics [1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0]
const PURE_HARMONICS = [1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0];

export const BUILTIN_TUNINGS: Record<
  Exclude<TuningSystemId, 'custom'>,
  TuningSystem
> = {
  equal: {
    id: 'equal',
    name: 'Equal Temperament',
    description:
      'The modern standard division of the octave into 12 equal steps. Clean, symmetrical, and completely uniform across all keys.',
    hasOctaveEquivalence: true,
    scaleRatios: EQUAL_RATIOS,
    getLatticeRatio: (i) => PURE_HARMONICS[i] ?? 1.0,
  },
  'just-5': {
    id: 'just-5',
    name: 'Just Intonation (5-limit)',
    description:
      'Tuning based on pure, simple prime-number ratios (up to 5). Produces exceptionally sweet, consonant major thirds (5:4) and perfect fifths (3:2) but cannot modulate easily.',
    hasOctaveEquivalence: true,
    scaleRatios: JUST_5_RATIOS,
    getLatticeRatio: (i) => PURE_HARMONICS[i] ?? 1.0,
  },
  'just-7': {
    id: 'just-7',
    name: 'Just Intonation (7-limit)',
    description:
      'Incorporates the 7th harmonic, introducing highly resonant septimal intervals like the septimal minor third (7:6) and the natural minor seventh (7:4). Highly colorful and organic.',
    hasOctaveEquivalence: true,
    scaleRatios: JUST_7_RATIOS,
    getLatticeRatio: (i) => PURE_HARMONICS[i] ?? 1.0,
  },
  pythagorean: {
    id: 'pythagorean',
    name: 'Pythagorean',
    description:
      'The oldest known tuning system, constructed entirely from chains of pure perfect fifths (3:2). Perfect fifths are brilliant and pure, but major thirds are quite wide and tense.',
    hasOctaveEquivalence: true,
    scaleRatios: PYTHAGOREAN_RATIOS,
    getLatticeRatio: (i) => {
      const step = LATTICE_STEPS[i] ?? 0;
      return getScaleDerivedRatio(step, PYTHAGOREAN_RATIOS);
    },
  },
  solfeggio: {
    id: 'solfeggio',
    name: 'Solfeggio Frequencies',
    description:
      'A sparse set of nine historical frequencies. Non-octave-equivalent, producing an alien, rich, and highly characteristic acoustic texture.',
    hasOctaveEquivalence: false,
    scaleRatios: SOLFEGGIO_FREQS, // Absolute frequencies
    getLatticeRatio: () => {
      throw new Error(
        'Solfeggio uses a special sparse-set lattice mapping implemented directly in resolver.ts',
      );
    },
  },
  werckmeister3: {
    id: 'werckmeister3',
    name: 'Werckmeister III',
    description:
      'A classic Baroque well-temperament. Distributes the Pythagorean comma across four fifths, making all 12 keys usable while giving each key a distinct emotional color or "flavor".',
    hasOctaveEquivalence: true,
    scaleRatios: WERCKMEISTER_RATIOS,
    getLatticeRatio: (i) => {
      const step = LATTICE_STEPS[i] ?? 0;
      return getScaleDerivedRatio(step, WERCKMEISTER_RATIOS);
    },
  },
  kirnberger3: {
    id: 'kirnberger3',
    name: 'Kirnberger III',
    description:
      'A well-temperament often associated with the Bach circle. Keeps C-E completely pure (just) and concentrates tempering on the D-A fifth, providing a highly resonant home key.',
    hasOctaveEquivalence: true,
    scaleRatios: KIRNBERGER_RATIOS,
    getLatticeRatio: (i) => {
      const step = LATTICE_STEPS[i] ?? 0;
      return getScaleDerivedRatio(step, KIRNBERGER_RATIOS);
    },
  },
  'meantone-quarter': {
    id: 'meantone-quarter',
    name: 'Quarter-Comma Meantone',
    description:
      'The dominant keyboard tuning of the Renaissance. Narrows perfect fifths by 1/4 syntonic comma to achieve perfectly pure major thirds, but leaves a highly dissonant "wolf" fifth.',
    hasOctaveEquivalence: true,
    scaleRatios: MEANTONE_RATIOS,
    getLatticeRatio: (i) => {
      const step = LATTICE_STEPS[i] ?? 0;
      return getScaleDerivedRatio(step, MEANTONE_RATIOS);
    },
  },
  valotti: {
    id: 'valotti',
    name: 'Vallotti',
    description:
      'A moderate Baroque temperament where six fifths are tempered by 1/6 Pythagorean comma and the other six are kept pure. Extremely smooth, balanced, and widely used today.',
    hasOctaveEquivalence: true,
    scaleRatios: VALOTTI_RATIOS,
    getLatticeRatio: (i) => {
      const step = LATTICE_STEPS[i] ?? 0;
      return getScaleDerivedRatio(step, VALOTTI_RATIOS);
    },
  },
  young: {
    id: 'young',
    name: 'Young',
    description:
      "Thomas Young's circulating well-temperament. Similar in concept to Vallotti but transposed to center the sweetest consonant keys on C Major. Very warm and rich.",
    hasOctaveEquivalence: true,
    scaleRatios: YOUNG_RATIOS,
    getLatticeRatio: (i) => {
      const step = LATTICE_STEPS[i] ?? 0;
      return getScaleDerivedRatio(step, YOUNG_RATIOS);
    },
  },
};
