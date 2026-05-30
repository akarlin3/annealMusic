import type { TuningRef } from './types';
import {
  BUILTIN_TUNINGS,
  SOLFEGGIO_FREQS,
  LATTICE_STEPS,
  getScaleDerivedRatio,
} from './systems';

/**
 * Snaps a frequency to the nearest of the 9 Solfeggio frequencies.
 */
export function snapToSolfeggio(freq: number): number {
  return SOLFEGGIO_FREQS.reduce((prev, curr) =>
    Math.abs(curr - freq) < Math.abs(prev - freq) ? curr : prev,
  );
}

/**
 * Finds the closest scale degree step in a custom scale for a given harmonic ratio.
 */
export function findClosestScaleStep(
  harmonicRatio: number,
  scaleRatios: number[],
  eqRatio: number,
): number {
  const targetCents = 1200 * Math.log2(harmonicRatio);
  const K = scaleRatios.length - 1; // K is the number of intervals in the scale
  if (K <= 0) return 0;

  let bestStep = 0;
  let minDiff = Infinity;
  for (let step = 0; step < 120; step++) {
    const octave = Math.floor(step / K);
    const degree = step % K;
    const ratio = scaleRatios[degree]! * Math.pow(eqRatio, octave);
    const cents = 1200 * Math.log2(ratio);
    const diff = Math.abs(cents - targetCents);
    if (diff < minDiff) {
      minDiff = diff;
      bestStep = step;
    }
  }
  return bestStep;
}

/**
 * Resolves any MIDI note pitch into its absolute frequency in Hz based on the active tuning.
 */
export function resolveMidiNote(
  tuning: TuningRef,
  midiNote: number,
  customScaleRatios?: number[],
  customEqRatio?: number,
): number {
  const refA4 = tuning.referenceA4Hz ?? 440;

  // Solfeggio special sparse-set snapping
  if (tuning.system === 'solfeggio') {
    const etFreq = refA4 * Math.pow(2, (midiNote - 69) / 12);
    return snapToSolfeggio(etFreq);
  }

  // Custom SCL Tuning
  if (
    tuning.system === 'custom' &&
    customScaleRatios &&
    customEqRatio !== undefined
  ) {
    const K = customScaleRatios.length - 1;
    if (K <= 0) return refA4;

    // A4 (MIDI 69) is the reference note relative to C4 (MIDI 60)
    const aSemitone = (69 - 60) % K;
    const aOctave = Math.floor((69 - 60) / K);
    const aRatio =
      customScaleRatios[aSemitone]! * Math.pow(customEqRatio, aOctave);
    const c4Freq = refA4 / aRatio;

    const semitone = (midiNote - 60) % K;
    const octave = Math.floor((midiNote - 60) / K);
    const ratio =
      customScaleRatios[semitone]! * Math.pow(customEqRatio, octave);
    return c4Freq * ratio;
  }

  // Built-in Tuning System
  const system = BUILTIN_TUNINGS[tuning.system] || BUILTIN_TUNINGS.equal;
  const scale = system.scaleRatios;

  // A4 (MIDI 69) is semitone step 9 relative to C4 (MIDI 60)
  const aRatio = scale[9]!;
  const c4Freq = refA4 / aRatio;

  const semitone = (((midiNote - 60) % 12) + 12) % 12;
  const octave = Math.floor((midiNote - 60) / 12);
  const ratio = scale[semitone]! * Math.pow(2, octave);
  return c4Freq * ratio;
}

/**
 * Resolves a partial's lattice pitch ratio (relative to snapped root) for synthesis.
 */
export function resolveLatticeRatio(
  tuning: TuningRef,
  partialIndex: number,
  rootFreq: number,
  customScaleRatios?: number[],
  customEqRatio?: number,
): number {
  // Solfeggio special sparse-set partial mapping
  if (tuning.system === 'solfeggio') {
    const snappedRoot = snapToSolfeggio(rootFreq);
    const rIdx = SOLFEGGIO_FREQS.indexOf(snappedRoot);
    if (rIdx === -1) return 1.0;
    const targetFreq = SOLFEGGIO_FREQS[(rIdx + 1 + partialIndex) % 9]!;
    return targetFreq / snappedRoot;
  }

  // Custom scale
  if (
    tuning.system === 'custom' &&
    customScaleRatios &&
    customEqRatio !== undefined
  ) {
    const K = customScaleRatios.length - 1;
    if (K <= 0) return 1.0;

    // For a 12-tone custom scale, use scale-derived harmonics
    if (K === 12) {
      const step = LATTICE_STEPS[partialIndex] ?? 0;
      return getScaleDerivedRatio(step, customScaleRatios);
    }

    // For microtonal scales, find the closest matching scale degree step
    const harmonicRatio =
      [1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0][partialIndex] ?? 1.0;
    const step = findClosestScaleStep(
      harmonicRatio,
      customScaleRatios,
      customEqRatio,
    );
    const octave = Math.floor(step / K);
    const degree = step % K;
    return customScaleRatios[degree]! * Math.pow(customEqRatio, octave);
  }

  // Built-in systems
  const system = BUILTIN_TUNINGS[tuning.system] || BUILTIN_TUNINGS.equal;
  return system.getLatticeRatio(partialIndex);
}
