import { describe, it, expect } from 'vitest';
import { SonificationPlayer } from '../SonificationPlayer';
import { applyLinear } from '../transforms/linear';
import { applyLog } from '../transforms/log';
import { applyExp } from '../transforms/exp';
import { applyDiscrete } from '../transforms/discrete';
import { applyQuantile } from '../transforms/quantile';
import { parseCSV, FileSourceAdapter } from '../sources/fileSource';
import { SyntheticSourceAdapter } from '../sources/syntheticSource';
import type { MappingSpec, TransformDef } from '../types';

describe('Mapping Transforms', () => {
  it('should apply linear transformation correctly', () => {
    const def: TransformDef = {
      type: 'linear',
      rawMin: 0,
      rawMax: 10,
      outMin: 100,
      outMax: 200,
    };
    expect(applyLinear(0, def)).toBe(100);
    expect(applyLinear(5, def)).toBe(150);
    expect(applyLinear(10, def)).toBe(200);
    expect(applyLinear(12, def)).toBe(200); // clamped raw norm
    expect(applyLinear(-2, def)).toBe(100); // clamped raw norm
  });

  it('should apply log transformation correctly', () => {
    const def: TransformDef = {
      type: 'log',
      rawMin: 1,
      rawMax: 100,
      outMin: 0,
      outMax: 1,
    };
    expect(applyLog(1, def)).toBe(0);
    expect(applyLog(10, def)).toBeCloseTo(0.5, 5);
    expect(applyLog(100, def)).toBe(1);
  });

  it('should apply exp transformation correctly', () => {
    const def: TransformDef = {
      type: 'exp',
      rawMin: 0,
      rawMax: 1,
      outMin: 10,
      outMax: 20,
    };
    // expNorm of 0 is 0 -> outMin
    expect(applyExp(0, def)).toBe(10);
    // expNorm of 1 is 1 -> outMax
    expect(applyExp(1, def)).toBe(20);
    // at 0.5, norm is 0.5, expNorm = (e^0.5 - 1) / (e - 1) = (1.6487 - 1) / 1.718 = 0.377
    expect(applyExp(0.5, def)).toBeCloseTo(13.77, 1);
  });

  it('should apply discrete transformation correctly', () => {
    const def: TransformDef = {
      type: 'discrete',
      rawMin: 0,
      rawMax: 10,
      outMin: 0,
      outMax: 100,
      steps: 5, // steps will map to: 0, 25, 50, 75, 100
    };
    expect(applyDiscrete(0, def)).toBe(0);
    expect(applyDiscrete(1.2, def)).toBe(0); // 1.2 / 10 = 0.12 -> rounded to 0
    expect(applyDiscrete(2, def)).toBe(25); // 2 / 10 = 0.2 -> rounded to 0.25
    expect(applyDiscrete(5, def)).toBe(50);
    expect(applyDiscrete(9, def)).toBe(100);
  });

  it('should apply quantile transformation correctly', () => {
    const def: TransformDef = {
      type: 'quantile',
      rawMin: 0,
      rawMax: 10,
      outMin: 0,
      outMax: 10,
      quantiles: [2, 5, 8], // 4 bins: <=2, (2,5], (5,8], >8 mapping to 0, 3.33, 6.66, 10
    };
    expect(applyQuantile(1, def)).toBe(0);
    expect(applyQuantile(3, def)).toBeCloseTo(3.33, 1);
    expect(applyQuantile(6, def)).toBeCloseTo(6.66, 1);
    expect(applyQuantile(9, def)).toBe(10);
  });
});

describe('File Source Adapter', () => {
  it('should parse CSV text correctly', () => {
    const csv = `timestamp,val1,val2\n0,10,20\n1,15,25\n2,18,30`;
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ timestamp: 0, val1: 10, val2: 20 });
    expect(rows[2]?.val2).toBe(30);
  });

  it('should interpolate CSV values surround elapsed time t', () => {
    const spec = {
      id: 'src1',
      type: 'file' as const,
      columns: ['timestamp', 'val1'],
      data: [
        { timestamp: 0, val1: 10 },
        { timestamp: 2, val1: 20 },
        { timestamp: 4, val1: 40 },
      ],
    };
    const adapter = new FileSourceAdapter(spec);
    expect(adapter.getValueAt('val1', 0)).toBe(10);
    expect(adapter.getValueAt('val1', 1)).toBe(15);
    expect(adapter.getValueAt('val1', 3)).toBe(30);
    expect(adapter.getValueAt('val1', 5)).toBe(40); // clamped to max
  });
});

describe('Synthetic Source Adapter', () => {
  it('should evaluate custom formulas at time t', () => {
    const spec = {
      id: 'synth1',
      type: 'synthetic' as const,
      formula: 'sin(t * PI) * 10',
      columns: ['val'],
    };
    const adapter = new SyntheticSourceAdapter(spec);
    expect(adapter.getValueAt('val', 0)).toBeCloseTo(0, 5);
    expect(adapter.getValueAt('val', 0.5)).toBeCloseTo(10, 5);
    expect(adapter.getValueAt('val', 1.0)).toBeCloseTo(0, 5);
  });
});

describe('Sonification Player Orchestration', () => {
  it('should resolve parameter state frames based on mapping specs', () => {
    const spec: MappingSpec = {
      sources: [
        {
          id: 'src1',
          type: 'file',
          columns: ['timestamp', 'val1'],
          data: [
            { timestamp: 0, val1: 10 },
            { timestamp: 10, val1: 20 },
          ],
        },
        {
          id: 'synth1',
          type: 'synthetic',
          formula: 't * 10',
          columns: ['val'],
        },
      ],
      rules: [
        {
          sourceId: 'src1',
          column: 'val1',
          targetType: 'param',
          targetKey: 'brightness',
          transform: {
            type: 'linear',
            rawMin: 10,
            rawMax: 20,
            outMin: 0.1,
            outMax: 0.9,
          },
        },
        {
          sourceId: 'synth1',
          column: 'val',
          targetType: 'engineParam',
          targetKey: 'bell.decay',
          transform: {
            type: 'linear',
            rawMin: 0,
            rawMax: 100,
            outMin: 1,
            outMax: 5,
          },
        },
      ],
    };

    const player = new SonificationPlayer(spec, 10000, 1.0, true);

    // Resolve at t = 5
    const frame = player.resolveStateAt(5);
    // val1 at t=5 is 15 (linear interp) -> transform maps 15 (halfway between 10 and 20) to 0.5 (halfway between 0.1 and 0.9)
    expect(frame.params.brightness).toBeCloseTo(0.5, 5);
    // synth val at t=5 is 50 -> transform maps 50 to 3
    const bellParams = frame.engineParams.bell;
    expect(bellParams).toBeDefined();
    expect(bellParams?.decay).toBeCloseTo(3, 5);

    player.destroy();
  });
});
