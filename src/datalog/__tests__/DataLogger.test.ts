/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { DataLogger } from '../DataLogger';
import { writeJSONL, parseJSONL } from '../writers/jsonl';
import { writeCSV } from '../writers/csv';
import type { Orchestrator } from '@/audio/orchestrator';

// Mock ParamStore, preserving original exports like CONTROL_DEFS
vi.mock('@/state/params', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    useParamStore: {
      getState: () => ({
        mode: 'sketch',
        schemaVersion: 'v20',
      }),
    },
  };
});

describe('DataLogger Core & Writers Suite', () => {
  let mockOrchestrator: any;
  let logger: DataLogger;

  beforeEach(() => {
    // 1. Create a fully functional mock AnalyserNode
    const mockAnalyser = {
      fftSize: 1024,
      frequencyBinCount: 512,
      context: {
        sampleRate: 48000,
      },
      getFloatTimeDomainData: vi.fn((array: Float32Array) => {
        // Fill with a simple mock sine wave
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.sin((i * 2 * Math.PI) / 100) * 0.5;
        }
      }),
      getFloatFrequencyData: vi.fn((array: Float32Array) => {
        // Mock dB spectrum (mostly low values, high around bin 10)
        array.fill(-100);
        array[10] = -12; // peak
        array[11] = -18;
      }),
    };

    // 2. Create mock Orchestrator
    mockOrchestrator = {
      getAudioTime: vi.fn().mockReturnValue(1.5),
      getAnalyser: vi.fn().mockReturnValue(mockAnalyser),
      getPartialFrequencies: vi.fn().mockReturnValue([110, 220, 330]),
      getEngineId: vi.fn().mockReturnValue('sine'),
      getOrderParameter: vi.fn().mockReturnValue(0.85),
      getSharedParams: vi.fn().mockReturnValue({
        rootFreq: 110,
        spread: 0.5,
        density: 3,
        coupling: 0.2,
        drift: 0.1,
        brightness: 0.5,
        space: 0.4,
        volume: 0.8,
        tuning: { system: 'equal', referenceA4Hz: 440 },
      }),
      getEngineParams: vi.fn().mockReturnValue({ model: 'harmonic' }),
      getPartialDetunes: vi.fn().mockReturnValue([0.1, -0.2, 0.3]),
    };

    logger = new DataLogger(mockOrchestrator as unknown as Orchestrator);
    logger.clear();
  });

  afterEach(() => {
    logger.stop();
  });

  it('captures a standard log tick correctly with all fields populated', () => {
    logger.start('standard', 50);
    // Directly invoke private writeRecord to generate a mock tick immediately
    (logger as any).writeRecord();

    const buffer = logger.getBuffer();
    expect(buffer).toHaveLength(1);

    const record = buffer[0]!;
    expect(record.timestamp).toBe(0); // 1.5 - 1.5
    expect(record.params.rootFreq).toBe(110);
    expect(record.params.brightness).toBe(0.5);
    expect(record.metadata.engineId).toBe('sine');
    expect(record.metadata.engineParams).toEqual({ model: 'harmonic' });
    expect(record.drift.orderParameter).toBe(0.85);
    expect(record.drift.partials).toEqual([0.1, -0.2, 0.3]);
    expect(record.partials.frequencies).toEqual([110, 220, 330]);

    // Features checks
    expect(record.features.rms).toBeGreaterThan(0.3); // Sine wave RMS is ~0.35
    expect(record.features.zcr).toBeCloseTo(0.02, 1); // zero crossing rate
    expect(record.features.spectralCentroid).toBeGreaterThan(0);
    expect(record.features.spectralFlux).toBe(0); // First frame flux is 0
  });

  it('adjusts logged details based on the selected DatalogMode', () => {
    // 1. Lightweight mode (no partials)
    logger.start('lightweight', 50);
    (logger as any).writeRecord();
    const lightweightRec = logger.getBuffer()[0]!;
    expect(lightweightRec.partials.frequencies).toHaveLength(0);
    expect(lightweightRec.drift.partials).toHaveLength(0);
    expect(lightweightRec.features.spectrum).toBeUndefined();

    // 2. Full mode (includes spectrum)
    logger.clear();
    logger.start('full', 50);
    (logger as any).writeRecord();
    const fullRec = logger.getBuffer()[0]!;
    expect(fullRec.partials.frequencies).toHaveLength(3);
    expect(fullRec.features.spectrum).toBeDefined();
    expect(fullRec.features.spectrum).toHaveLength(512);

    // 3. Research Extreme mode (includes raw audio chunks)
    logger.clear();
    logger.start('research-extreme', 50);
    (logger as any).writeRecord();
    const extremeRec = logger.getBuffer()[0] as any;
    expect(extremeRec.audioChunk).toBeDefined();
    expect(extremeRec.audioChunk).toHaveLength(1024);
  });

  it('respects the 100MB ring buffer memory cap and drops oldest records', () => {
    logger.start('standard', 50);

    // Artificially restrict the max cap to just 2KB for simple test boundaries
    (logger as any).maxMemoryBytes = 1000;

    // Log 10 ticks (each tick is ~400 bytes, so total exceeds 1000 bytes)
    for (let i = 0; i < 15; i++) {
      (logger as any).writeRecord();
    }

    const buffer = logger.snapshot();
    // Buffer length should be restricted, dropping older records
    expect(buffer.length).toBeLessThan(15);
    expect(logger.getMemoryUsageBytes()).toBeLessThanOrEqual(1000);
  });

  it('emits state tick notifications through real-time stream subscription', () => {
    const subscriber = vi.fn();
    const unsubscribe = logger.subscribeTick(subscriber);

    logger.start('standard', 50);
    (logger as any).writeRecord();

    expect(subscriber).toHaveBeenCalledTimes(1);
    const tickObj = subscriber.mock.calls[0]![0];
    expect(tickObj.metadata.engineId).toBe('sine');

    unsubscribe();
    (logger as any).writeRecord();
    // Should not trigger subscriber again
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it('performs lossless JSONL round-trip serialization', () => {
    logger.start('standard', 50);
    (logger as any).writeRecord();
    (logger as any).writeRecord();

    const buf = logger.getBuffer();
    const startTime = buf[0]!.wallTime;
    const jsonlContent = writeJSONL(buf, {
      mode: 'standard',
      rateHz: 50,
      startTime,
    });

    // Verify it is multi-line string
    expect(jsonlContent.trim().split('\n').length).toBe(4); // 1 header, 2 ticks, 1 footer

    const parsed = parseJSONL(jsonlContent);
    expect(parsed.header.type).toBe('header');
    expect(parsed.header.mode).toBe('standard');
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0]!.params.rootFreq).toBe(110);
    expect(parsed.footer.type).toBe('footer');
    expect(parsed.footer.totalRecords).toBe(2);
  });

  it('serializes records to standard flat tabular CSV format', () => {
    logger.start('standard', 50);
    (logger as any).writeRecord();

    const buf = logger.getBuffer();
    const startTime = buf[0]!.wallTime;
    const csvContent = writeCSV(buf, {
      mode: 'standard',
      rateHz: 50,
      startTime,
    });

    const lines = csvContent.split('\n');
    // Headers comment lines are prefixed with '#'
    const commentLines = lines.filter((l) => l.startsWith('#'));
    expect(commentLines.length).toBe(8);

    // CSV header row (contains params.rootFreq, features.rms, etc.)
    const contentLines = lines.filter(
      (l) => l.trim().length > 0 && !l.startsWith('#'),
    );
    expect(contentLines.length).toBe(2); // 1 header row, 1 data row

    const headers = contentLines[0]!.split(',');
    expect(headers).toContain('params.rootFreq');
    expect(headers).toContain('features.rms');
    expect(headers).toContain('metadata.engineId');
    expect(headers).toContain('drift.partials');

    // Values row should contain quoted array elements and simple scalars
    const valuesRow = contentLines[1]!;
    expect(valuesRow).toContain('sine');
    // check if drift detunes or frequencies are stored as quoted JSON array strings
    expect(valuesRow).toContain('"[0.1,-0.2,0.3]"');
  });
});
