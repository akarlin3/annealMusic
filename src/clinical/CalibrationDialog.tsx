import { useState, useEffect, useRef } from 'react';
import { Volume2, Play, Square, Save, X } from 'lucide-react';
import { clinicalApi } from './api';
import type { ClinicalProtocol } from './types';

export function CalibrationDialog({
  protocol,
  onClose,
  onCalibrated,
}: {
  protocol: ClinicalProtocol;
  onClose: () => void;
  onCalibrated: () => void;
}) {
  const [deviceName, setDeviceName] = useState('Standard Lab Headphones');
  const [measuredSpl, setMeasuredSpl] = useState(70.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [saving, setSaving] = useState(false);

  const targetSpl = 70.0; // Fixed clinical target reference level in dBA

  // Web Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const startTone = () => {
    try {
      if (!audioCtxRef.current) {
        const WebkitAudioContext = (
          window as Window & { webkitAudioContext?: typeof AudioContext }
        ).webkitAudioContext;
        audioCtxRef.current = new (window.AudioContext || WebkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // 1kHz Sine Tone reference
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, ctx.currentTime); // 1kHz

      // Playback calibration tone at a fixed safe digital level (-20 dBFS / 0.1 amplitude)
      gain.gain.setValueAtTime(0.1, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();

      oscRef.current = osc;
      gainRef.current = gain;
      setIsPlaying(true);
    } catch (err) {
      console.error('Failed to start Web Audio calibration oscillator', err);
    }
  };

  const stopTone = () => {
    if (oscRef.current) {
      try {
        oscRef.current.stop();
      } catch {
        // Safe check
      }
      oscRef.current.disconnect();
      oscRef.current = null;
    }
    if (gainRef.current) {
      gainRef.current.disconnect();
      gainRef.current = null;
    }
    setIsPlaying(false);
  };

  useEffect(() => {
    return () => {
      stopTone();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  const handleSave = async () => {
    if (!deviceName.trim()) {
      alert('Input device identifier.');
      return;
    }
    setSaving(true);
    try {
      // Offset calculation
      const gainOffsetDb = targetSpl - measuredSpl;
      await clinicalApi.recordCalibration(protocol.id, {
        device_name: deviceName,
        measured_spl: measuredSpl,
        target_spl: targetSpl,
        gain_offset_db: gainOffsetDb,
      });
      stopTone();
      onCalibrated();
    } catch {
      alert('Failed to log calibration verification.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm p-4 font-mono text-xs text-stone-200">
      <div className="w-full max-w-sm border border-stone-900 bg-stone-950/90 rounded-2xl p-5 flex flex-col gap-4 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-600 hover:text-stone-300 transition-all p-1"
        >
          <X size={14} />
        </button>

        <div className="flex items-center gap-2 border-b border-stone-900 pb-2.5">
          <Volume2 size={16} className="text-amber-500" />
          <span className="font-bold text-stone-200 uppercase tracking-wider">
            SPL Headphones Calibration
          </span>
        </div>

        <p className="text-[10px] text-stone-500 leading-relaxed">
          Ensure headphones or speakers are connected. Place your physical SPL
          meter inside the cup, play the 1kHz sine reference, and enter the
          actual dBA reading to align digital gain.
        </p>

        {/* Playback Trigger */}
        <div className="flex flex-col items-center gap-2 bg-stone-950 border border-stone-900 rounded-xl p-4">
          <span className="text-[10px] text-stone-500 font-bold uppercase">
            1kHz Sine Reference (-20 dBFS)
          </span>
          {isPlaying ? (
            <button
              onClick={stopTone}
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-rose-500 text-stone-950 font-bold hover:bg-rose-450 transition-all shadow-lg"
            >
              <Square size={12} /> Stop Tone
            </button>
          ) : (
            <button
              onClick={startTone}
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-emerald-500 text-stone-950 font-bold hover:bg-emerald-450 transition-all shadow-lg"
            >
              <Play size={12} /> Play Tone
            </button>
          )}
        </div>

        {/* Calibration Forms */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-stone-400">
              Headphone/Speaker Device Name:
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. Sennheiser HD600"
              className="bg-stone-900 border border-stone-850 rounded p-2 text-stone-200 outline-none placeholder:text-stone-700"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-stone-400">
              SPL Meter Measured Level (dBA):
            </label>
            <input
              type="number"
              step="0.1"
              value={measuredSpl}
              onChange={(e) => setMeasuredSpl(parseFloat(e.target.value))}
              className="bg-stone-900 border border-stone-850 rounded p-2 text-stone-200 outline-none text-center font-bold text-amber-500"
            />
          </div>

          <div className="flex justify-between text-[10px] text-stone-500 bg-stone-900/10 p-2 rounded border border-stone-900">
            <span>TARGET: {targetSpl} dBA</span>
            <span className="font-bold text-stone-400">
              GAIN OFFSET: {(targetSpl - measuredSpl).toFixed(1)} dB
            </span>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 bg-amber-500 text-stone-950 font-semibold rounded hover:bg-amber-400 transition-all flex items-center justify-center gap-1.5 shadow-lg"
        >
          <Save size={12} />{' '}
          {saving ? 'Locking Calibration...' : 'Lock Calibration & Align'}
        </button>
      </div>
    </div>
  );
}
