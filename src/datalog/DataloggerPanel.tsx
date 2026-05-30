import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Square,
  Download,
  Trash2,
  Database,
  AlertTriangle,
} from 'lucide-react';
import { DataLogger } from './DataLogger';
import type { DatalogMode } from './schema';
import { writeJSONL } from './writers/jsonl';
import { writeCSV } from './writers/csv';

export const DataloggerPanel: React.FC = () => {
  const logger = DataLogger.getInstance();

  const [isActive, setIsActive] = useState(logger.isActive());
  const [mode, setMode] = useState<DatalogMode>(logger.getMode());
  const [rateHz, setRateHz] = useState<number>(logger.getRateHz());
  const [bufferSize, setBufferSize] = useState(logger.getBuffer().length);
  const [memoryUsage, setMemoryUsage] = useState(logger.getMemoryUsageBytes());
  const [exportFormat, setExportFormat] = useState<'jsonl' | 'csv'>('jsonl');
  const [elapsedTime, setElapsedTime] = useState('00:00');

  const updateTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  useEffect(() => {
    if (isActive) {
      const firstRecord = logger.getBuffer()[0];
      sessionStartRef.current =
        Date.now() -
        (firstRecord
          ? Date.now() - new Date(firstRecord.wallTime).getTime()
          : 0);
      startLiveUpdating();
    } else {
      stopLiveUpdating();
    }

    return () => {
      stopLiveUpdating();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const startLiveUpdating = () => {
    updateTimer.current = setInterval(() => {
      const buf = logger.getBuffer();
      setBufferSize(buf.length);
      setMemoryUsage(logger.getMemoryUsageBytes());

      if (buf.length > 0) {
        const first = new Date(buf[0]!.wallTime).getTime();
        const last = new Date(buf[buf.length - 1]!.wallTime).getTime();
        const diffMs = last - first;
        const totalSecs = Math.floor(diffMs / 1000);
        const mins = String(Math.floor(totalSecs / 60)).padStart(2, '0');
        const secs = String(totalSecs % 60).padStart(2, '0');
        setElapsedTime(`${mins}:${secs}`);
      } else {
        setElapsedTime('00:00');
      }
    }, 200);
  };

  const stopLiveUpdating = () => {
    if (updateTimer.current) {
      clearInterval(updateTimer.current);
      updateTimer.current = null;
    }
  };

  const handleStart = () => {
    logger.start(mode, rateHz);
    setIsActive(true);
    sessionStartRef.current = Date.now();
  };

  const handleStop = () => {
    logger.stop();
    setIsActive(false);
    // Final state pull
    setBufferSize(logger.getBuffer().length);
    setMemoryUsage(logger.getMemoryUsageBytes());
  };

  const handleClear = () => {
    logger.clear();
    setBufferSize(0);
    setMemoryUsage(0);
    setElapsedTime('00:00');
  };

  const handleDownload = () => {
    const buf = logger.getBuffer();
    if (buf.length === 0) return;

    const startTime = buf[0]!.wallTime;
    const endTime = buf[buf.length - 1]!.wallTime;
    const opts = {
      mode,
      rateHz,
      startTime,
      endTime,
      appVersion: '5.3.0',
      bridgeVersion: '1.0',
    };

    let content = '';
    let filename = `session_log_${new Date(startTime).toISOString().replace(/[:.]/g, '-')}`;

    if (exportFormat === 'jsonl') {
      content = writeJSONL(buf, opts);
      filename += '.jsonl';
    } else {
      content = writeCSV(buf, opts);
      filename += '.csv';
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const memoryPercent = Math.min(
    100,
    (memoryUsage / (100 * 1024 * 1024)) * 100,
  );
  const memoryFormatted = (memoryUsage / (1024 * 1024)).toFixed(2);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl transition-all duration-300 hover:border-white/20">
      {/* Background Gradient Orbs */}
      <div className="absolute -right-20 -top-20 -z-10 h-40 w-40 rounded-full bg-violet-600/10 blur-3xl animate-pulse" />
      <div className="absolute -bottom-20 -left-20 -z-10 h-40 w-40 rounded-full bg-emerald-600/10 blur-3xl animate-pulse" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg ${isActive ? 'animate-pulse' : ''}`}
          >
            <Database size={20} />
          </div>
          <div>
            <h3 className="font-semibold tracking-wide text-white">
              Session Datalogger
            </h3>
            <p className="text-xs text-neutral-400">
              Scientific session tracking · Schema v1.0
            </p>
          </div>
        </div>

        {/* Live Pulse */}
        {isActive ? (
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-950/30 px-3 py-1 text-xs font-semibold text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            RECORDING
          </div>
        ) : (
          <div className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs font-semibold text-neutral-400">
            IDLE
          </div>
        )}
      </div>

      {/* Controls & Configuration */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-400">
            Logging Mode
          </label>
          <select
            disabled={isActive}
            value={mode}
            onChange={(e) => setMode(e.target.value as DatalogMode)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition duration-200 hover:border-white/20 focus:border-violet-500 disabled:opacity-50"
          >
            <option value="lightweight" className="bg-neutral-900 text-white">
              Lightweight (10Hz)
            </option>
            <option value="standard" className="bg-neutral-900 text-white">
              Standard (50Hz)
            </option>
            <option value="full" className="bg-neutral-900 text-white">
              Full Spectrum (50Hz)
            </option>
            <option
              value="research-extreme"
              className="bg-neutral-900 text-white"
            >
              Research Extreme (Block)
            </option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-400">
            Sample Rate (Hz)
          </label>
          <select
            disabled={isActive}
            value={rateHz}
            onChange={(e) => setRateHz(Number(e.target.value))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition duration-200 hover:border-white/20 focus:border-violet-500 disabled:opacity-50"
          >
            <option value="10" className="bg-neutral-900 text-white">
              10 Hz
            </option>
            <option value="25" className="bg-neutral-900 text-white">
              25 Hz
            </option>
            <option value="50" className="bg-neutral-900 text-white">
              50 Hz
            </option>
            <option value="100" className="bg-neutral-900 text-white">
              100 Hz
            </option>
          </select>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="mt-6 rounded-xl border border-white/5 bg-white/5 p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-neutral-400">Elapsed</p>
            <p className="mt-1 text-lg font-bold tracking-tight text-white">
              {elapsedTime}
            </p>
          </div>
          <div className="border-x border-white/5">
            <p className="text-xs text-neutral-400">Ticks</p>
            <p className="mt-1 text-lg font-bold tracking-tight text-white">
              {bufferSize.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Size</p>
            <p className="mt-1 text-lg font-bold tracking-tight text-white">
              {memoryFormatted} MB
            </p>
          </div>
        </div>

        {/* Memory Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-neutral-400">
            <span>Buffer Allocation</span>
            <span>{memoryPercent.toFixed(1)}% of 100MB</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${memoryPercent > 80 ? 'bg-amber-500' : 'bg-gradient-to-r from-violet-500 to-indigo-500'}`}
              style={{ width: `${memoryPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Memory Warnings */}
      {memoryPercent >= 95 && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-400">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>
            Memory cap threshold reached. Datalogger is currently cycling
            (oldest records are dropped to prevent memory leaks).
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 flex flex-wrap gap-3">
        {isActive ? (
          <button
            onClick={handleStop}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 font-medium text-white transition duration-200 hover:bg-red-500 active:scale-95"
          >
            <Square size={16} /> Stop Recording
          </button>
        ) : (
          <button
            onClick={handleStart}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 font-medium text-white transition duration-200 hover:bg-violet-500 active:scale-95"
          >
            <Play size={16} /> Start Recording
          </button>
        )}

        <button
          disabled={isActive || bufferSize === 0}
          onClick={handleClear}
          title="Clear Buffer"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-neutral-400 transition duration-200 hover:border-white/20 hover:text-red-400 active:scale-95 disabled:opacity-30 disabled:hover:text-neutral-400"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Export Section */}
      {bufferSize > 0 && !isActive && (
        <div className="mt-6 border-t border-white/5 pt-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <select
                value={exportFormat}
                onChange={(e) =>
                  setExportFormat(e.target.value as 'jsonl' | 'csv')
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none transition duration-200 hover:border-white/20"
              >
                <option value="jsonl" className="bg-neutral-900 text-white">
                  JSON Lines (.jsonl)
                </option>
                <option value="csv" className="bg-neutral-900 text-white">
                  Tabular CSV (.csv)
                </option>
              </select>
            </div>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black transition duration-200 hover:bg-neutral-200 active:scale-95"
            >
              <Download size={14} /> Export Log
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default DataloggerPanel;
