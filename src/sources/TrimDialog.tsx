import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { Play, Pause, Loader2, Upload, X } from 'lucide-react';
import { encodeAudioBufferToWav } from '@/sources/upload';

interface TrimDialogProps {
  buffer: AudioBuffer;
  filename: string;
  onClose: () => void;
  onUpload: (blob: Blob, displayName: string) => Promise<void>;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export default function TrimDialog({
  buffer,
  filename,
  onClose,
  onUpload,
}: TrimDialogProps) {
  const duration = buffer.duration;

  // Enforce max 60s crop initial size
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(Math.min(duration, 60));
  const [displayName, setDisplayName] = useState(
    filename.includes('.')
      ? filename.substring(0, filename.lastIndexOf('.'))
      : filename || 'My Source',
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // Downsample to 600 peak points for rendering
  const peaks = useMemo(() => {
    const points = 600;
    const data = buffer.getChannelData(0);
    const block = Math.max(1, Math.floor(data.length / points));
    const out = new Float32Array(points);
    for (let i = 0; i < points; i++) {
      let max = 0;
      const start = i * block;
      for (let j = 0; j < block; j++) {
        const v = Math.abs(data[start + j] ?? 0);
        if (v > max) max = v;
      }
      out[i] = Math.min(1, max);
    }
    return out;
  }, [buffer]);

  // Audio Playback
  const stopPlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {
        // ignore if already stopped
      }
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const startPlayback = useCallback(
    async (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      stopPlayback();
      if (!audioCtxRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        audioCtxRef.current = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        )();
      }
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = startSec;
      source.loopEnd = endSec;
      source.connect(ctx.destination);
      source.start(0, startSec);
      sourceNodeRef.current = source;
      setIsPlaying(true);
    },
    [buffer, startSec, endSec, stopPlayback],
  );

  const togglePlayback = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isPlaying) {
      stopPlayback();
    } else {
      void startPlayback();
    }
  };

  // Stop playback on start/end change or unmount
  useEffect(() => {
    if (isPlaying) {
      startPlayback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSec, endSec]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  // Redraw canvas on window resizing or handle changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c2d = canvas.getContext('2d');
    if (!c2d) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    canvas.width = w;
    canvas.height = h;

    c2d.clearRect(0, 0, w, h);
    const mid = h / 2;
    const barW = w / peaks.length;

    // Draw full waveform
    for (let i = 0; i < peaks.length; i++) {
      const amp = (peaks[i] ?? 0) * mid * 0.92;
      const x = i * barW;

      const timeAtPoint = (i / peaks.length) * duration;
      const isSelected = timeAtPoint >= startSec && timeAtPoint <= endSec;

      // Color coding: amber-500/golden highlight for selection, stone-700/dimmed for out-of-bounds
      c2d.fillStyle = isSelected ? '#f59e0b' : 'rgba(120, 113, 108, 0.45)';
      c2d.fillRect(x, mid - amp, Math.max(1, barW - 0.5), amp * 2);
    }
  }, [peaks, duration, startSec, endSec]);

  // Draggable Handles Interaction
  const handleContainerInteraction = (
    clientX: number,
    handle: 'start' | 'end',
  ) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const time = (x / rect.width) * duration;

    // Snap to 0.05 seconds
    const snappedTime = Math.max(
      0,
      Math.min(duration, Math.round(time * 20) / 20),
    );

    if (handle === 'start') {
      const nextStart = Math.min(endSec - 0.05, snappedTime);
      // Enforce max 60s
      if (endSec - nextStart <= 60) {
        setStartSec(nextStart);
      } else {
        setStartSec(nextStart);
        setEndSec(nextStart + 60);
      }
    } else {
      const nextEnd = Math.max(startSec + 0.05, snappedTime);
      // Enforce max 60s
      if (nextEnd - startSec <= 60) {
        setEndSec(nextEnd);
      } else {
        setEndSec(nextEnd);
        setStartSec(nextEnd - 60);
      }
    }
  };

  const handlePointerDown = (e: React.MouseEvent, handle: 'start' | 'end') => {
    e.preventDefault();
    const onPointerMove = (moveEvent: PointerEvent) => {
      handleContainerInteraction(moveEvent.clientX, handle);
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const triggerUpload = async () => {
    if (displayName.trim() === '') {
      setErrorMsg('Please enter a display name.');
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);
    stopPlayback();

    try {
      // 1. Encode selection to WAV bytes
      const sliceBlob = encodeAudioBufferToWav(
        buffer,
        startSec,
        endSec - startSec,
      );
      // 2. Upload through router
      await onUpload(sliceBlob, displayName.trim());
    } catch (err: unknown) {
      const apiErr = err as { code?: string; body?: { message?: string } };
      console.error('Upload failed', apiErr);
      const code = apiErr.code || 'unknown_error';
      if (code === 'quota_exceeded') {
        setErrorMsg('Quota exceeded! You are limited to 20 user sources.');
      } else if (code === 'file_too_large') {
        setErrorMsg('Selected segment is too large or too long.');
      } else if (code === 'content_rejected') {
        setErrorMsg('Banned word detected in the display name.');
      } else if (code === 'invalid_audio') {
        setErrorMsg(
          `Audio validation failed: ${apiErr.body?.message || 'Check audio safety guidelines.'}`,
        );
      } else {
        setErrorMsg('Failed to upload source. Please verify connection.');
      }
      setIsUploading(false);
    }
  };

  const startPercent = (startSec / duration) * 100;
  const endPercent = (endSec / duration) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 px-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trim-title"
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-stone-800 bg-stone-900 p-6 shadow-2xl transition-all"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-4">
          <div>
            <h2
              id="trim-title"
              className="text-lg font-semibold text-stone-100"
            >
              Trim Granular Source
            </h2>
            <p className="text-xs text-stone-500 font-mono truncate max-w-md">
              {filename} ({formatTime(duration)})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-stone-800 transition-colors text-stone-400 hover:text-stone-200"
            disabled={isUploading}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Display Name Input */}
        <div className="mt-4">
          <label
            htmlFor="display-name"
            className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2"
          >
            Display Name
          </label>
          <input
            id="display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={isUploading}
            maxLength={120}
            className="w-full rounded-lg border border-stone-800 bg-stone-950 px-4 py-2.5 font-mono text-sm text-stone-200 focus:border-amber-500 focus:outline-none transition-colors"
            placeholder="e.g. Dream Flute"
          />
        </div>

        {/* Waveform Trim Area */}
        <div className="relative mt-6 rounded-lg bg-stone-950/50 p-2 border border-stone-800/40">
          <div
            ref={containerRef}
            className="relative h-32 w-full select-none overflow-hidden"
          >
            <canvas ref={canvasRef} className="h-full w-full opacity-85" />

            {/* Selection Highlight Mask */}
            <div
              className="absolute top-0 bottom-0 border-l border-r border-amber-500 bg-amber-500/5 pointer-events-none"
              style={{
                left: `${startPercent}%`,
                width: `${endPercent - startPercent}%`,
              }}
            />

            {/* Start Handle */}
            <div
              role="slider"
              aria-label="Trim start handle"
              aria-valuenow={startSec}
              aria-valuemin={0}
              aria-valuemax={endSec}
              tabIndex={0}
              onMouseDown={(e) => handlePointerDown(e, 'start')}
              className="absolute top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center group"
              style={{ left: `calc(${startPercent}% - 6px)` }}
            >
              <div className="w-1.5 h-16 rounded bg-amber-500 group-hover:bg-amber-400 group-hover:scale-x-125 transition-all shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
            </div>

            {/* End Handle */}
            <div
              role="slider"
              aria-label="Trim end handle"
              aria-valuenow={endSec}
              aria-valuemin={startSec}
              aria-valuemax={duration}
              tabIndex={0}
              onMouseDown={(e) => handlePointerDown(e, 'end')}
              className="absolute top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center group"
              style={{ left: `calc(${endPercent}% - 6px)` }}
            >
              <div className="w-1.5 h-16 rounded bg-amber-500 group-hover:bg-amber-400 group-hover:scale-x-125 transition-all shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
            </div>
          </div>
        </div>

        {/* Trim Stats / Times */}
        <div className="mt-4 flex items-center justify-between font-mono text-[11px] text-stone-500">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-stone-600 uppercase tracking-wide mr-1">
                In:
              </span>
              <span className="text-stone-300">{formatTime(startSec)}</span>
            </div>
            <div>
              <span className="text-stone-600 uppercase tracking-wide mr-1">
                Out:
              </span>
              <span className="text-stone-300">{formatTime(endSec)}</span>
            </div>
          </div>
          <div>
            <span className="text-stone-600 uppercase tracking-wide mr-1">
              Crop Duration:
            </span>
            <span
              className={`font-semibold ${endSec - startSec > 60.01 ? 'text-red-500' : 'text-amber-500'}`}
            >
              {(endSec - startSec).toFixed(2)}s
            </span>
            <span className="text-stone-600"> / 60.0s max</span>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mt-4 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 text-xs font-mono text-red-400">
            {errorMsg}
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-between border-t border-stone-800 pt-4">
          <button
            type="button"
            onClick={togglePlayback}
            disabled={isUploading}
            className="flex items-center gap-2 rounded-lg border border-stone-850 px-4 py-2 text-xs font-medium text-stone-300 hover:bg-stone-800 active:bg-stone-850 transition-all focus:outline-none"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlaying ? 'Pause Preview' : 'Play Selection'}</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="rounded-lg px-4 py-2.5 text-xs font-medium text-stone-500 hover:text-stone-300 active:text-stone-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={triggerUpload}
              disabled={isUploading || endSec - startSec > 60.01}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-xs font-semibold text-stone-950 hover:bg-amber-400 active:bg-amber-600 transition-all shadow-[0_4px_12px_rgba(245,158,11,0.15)] hover:shadow-[0_4px_16px_rgba(245,158,11,0.25)] focus:outline-none"
            >
              {isUploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Transcoding...</span>
                </>
              ) : (
                <>
                  <Upload size={14} />
                  <span>Upload segment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
