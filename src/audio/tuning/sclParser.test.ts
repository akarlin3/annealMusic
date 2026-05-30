import { describe, it, expect } from 'vitest';
import { parseScl } from './sclParser';

describe('Scala SCL Parser', () => {
  it('correctly parses a valid 12-tone cents scale with comments', () => {
    const sclContent = `! 12-tone-cents-test.scl
!
A test 12-tone scale in cents
 12
!
 100.0   ! C#
 200.00  ! D
 300.0   ! D#
 400.0   ! E
 500.0   ! F
 600.0   ! F#
 700.0   ! G
 800.0   ! G#
 900.0   ! A
 1000.0  ! A#
 1100.0  ! B
 1200.0  ! C
`;
    const parsed = parseScl(sclContent);
    expect(parsed.description).toBe('A test 12-tone scale in cents');
    expect(parsed.size).toBe(12);
    expect(parsed.scaleRatios.length).toBe(13); // unison (1.0) + 12 intervals
    expect(parsed.scaleRatios[0]).toBe(1.0);
    expect(parsed.scaleRatios[1]).toBeCloseTo(Math.pow(2, 100 / 1200), 5);
    expect(parsed.scaleRatios[6]).toBeCloseTo(Math.pow(2, 600 / 1200), 5);
    expect(parsed.scaleRatios[12]).toBeCloseTo(2.0, 5);
  });

  it('correctly parses a fraction and integer ratios scale', () => {
    const sclContent = `! standard-just.scl
Standard Just 5-limit scale
 7
 9/8
 5/4
 4/3
 3/2
 5/3
 15/8
 2 ! Octave
`;
    const parsed = parseScl(sclContent);
    expect(parsed.description).toBe('Standard Just 5-limit scale');
    expect(parsed.size).toBe(7);
    expect(parsed.scaleRatios).toEqual([
      1.0, // unison
      9 / 8, // 9/8
      5 / 4, // 5/4
      4 / 3, // 4/3
      3 / 2, // 3/2
      5 / 3, // 5/3
      15 / 8, // 15/8
      2, // 2
    ]);
  });

  it('handles spaces and inline comments cleanly', () => {
    const sclContent = `! comment
Description with spaces  
   5   
  9/8   ! fifth-like but 9/8
  1.25000 ! 5/4 equivalent
  3/2 ! fifth
  1.75000
  2 / 1
`;
    const parsed = parseScl(sclContent);
    expect(parsed.description).toBe('Description with spaces');
    expect(parsed.size).toBe(5);
    expect(parsed.scaleRatios[1]).toBe(9 / 8);
    expect(parsed.scaleRatios[2]).toBeCloseTo(Math.pow(2, 1.25 / 1200), 5); // wait! In parser, cents is a float with '.': Math.pow(2, cents/1200). Yes!
    expect(parsed.scaleRatios[3]).toBe(1.5);
    expect(parsed.scaleRatios[5]).toBe(2.0); // "2 / 1" with spaces around slash! Wait, does the parser handle spaces inside the fraction ratio?
  });

  it('throws an error on invalid scale size', () => {
    const invalidSizeScl = `! comment
Bad size scale
-5
100.0
`;
    expect(() => parseScl(invalidSizeScl)).toThrow('Invalid Scala scale size');
  });

  it('throws an error on non-integer scale size', () => {
    const invalidSizeScl = `! comment
Bad size scale
twelve
100.0
`;
    expect(() => parseScl(invalidSizeScl)).toThrow('Invalid Scala scale size');
  });

  it('throws an error on incomplete files (no size)', () => {
    const incompleteScl = `! comment
Only a description
`;
    expect(() => parseScl(incompleteScl)).toThrow(
      'Incomplete Scala file: Missing scale size definition.',
    );
  });

  it('throws an error on missing note lines', () => {
    const incompleteScl = `! comment
Short scale
3
100.0
200.0
`;
    expect(() => parseScl(incompleteScl)).toThrow(
      'Incomplete Scala file: Expected 3 notes, but parsed only 2.',
    );
  });

  it('throws an error on negative cents or invalid cents format', () => {
    const badCentScl = `! comment
Bad Cent Scale
1
-100.0
`;
    expect(() => parseScl(badCentScl)).toThrow('Invalid cent value in SCL');
  });

  it('throws an error on invalid fraction or integer ratios', () => {
    const badRatioScl1 = `! comment
Bad Fraction
1
3/0
`;
    expect(() => parseScl(badRatioScl1)).toThrow(
      'Invalid fraction ratio in SCL',
    );

    const badRatioScl2 = `! comment
Bad Integer
1
-2
`;
    expect(() => parseScl(badRatioScl2)).toThrow(
      'Invalid integer ratio in SCL',
    );
  });

  it('ignores trailing extra lines beyond scale size', () => {
    const extraLinesScl = `! comment
3-tone scale
3
1.1
1.2
2.0
Extra line that should be ignored
Another extra line
`;
    const parsed = parseScl(extraLinesScl);
    expect(parsed.size).toBe(3);
    expect(parsed.scaleRatios.length).toBe(4);
  });
});
