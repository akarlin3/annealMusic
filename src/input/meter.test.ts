import { describe, expect, it } from 'vitest';
import { FeedbackDetector, readRms } from '@/input/meter';

function analyserWith(amplitude: number): AnalyserNode {
  return {
    fftSize: 256,
    getByteTimeDomainData: (buf: Uint8Array) => {
      const delta = Math.round(amplitude * 128);
      for (let i = 0; i < buf.length; i++) {
        buf[i] = 128 + (i % 2 === 0 ? delta : -delta);
      }
    },
  } as unknown as AnalyserNode;
}

describe('readRms', () => {
  it('is ~0 for a silent (centered) signal', () => {
    expect(readRms(analyserWith(0))).toBeCloseTo(0, 5);
  });

  it('grows with amplitude and stays within [0, 1]', () => {
    const quiet = readRms(analyserWith(0.2));
    const loud = readRms(analyserWith(0.8));
    expect(loud).toBeGreaterThan(quiet);
    expect(loud).toBeLessThanOrEqual(1);
  });
});

describe('FeedbackDetector', () => {
  it('trips only after sustained over-threshold samples', () => {
    const d = new FeedbackDetector(0.9, 5);
    let tripped = false;
    for (let i = 0; i < 4; i++) tripped = d.push(0.95) || tripped;
    expect(tripped).toBe(false); // 4 < 5
    expect(d.push(0.95)).toBe(true); // 5th in a row trips
  });

  it('resets the streak when the signal drops below threshold', () => {
    const d = new FeedbackDetector(0.9, 3);
    d.push(0.95);
    d.push(0.95);
    expect(d.push(0.1)).toBe(false); // streak broken
    expect(d.push(0.95)).toBe(false); // counting restarts
    expect(d.push(0.95)).toBe(false);
    expect(d.push(0.95)).toBe(true);
  });

  it('never trips for a single loud transient', () => {
    const d = new FeedbackDetector(0.9, 10);
    expect(d.push(0.99)).toBe(false);
    expect(d.push(0.1)).toBe(false);
  });
});
