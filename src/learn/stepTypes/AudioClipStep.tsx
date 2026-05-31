import { useEffect, useRef, useState } from 'react';
import type { LessonStep } from '../LearnApp';
import type { BridgeClient } from '../../research/bridge/BridgeClient';
import type { StepActionType } from '../progress/ProgressClient';

interface AudioClipStepProps {
  step: LessonStep;
  bridgeClient: BridgeClient | null;
  onComplete: () => void;
  onStepAction?: (action: StepActionType) => void;
}

interface ClipMeta {
  slug: string;
  title: string;
  description: string;
  duration_ms: number;
  license: string;
  attribution: string | null;
  audio_url: string | null;
}

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

// A small static "waveform" strip — a cheap visual without decoding peaks.
const BARS = Array.from(
  { length: 48 },
  (_, i) => 0.25 + 0.7 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.21)),
);

export function AudioClipStep({
  step,
  bridgeClient,
  onComplete,
  onStepAction,
}: AudioClipStepProps) {
  const {
    clip_id,
    intro_text,
    outro_text,
    auto_advance = false,
    loop: configLoop = false,
  } = step.config || {};

  const audioRef = useRef<HTMLAudioElement>(null);
  const weSuspended = useRef(false);
  const [meta, setMeta] = useState<ClipMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [played, setPlayed] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [loop, setLoop] = useState<boolean>(Boolean(configLoop));

  // Fetch clip metadata (lazy: only when this step renders).
  useEffect(() => {
    let cancelled = false;
    if (!clip_id) {
      setError('This step has no clip reference.');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/clips/${clip_id}`);
        if (!res.ok) throw new Error(`clip ${clip_id} not found`);
        const data = (await res.json()) as ClipMeta;
        if (!cancelled) setMeta(data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load clip');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clip_id]);

  // Pause the live engine for the duration of this step so clips don't fight it.
  useEffect(() => {
    let active = true;
    (async () => {
      if (bridgeClient) {
        try {
          weSuspended.current = await bridgeClient.suspendEngine();
        } catch {
          weSuspended.current = false;
        }
      }
      if (!active) return;
    })();
    return () => {
      active = false;
      // Resume only a context we suspended (don't override a user-paused engine).
      if (bridgeClient && weSuspended.current) {
        void bridgeClient.resumeEngine();
        weSuspended.current = false;
      }
    };
  }, [bridgeClient, step.id]);

  const onEnded = () => {
    setProgress(1);
    if (auto_advance) onComplete();
  };

  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (a && a.duration) setProgress(a.currentTime / a.duration);
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      // First start is a play; any later start (user already heard it) is a
      // replay — the distinction the per-clip analytics surfaces.
      onStepAction?.(played ? 'clip_replay' : 'clip_play');
      setPlayed(true);
      void a.play();
    } else {
      a.pause();
    }
  };

  return (
    <div className="learn-step-content audio-clip-step animate-fade-in">
      <div className="step-body-text">
        <p className="step-paragraph">{intro_text}</p>
      </div>

      {error && <p className="audio-clip-error">⚠ {error}</p>}

      {meta && (
        <div className="audio-clip-card">
          <div className="audio-clip-head">
            <span className="audio-clip-title">{meta.title}</span>
            <span className="audio-clip-duration">
              {Math.round(meta.duration_ms / 1000)}s
            </span>
          </div>

          {/* Lightweight waveform strip; fill tracks playback progress. */}
          <div
            className="audio-clip-waveform"
            role="img"
            aria-label={`Waveform for ${meta.title}`}
          >
            {BARS.map((h, i) => (
              <span
                key={i}
                className={
                  i / BARS.length <= progress ? 'wf-bar wf-played' : 'wf-bar'
                }
                style={{ height: `${Math.round(h * 100)}%` }}
              />
            ))}
          </div>

          <div className="audio-clip-controls">
            <button
              className="audio-clip-play"
              onClick={togglePlay}
              disabled={!meta.audio_url}
            >
              {progress >= 1 ? 'Replay' : 'Play / Pause'}
            </button>
            <label className="audio-clip-loop">
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => {
                  setLoop(e.target.checked);
                  if (audioRef.current)
                    audioRef.current.loop = e.target.checked;
                }}
              />
              Loop
            </label>
          </div>

          <audio
            ref={audioRef}
            src={meta.audio_url ?? undefined}
            preload="metadata"
            loop={loop}
            onEnded={onEnded}
            onTimeUpdate={onTimeUpdate}
          />

          {/* License footer — visible on hover/focus of the card. */}
          <div className="audio-clip-license" tabIndex={0}>
            <span className="audio-clip-license-badge">{meta.license}</span>
            {meta.attribution && (
              <span className="audio-clip-attribution">{meta.attribution}</span>
            )}
          </div>
        </div>
      )}

      {/* Outro appears once the clip has finished. */}
      {progress >= 1 && outro_text && (
        <div className="step-body-text audio-clip-outro animate-fade-in">
          <p className="step-paragraph">{outro_text}</p>
        </div>
      )}

      {!auto_advance && (
        <div className="step-footer-actions">
          <button
            className="learn-primary-btn"
            onClick={onComplete}
            disabled={!played && !error}
            title={!played && !error ? 'Listen to the clip first' : undefined}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
