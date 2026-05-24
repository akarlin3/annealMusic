import { afterEach, describe, expect, it } from 'vitest';
import { LoopSlot } from '@/loop/LoopSlot';
import type { CaptureController, CaptureOptions } from '@/loop/capture';
import { DEFAULT_SLOT_CONFIG, DEFAULT_GRAIN } from '@/loop/types';
import { MockAudioContext } from '@/test/audioMock';

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

interface Harness {
  slot: LoopSlot;
  ctx: MockAudioContext;
  source: AudioNode;
  /** The capture options the factory last received (for auto-stop simulation). */
  opts: () => CaptureOptions | null;
}

let active: LoopSlot | null = null;

afterEach(() => {
  active?.dispose();
  active = null;
  MockAudioContext.instances.length = 0;
});

/** Build a slot whose capture factory returns `buffer` on stop. */
function makeSlot(bufferSec: number | null): Harness {
  const ctx = new MockAudioContext();
  const out = ctx.createGain();
  const source = ctx.createGain();
  let lastOpts: CaptureOptions | null = null;

  const factory = async (
    _ctx: AudioContext,
    _src: AudioNode,
    o: CaptureOptions,
  ): Promise<CaptureController> => {
    lastOpts = o;
    const buffer =
      bufferSec === null
        ? null
        : (ctx.createBuffer(
            1,
            Math.floor(ctx.sampleRate * bufferSec),
            ctx.sampleRate,
          ) as unknown as AudioBuffer);
    return {
      stop: async () => buffer,
      dispose: () => undefined,
    };
  };

  const slot = new LoopSlot(
    'A',
    ctx as unknown as AudioContext,
    out as unknown as AudioNode,
    { ...DEFAULT_SLOT_CONFIG, grain: { ...DEFAULT_GRAIN } },
    factory,
  );
  active = slot;
  return {
    slot,
    ctx,
    source: source as unknown as AudioNode,
    opts: () => lastOpts,
  };
}

/** Run the full arm → capture → commit flow for a slot. */
async function capture(h: Harness): Promise<void> {
  h.slot.arm(h.source);
  h.slot.startCapture();
  await flush();
  h.slot.stopCapture();
  await flush();
}

describe('LoopSlot state machine', () => {
  it('arms, captures, and commits to playing', async () => {
    const h = makeSlot(1);
    expect(h.slot.getState()).toBe('empty');
    h.slot.arm(h.source);
    expect(h.slot.getState()).toBe('armed');
    h.slot.startCapture();
    expect(h.slot.getState()).toBe('capturing');
    await flush();
    h.slot.stopCapture();
    await flush();
    expect(h.slot.getState()).toBe('playing');
    expect(h.slot.hasBuffer()).toBe(true);
  });

  it('discards captures shorter than the 250ms minimum', async () => {
    const h = makeSlot(0.1);
    await capture(h);
    expect(h.slot.getState()).toBe('empty');
    expect(h.slot.hasBuffer()).toBe(false);
  });

  it('auto-commits to playing on the 60s auto-stop', async () => {
    const h = makeSlot(1);
    h.slot.arm(h.source);
    h.slot.startCapture();
    await flush();
    // Simulate the capture helper hitting the max-length cap.
    const buffer = h.ctx.createBuffer(
      1,
      h.ctx.sampleRate * 2,
      h.ctx.sampleRate,
    ) as unknown as AudioBuffer;
    h.opts()?.onAutoStop?.(buffer);
    expect(h.slot.getState()).toBe('playing');
  });

  it('disarms back to empty', () => {
    const h = makeSlot(1);
    h.slot.arm(h.source);
    h.slot.disarm();
    expect(h.slot.getState()).toBe('empty');
  });

  it('freezes and unfreezes', async () => {
    const h = makeSlot(1);
    await capture(h);
    h.slot.freeze();
    expect(h.slot.getState()).toBe('frozen');
    h.slot.unfreeze();
    expect(h.slot.getState()).toBe('playing');
  });

  it('mutes and restores playing on unmute', async () => {
    const h = makeSlot(1);
    await capture(h);
    h.slot.mute();
    expect(h.slot.getState()).toBe('muted');
    h.slot.unmute();
    expect(h.slot.getState()).toBe('playing');
  });

  it('remembers frozen across a mute/unmute cycle', async () => {
    const h = makeSlot(1);
    await capture(h);
    h.slot.freeze();
    h.slot.mute();
    expect(h.slot.getState()).toBe('muted');
    h.slot.unmute();
    expect(h.slot.getState()).toBe('frozen');
  });

  it('clears any state back to empty and releases the buffer', async () => {
    const h = makeSlot(1);
    await capture(h);
    h.slot.clear();
    expect(h.slot.getState()).toBe('empty');
    expect(h.slot.hasBuffer()).toBe(false);
  });

  it('rejects illegal transitions', async () => {
    const h = makeSlot(1);
    // From empty: freeze/unfreeze/mute/startCapture/stopCapture are no-ops.
    h.slot.freeze();
    h.slot.unfreeze();
    h.slot.mute();
    h.slot.startCapture();
    h.slot.stopCapture();
    expect(h.slot.getState()).toBe('empty');

    await capture(h); // → playing
    // From playing: arm + unfreeze are no-ops; freezing is the only escalation.
    h.slot.arm(h.source);
    expect(h.slot.getState()).toBe('playing');
    h.slot.unfreeze();
    expect(h.slot.getState()).toBe('playing');
  });
});
