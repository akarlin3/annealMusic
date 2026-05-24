import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import LevelMeter from '@/components/LevelMeter';

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** A fake analyser whose time-domain data encodes a fixed RMS amplitude. */
function fakeAnalyser(amplitude: number): AnalyserNode {
  return {
    fftSize: 256,
    getByteTimeDomainData: (buf: Uint8Array) => {
      // Alternate above/below the 128 midpoint to encode |amp| as RMS.
      const delta = Math.round(amplitude * 128);
      for (let i = 0; i < buf.length; i++) {
        buf[i] = 128 + (i % 2 === 0 ? delta : -delta);
      }
    },
  } as unknown as AnalyserNode;
}

describe('LevelMeter', () => {
  it('renders a meter at zero when there is no analyser', () => {
    render(<LevelMeter getAnalyser={() => null} />);
    const meter = screen.getByRole('meter', { name: 'Input level' });
    expect(meter).toHaveAttribute('aria-valuenow', '0');
  });

  it('reflects analyser amplitude on its next update', () => {
    render(<LevelMeter getAnalyser={() => fakeAnalyser(0.5)} />);
    const meter = screen.getByRole('meter', { name: 'Input level' });
    expect(meter).toHaveAttribute('aria-valuenow', '0');

    advance(40); // one ~30 Hz tick
    expect(Number(meter.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  });

  it('returns to zero when the analyser goes away', () => {
    let analyser: AnalyserNode | null = fakeAnalyser(0.4);
    render(<LevelMeter getAnalyser={() => analyser} />);
    const meter = screen.getByRole('meter', { name: 'Input level' });

    advance(40);
    expect(Number(meter.getAttribute('aria-valuenow'))).toBeGreaterThan(0);

    analyser = null;
    advance(40);
    expect(meter).toHaveAttribute('aria-valuenow', '0');
  });
});
