import { afterEach, describe, expect, it, vi } from 'vitest';
import { GranularPlayer } from '@/loop/GranularPlayer';
import { MockAudioContext } from '@/test/audioMock';

afterEach(() => {
  vi.useRealTimers();
  MockAudioContext.instances.length = 0;
});

function setup(durationSec = 2) {
  const ctx = new MockAudioContext();
  const buffer = ctx.createBuffer(
    1,
    Math.floor(ctx.sampleRate * durationSec),
    ctx.sampleRate,
  );
  const out = ctx.createGain();
  return { ctx, buffer, out };
}

/** Run `seconds` of audio time in 25 ms ticks, advancing the audio clock. */
function runSeconds(ctx: MockAudioContext, seconds: number): void {
  const ticks = Math.round(seconds / 0.025);
  for (let i = 0; i < ticks; i++) {
    ctx.currentTime += 0.025;
    vi.advanceTimersByTime(25);
  }
}

describe('GranularPlayer', () => {
  it('emits a continuous stream of grains (non-silent)', () => {
    vi.useFakeTimers();
    const { ctx, buffer, out } = setup();
    const player = new GranularPlayer(
      ctx as unknown as AudioContext,
      buffer as unknown as AudioBuffer,
      out as unknown as AudioNode,
      () => 0.5,
    );
    player.start({ sizeMs: 100, density: 12, posJitter: 0.4, pitchJitter: 0 });
    runSeconds(ctx, 1);
    expect(ctx.nodesOfKind('buffersource').length).toBeGreaterThan(4);
    player.stop();
  });

  it('grain rate tracks the density param', () => {
    vi.useFakeTimers();
    const { ctx, buffer, out } = setup();
    const player = new GranularPlayer(
      ctx as unknown as AudioContext,
      buffer as unknown as AudioBuffer,
      out as unknown as AudioNode,
      () => 0.5,
    );
    player.start({ sizeMs: 80, density: 10, posJitter: 0.2, pitchJitter: 0 });
    runSeconds(ctx, 2);
    const grains = ctx.nodesOfKind('buffersource').length;
    // ~10 grains/s over 2 s ⇒ ~20, allow scheduler slack.
    expect(grains).toBeGreaterThanOrEqual(16);
    expect(grains).toBeLessThanOrEqual(24);
    player.stop();
  });

  it('keeps grain offsets within the buffer bounds', () => {
    vi.useFakeTimers();
    const { ctx, buffer, out } = setup(2);
    // random() = 1 ⇒ jitter pushes toward the far edge; must still clamp in-bounds.
    const player = new GranularPlayer(
      ctx as unknown as AudioContext,
      buffer as unknown as AudioBuffer,
      out as unknown as AudioNode,
      () => 1,
    );
    player.start({ sizeMs: 120, density: 12, posJitter: 1, pitchJitter: 0 });
    runSeconds(ctx, 1);
    const grainDur = 0.12;
    for (const src of ctx.nodesOfKind('buffersource')) {
      const offset = src.startCalls[0]?.[1] ?? 0;
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThanOrEqual(buffer.duration - grainDur + 1e-6);
    }
    player.stop();
  });

  it('stops scheduling after stop', () => {
    vi.useFakeTimers();
    const { ctx, buffer, out } = setup();
    const player = new GranularPlayer(
      ctx as unknown as AudioContext,
      buffer as unknown as AudioBuffer,
      out as unknown as AudioNode,
      () => 0.5,
    );
    player.start({ sizeMs: 100, density: 12, posJitter: 0.4, pitchJitter: 0 });
    runSeconds(ctx, 0.5);
    player.stop();
    const count = ctx.nodesOfKind('buffersource').length;
    runSeconds(ctx, 1);
    expect(ctx.nodesOfKind('buffersource').length).toBe(count);
  });
});
