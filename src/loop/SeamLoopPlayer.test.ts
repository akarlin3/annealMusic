import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeamLoopPlayer, xfadeFor } from '@/loop/SeamLoopPlayer';
import { MockAudioContext } from '@/test/audioMock';

afterEach(() => {
  vi.useRealTimers();
  MockAudioContext.instances.length = 0;
});

function ctxOf(): MockAudioContext {
  return new MockAudioContext();
}

describe('xfadeFor', () => {
  it('caps the crossfade at 120ms for long buffers', () => {
    expect(xfadeFor(5)).toBeCloseTo(0.12, 5);
  });

  it('scales with buffer length for short buffers', () => {
    expect(xfadeFor(0.5)).toBeCloseTo(0.075, 5);
  });
});

describe('SeamLoopPlayer', () => {
  it('schedules an initial voice on start', () => {
    const ctx = ctxOf();
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); // 1s
    const out = ctx.createGain();
    const player = new SeamLoopPlayer(
      ctx as unknown as AudioContext,
      buffer as unknown as AudioBuffer,
      out as unknown as AudioNode,
    );
    player.start();
    expect(ctx.nodesOfKind('buffersource').length).toBeGreaterThanOrEqual(1);
    expect(player.getXfade()).toBeCloseTo(0.12, 5);
    player.stop();
  });

  it('overlaps successive voices by the crossfade (period = dur − xfade)', () => {
    vi.useFakeTimers();
    const ctx = ctxOf();
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); // 1s
    const out = ctx.createGain();
    const player = new SeamLoopPlayer(
      ctx as unknown as AudioContext,
      buffer as unknown as AudioBuffer,
      out as unknown as AudioNode,
    );
    player.start();
    // Advance ~3 s of audio time.
    for (let i = 0; i < 120; i++) {
      ctx.currentTime += 0.025;
      vi.advanceTimersByTime(25);
    }
    const sources = ctx.nodesOfKind('buffersource');
    const starts = sources
      .map((s) => s.startCalls[0]?.[0] ?? 0)
      .sort((a, b) => a - b);
    // Period ≈ 1 − 0.12 = 0.88 s ⇒ ~3–4 voices in 3 s.
    expect(starts.length).toBeGreaterThanOrEqual(3);
    const gap = (starts[2] ?? 0) - (starts[1] ?? 0);
    expect(gap).toBeCloseTo(0.88, 1);
    player.stop();
  });

  it('stops all voices on stop', () => {
    const ctx = ctxOf();
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const player = new SeamLoopPlayer(
      ctx as unknown as AudioContext,
      buffer as unknown as AudioBuffer,
      ctx.createGain() as unknown as AudioNode,
    );
    player.start();
    player.stop();
    for (const src of ctx.nodesOfKind('buffersource')) {
      expect(src.stopped).toBe(true);
    }
  });
});
