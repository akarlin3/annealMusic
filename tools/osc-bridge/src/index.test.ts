import { describe, it, expect } from 'vitest';
import { encodeOsc, decodeOsc } from './index.js';

describe('Bridge Binary OSC Encoder and Decoder', () => {
  it('correctly encodes and decodes root frequency float parameter', () => {
    const address = '/anneal/state/root';
    const args = [110.32];

    const buf = encodeOsc(address, args);
    const decoded = decodeOsc(buf);

    expect(decoded.address).toBe(address);
    expect(decoded.args).toHaveLength(1);
    expect(decoded.args[0]).toBeCloseTo(110.32, 4);
  });

  it('correctly encodes and decodes density integer parameter', () => {
    const address = '/anneal/state/density';
    const args = [6];

    const buf = encodeOsc(address, args);
    const decoded = decodeOsc(buf);

    expect(decoded.address).toBe(address);
    expect(decoded.args).toEqual([6]);
  });

  it('correctly encodes and decodes active engine string parameter', () => {
    const address = '/anneal/state/engine';
    const args = ['granular'];

    const buf = encodeOsc(address, args);
    const decoded = decodeOsc(buf);

    expect(decoded.address).toBe(address);
    expect(decoded.args).toEqual(['granular']);
  });

  it('correctly encodes and decodes spectrum FFT blob arrays', () => {
    const address = '/anneal/spectrum';
    const args = [new Uint8Array([0, 50, 100, 150, 200, 255])];

    const buf = encodeOsc(address, args);
    const decoded = decodeOsc(buf);

    expect(decoded.address).toBe(address);
    expect(decoded.args).toHaveLength(1);
    expect(decoded.args[0]).toEqual([0, 50, 100, 150, 200, 255]);
  });

  it('handles multiple mixed parameters in a single packet', () => {
    const address = '/anneal/mixed';
    const args = [110.0, 6, 'sine'];

    const buf = encodeOsc(address, args);
    const decoded = decodeOsc(buf);

    expect(decoded.address).toBe(address);
    expect(decoded.args).toHaveLength(3);
    expect(decoded.args[0]).toBeCloseTo(110.0, 4);
    expect(decoded.args[1]).toBe(6);
    expect(decoded.args[2]).toBe('sine');
  });
});
