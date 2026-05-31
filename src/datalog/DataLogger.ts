/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Orchestrator } from '@/audio/orchestrator';
import { useParamStore } from '@/state/params';
import type { DatalogMode, SessionLogRecord } from './schema';
import { DATALOG_SCHEMA_VERSION } from './schema';
import { SCHEMA_VERSION } from '@/share/schema';

export class DataLogger {
  private static instance: DataLogger | null = null;

  private orchestrator: Orchestrator | null = null;
  private mode: DatalogMode = 'standard';
  private rateHz = 50;
  private ringBuffer: SessionLogRecord[] = [];
  private ringBufferSizes: number[] = [];
  private totalSizeBytes = 0;
  private maxMemoryBytes = 100 * 1024 * 1024; // 100MB Limit
  private loggingInterval: ReturnType<typeof setInterval> | null = null;
  private isLoggingActive = false;
  private sessionStartAudioTime = 0;

  // Analysis state to minimize GC pressure
  private prevMagnitudes: Float32Array | null = null;
  private pendingEvents: Array<{ name: string; data?: any }> = [];
  private hadOverflow = false;

  // Listeners for Pyodide bridge streams
  private tickListeners: Set<(tick: SessionLogRecord) => void> = new Set();

  static getInstance(): DataLogger {
    if (!DataLogger.instance) {
      DataLogger.instance = new DataLogger();
    }
    return DataLogger.instance;
  }

  constructor(orchestrator?: Orchestrator) {
    if (orchestrator) {
      this.orchestrator = orchestrator;
    }
  }

  setOrchestrator(orchestrator: Orchestrator): void {
    this.orchestrator = orchestrator;
  }

  getMode(): DatalogMode {
    return this.mode;
  }

  getRateHz(): number {
    return this.rateHz;
  }

  isActive(): boolean {
    return this.isLoggingActive;
  }

  getBuffer(): readonly SessionLogRecord[] {
    return this.ringBuffer;
  }

  getMemoryUsageBytes(): number {
    return this.totalSizeBytes;
  }

  /**
   * Starts logging at the specified rate and mode.
   */
  start(mode: DatalogMode = 'standard', rateHz = 50): void {
    if (this.isLoggingActive) {
      // Just update mode and rate mid-session
      this.mode = mode;
      if (this.rateHz !== rateHz) {
        this.rateHz = rateHz;
        this.stopInterval();
        this.startInterval();
      }
      this.logEvent('datalog-config-change', { mode, rateHz });
      return;
    }

    this.mode = mode;
    this.rateHz = rateHz;
    this.isLoggingActive = true;
    this.hadOverflow = false;
    this.sessionStartAudioTime = this.orchestrator?.getAudioTime() ?? 0;
    this.prevMagnitudes = null;

    this.logEvent('session-start', { mode, rateHz });
    this.startInterval();
  }

  /**
   * Stops logging.
   */
  stop(): void {
    if (!this.isLoggingActive) return;
    this.logEvent('session-stop');
    this.stopInterval();
    this.isLoggingActive = false;
  }

  /**
   * Clear the ring buffer.
   */
  clear(): void {
    this.ringBuffer = [];
    this.ringBufferSizes = [];
    this.totalSizeBytes = 0;
    this.hadOverflow = false;
    this.pendingEvents = [];
  }

  /**
   * Queue an event to be written on the next tick.
   */
  logEvent(name: string, data?: any): void {
    const eventObj = { name, data };
    if (!this.isLoggingActive) {
      // If logging is inactive, we can log it as an immediate standalone record if an orchestrator is set
      this.writeRecord(eventObj);
    } else {
      this.pendingEvents.push(eventObj);
    }
  }

  /**
   * Add a real-time subscriber for ticks.
   */
  subscribeTick(fn: (tick: SessionLogRecord) => void): () => void {
    this.tickListeners.add(fn);
    return () => {
      this.tickListeners.delete(fn);
    };
  }

  /**
   * Returns latest N ticks as a structured object.
   */
  snapshot(limit?: number): SessionLogRecord[] {
    if (limit === undefined || limit <= 0) {
      return [...this.ringBuffer];
    }
    return this.ringBuffer.slice(-limit);
  }

  private startInterval(): void {
    const intervalMs = 1000 / this.rateHz;
    this.loggingInterval = setInterval(() => {
      this.captureTick();
    }, intervalMs);
  }

  private stopInterval(): void {
    if (this.loggingInterval) {
      clearInterval(this.loggingInterval);
      this.loggingInterval = null;
    }
  }

  private captureTick(): void {
    this.writeRecord();
  }

  private writeRecord(immediateEvent?: { name: string; data?: any }): void {
    const orch = this.orchestrator;
    if (!orch) return;

    const currentTime = orch.getAudioTime();
    const timestamp = Math.max(0, currentTime - this.sessionStartAudioTime);
    const wallTime = new Date().toISOString();

    const paramState = useParamStore.getState();
    const sharedParams = orch.getSharedParams();

    // 1. Resolve event flags
    let event: string | null = null;
    let eventData: Record<string, any> | undefined = undefined;

    if (immediateEvent) {
      event = immediateEvent.name;
      eventData = immediateEvent.data;
    } else if (this.pendingEvents.length > 0) {
      const first = this.pendingEvents.shift()!;
      event = first.name;
      eventData = first.data;
    } else if (this.hadOverflow) {
      event = 'ring-buffer-overflow';
      eventData = {
        message: 'Circular buffer cap reached. Oldest ticks discarded.',
      };
      this.hadOverflow = false;
    }

    // 2. Query Analyser features
    const analyser = orch.getAnalyser();
    let rms = 0;
    let zcr = 0;
    let centroid = 0;
    let flux = 0;
    let spectrum: number[] | undefined = undefined;
    let rawAudio: number[] | undefined = undefined;

    if (analyser) {
      const fftSize = analyser.fftSize;
      const sampleRate = analyser.context.sampleRate;

      // Time-domain features (ZCR, RMS, raw chunks)
      const timeData = new Float32Array(fftSize);
      analyser.getFloatTimeDomainData(timeData);

      // RMS
      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        const val = timeData[i]!;
        sumSq += val * val;
      }
      rms = Math.sqrt(sumSq / timeData.length);

      // ZCR
      let crossings = 0;
      for (let i = 1; i < timeData.length; i++) {
        const prev = timeData[i - 1]!;
        const curr = timeData[i]!;
        if ((prev < 0 && curr >= 0) || (prev >= 0 && curr < 0)) {
          crossings++;
        }
      }
      zcr = crossings / (timeData.length - 1);

      if (this.mode === 'research-extreme') {
        rawAudio = Array.from(timeData);
      }

      // Frequency-domain features (Centroid, Flux, spectrum)
      const freqData = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(freqData);

      // Linear magnitudes from decibels
      const magnitudes = new Float32Array(freqData.length);
      let centroidNumerator = 0;
      let centroidDenominator = 0;

      for (let i = 0; i < freqData.length; i++) {
        const db = freqData[i]!;
        const mag = db > -100 ? Math.pow(10, db / 20) : 0;
        magnitudes[i] = mag;

        const freq = (i * sampleRate) / fftSize;
        centroidNumerator += freq * mag;
        centroidDenominator += mag;
      }

      centroid =
        centroidDenominator > 1e-7
          ? centroidNumerator / centroidDenominator
          : 0;

      // Spectral Flux
      if (
        this.prevMagnitudes &&
        this.prevMagnitudes.length === magnitudes.length
      ) {
        let diffSum = 0;
        for (let i = 0; i < magnitudes.length; i++) {
          const diff = magnitudes[i]! - this.prevMagnitudes[i]!;
          diffSum += diff * diff;
        }
        flux = Math.sqrt(diffSum) / magnitudes.length;
      }
      this.prevMagnitudes = magnitudes;

      if (this.mode === 'full' || this.mode === 'research-extreme') {
        spectrum = Array.from(freqData);
      }
    }

    // 3. Drill down parameters based on selected Mode
    const includePartials = this.mode !== 'lightweight';

    const frequencies = includePartials ? orch.getPartialFrequencies() : [];
    const amplitudes = includePartials
      ? frequencies.map((_, i) => 0.32 / (i + 1))
      : [];
    const driftPartials = includePartials ? orch.getPartialDetunes() : [];

    const record: SessionLogRecord = {
      timestamp,
      wallTime,
      params: {
        rootFreq: sharedParams.rootFreq,
        spread: sharedParams.spread,
        density: sharedParams.density,
        coupling: sharedParams.coupling,
        drift: sharedParams.drift,
        brightness: sharedParams.brightness,
        space: sharedParams.space,
        volume: sharedParams.volume,
      },
      metadata: {
        mode: paramState.mode,
        engineId: orch.getEngineId(),
        engineParams: orch.getEngineParams(),
        tuning: {
          system: sharedParams.tuning?.system ?? 'equal',
          referenceA4Hz: sharedParams.tuning?.referenceA4Hz ?? 440,
          sclId: sharedParams.tuning?.sclId,
        },
        schemaVersion: 'v' + SCHEMA_VERSION,
        logSchemaVersion: DATALOG_SCHEMA_VERSION,
      },
      drift: {
        meanDetune:
          driftPartials.length > 0
            ? driftPartials.reduce((a, b) => a + b, 0) / driftPartials.length
            : 0,
        orderParameter: orch.getOrderParameter(),
        partials: driftPartials,
      },
      partials: {
        frequencies,
        amplitudes,
      },
      features: {
        rms,
        spectralCentroid: centroid,
        spectralFlux: flux,
        zcr,
        ...(spectrum ? { spectrum } : {}),
      },
      event,
      ...(eventData ? { eventData } : {}),
      ...(rawAudio ? ({ audioChunk: rawAudio } as any) : {}),
    };

    // 4. Memory footprint management: O(1) estimation to completely avoid JSON.stringify overhead
    let estSize = 250; // base structure footprint
    if (record.features?.spectrum) {
      estSize += record.features.spectrum.length * 7;
    }
    if ((record as any).audioChunk) {
      estSize += (record as any).audioChunk.length * 7;
    }
    if (record.partials?.frequencies) {
      estSize += record.partials.frequencies.length * 12;
    }
    if (record.event) {
      estSize += 50 + (eventData ? JSON.stringify(eventData).length : 0);
    }

    this.ringBuffer.push(record);
    this.ringBufferSizes.push(estSize);
    this.totalSizeBytes += estSize;

    while (this.totalSizeBytes > this.maxMemoryBytes) {
      this.ringBuffer.shift();
      const oldestSize = this.ringBufferSizes.shift();
      if (oldestSize !== undefined) {
        this.totalSizeBytes -= oldestSize;
        this.hadOverflow = true;
      } else {
        break;
      }
    }

    // 5. Notify streaming subscribers
    for (const listener of this.tickListeners) {
      try {
        listener(record);
      } catch (err) {
        console.error('[datalog] streaming subscriber crashed:', err);
      }
    }
  }
}
