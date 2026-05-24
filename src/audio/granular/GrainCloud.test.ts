import { afterEach, describe, expect, it, vi } from 'vitest';
import { GrainCloud, type GrainCloudParams } from '@/audio/granular/GrainCloud';
import { MockAudioContext } from '@/test/audioMock';

afterEach(() => {
  vi.useRealTimers();
  MockAudioContext.instances.length = 0;
});

function setup(durationSec = 2) {
  const ctx = new MockAudioContext();
  const source = ctx.createBuffer(
    1,
    Math.floor(ctx.sampleRate * durationSec),
    ctx.sampleRate,
  );
  return { ctx, source };
}

function baseParams(source: AudioBuffer): GrainCloudParams {
  return {
    source,
    sizeMs: 100,
    density: 12,
    positionJitter: 0.4,
    pitchJitter: 0,
    positionCenter: 0.5,
    pitchOffset: 0,
    gain: 1,
  };
}

/** Run `seconds` of audio time in 25 ms ticks, advancing the audio clock. */
function runSeconds(ctx: MockAudioContext, seconds: number): void {
  const ticks = Math.round(seconds / 0.025);
  for (let i = 0; i < ticks; i++) {
    ctx.currentTime += 0.025;
    vi.advanceTimersByTime(25);
  }
}

function makeCloud(ctx: MockAudioContext, random: () => number = () => 0.5) {
  return new GrainCloud(ctx as unknown as AudioContext, random);
}

describe('GrainCloud', () => {
  it('construct → start → stop lifecycle', () => {
    vi.useFakeTimers();
    const { ctx, source } = setup();
    const cloud = makeCloud(ctx);
    expect(cloud.isRunning()).toBe(false);
    cloud.start(baseParams(source as unknown as AudioBuffer));
    expect(cloud.isRunning()).toBe(true);
    runSeconds(ctx, 0.5);
    void cloud.stop();
    expect(cloud.isRunning()).toBe(false);
  });

  it('emits a continuous, non-silent stream of grains', () => {
    vi.useFakeTimers();
    const { ctx, source } = setup();
    const cloud = makeCloud(ctx);
    cloud.start(baseParams(source as unknown as AudioBuffer));
    runSeconds(ctx, 1);
    // ~12 grains/s ⇒ well above a handful; each grain is a Hann-windowed source.
    expect(ctx.nodesOfKind('buffersource').length).toBeGreaterThan(8);
    void cloud.stop();
  });

  it('grain rate tracks the density param', () => {
    vi.useFakeTimers();
    const { ctx, source } = setup();
    const cloud = makeCloud(ctx);
    cloud.start({
      ...baseParams(source as unknown as AudioBuffer),
      density: 10,
    });
    runSeconds(ctx, 2);
    const grains = ctx.nodesOfKind('buffersource').length;
    expect(grains).toBeGreaterThanOrEqual(16);
    expect(grains).toBeLessThanOrEqual(24);
    void cloud.stop();
  });

  it('schedules grains ahead of the clock (currentTime look-ahead)', () => {
    vi.useFakeTimers();
    const { ctx, source } = setup();
    const cloud = makeCloud(ctx);
    cloud.start(baseParams(source as unknown as AudioBuffer));
    runSeconds(ctx, 0.5);
    // Every grain's start time is in the future relative to when it was planned,
    // and within the look-ahead horizon (0.1 s) of the clock at schedule time.
    const sources = ctx.nodesOfKind('buffersource');
    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) {
      const when = src.startCalls[0]?.[0] ?? -1;
      expect(when).toBeGreaterThanOrEqual(0);
      // Never scheduled beyond the current clock + a small look-ahead margin.
      expect(when).toBeLessThanOrEqual(ctx.currentTime + 0.15);
    }
    void cloud.stop();
  });

  it('keeps grain offsets within source bounds even at max jitter', () => {
    vi.useFakeTimers();
    const { ctx, source } = setup(2);
    const cloud = makeCloud(ctx, () => 1); // jitter pushes to the far edge
    cloud.start({
      ...baseParams(source as unknown as AudioBuffer),
      sizeMs: 120,
      positionJitter: 1,
    });
    runSeconds(ctx, 1);
    const grainDur = 0.12;
    for (const src of ctx.nodesOfKind('buffersource')) {
      const offset = src.startCalls[0]?.[1] ?? 0;
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThanOrEqual(2 - grainDur + 1e-6);
    }
    void cloud.stop();
  });

  it('applies pitchOffset as a constant detune on every grain', () => {
    vi.useFakeTimers();
    const { ctx, source } = setup();
    const cloud = makeCloud(ctx);
    cloud.start({
      ...baseParams(source as unknown as AudioBuffer),
      pitchOffset: 1200,
    });
    runSeconds(ctx, 0.5);
    const sources = ctx.nodesOfKind('buffersource');
    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) expect(src.detune.value).toBe(1200);
    void cloud.stop();
  });

  it('param updates apply to subsequent grains, not retroactively', () => {
    vi.useFakeTimers();
    const { ctx, source } = setup();
    const cloud = makeCloud(ctx);
    cloud.start({
      ...baseParams(source as unknown as AudioBuffer),
      density: 8,
    });
    runSeconds(ctx, 1);
    const afterFirst = ctx.nodesOfKind('buffersource').length;
    cloud.setParams({ density: 24 });
    runSeconds(ctx, 1);
    const afterSecond = ctx.nodesOfKind('buffersource').length;
    const secondWindow = afterSecond - afterFirst;
    // The denser window produced clearly more grains than the sparse one.
    expect(secondWindow).toBeGreaterThan(afterFirst);
  });

  it('stops scheduling after stop()', () => {
    vi.useFakeTimers();
    const { ctx, source } = setup();
    const cloud = makeCloud(ctx);
    cloud.start(baseParams(source as unknown as AudioBuffer));
    runSeconds(ctx, 0.5);
    void cloud.stop();
    const count = ctx.nodesOfKind('buffersource').length;
    runSeconds(ctx, 1);
    expect(ctx.nodesOfKind('buffersource').length).toBe(count);
  });

  it('stop with fade ramps output to zero (click-free) before teardown', async () => {
    vi.useFakeTimers();
    const { ctx, source } = setup();
    const cloud = makeCloud(ctx);
    cloud.start(baseParams(source as unknown as AudioBuffer));
    runSeconds(ctx, 0.3);
    const outGain = (
      cloud.getOutputNode() as unknown as {
        gain: { calls: { method: string; args: number[] }[] };
      }
    ).gain;
    const done = cloud.stop(0.2);
    // The fade is a setTargetAtTime ramp toward 0 — no hard cut, no click.
    const ramp = outGain.calls.find(
      (c) => c.method === 'setTargetAtTime' && c.args[0] === 0,
    );
    expect(ramp).toBeDefined();
    await vi.advanceTimersByTimeAsync(250);
    await done;
    expect(cloud.isRunning()).toBe(false);
  });
});
