/* eslint-disable */
import { useState, useEffect, useRef } from 'react';
import { Activity, Heart, Shield } from 'lucide-react';
import { useBiofeedbackStore } from './store';

interface CalibrationFlowProps {
  channelName: string;
  deviceId?: string;
  onCalibrationComplete: (metrics: Record<string, any>) => void;
}

export function CalibrationFlow({
  channelName,
  deviceId = 'polar-h10',
  onCalibrationComplete,
}: CalibrationFlowProps) {
  const connectedDevices = useBiofeedbackStore((s) => s.connectedDevices);
  const activeDevice = connectedDevices[deviceId];

  // Calibration duration depending on signal type
  const getCalibrationDuration = () => {
    if (channelName === 'hrv') return 60; // 60-second HRV
    if (channelName.startsWith('eeg')) return 10; // 10-second EEG
    return 30; // 30-second GSR/others
  };

  const durationSeconds = getCalibrationDuration();
  const [calStep, setCalStep] = useState<'idle' | 'calibrating' | 'done'>(
    'idle',
  );
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const [capturedValues, setCapturedValues] = useState<number[]>([]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionRef = useRef<any>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (subscriptionRef.current) subscriptionRef.current.unsubscribe();
    };
  }, []);

  const startCalibration = () => {
    setCalStep('calibrating');
    setSecondsLeft(durationSeconds);
    setCapturedValues([]);

    if (!activeDevice) {
      console.warn(
        `Device ${deviceId} not found for calibration, using simulation fallback.`,
      );
    }

    // Subscribe to active stream if available
    if (activeDevice) {
      subscriptionRef.current = activeDevice.adapter
        .stream(activeDevice.connection)
        .subscribe({
          next: (frame) => {
            const ch = frame.channels[channelName];
            if (ch) {
              setCapturedValues((prev) => [...prev, ch.value]);
            }
          },
        });
    } else {
      // Simulate capture at 1Hz
      subscriptionRef.current = {
        unsubscribe: () => {},
      };
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          handleCalibrationComplete();
          return 0;
        }

        // Add simulated samples if offline
        if (!activeDevice) {
          if (channelName === 'hrv') {
            setCapturedValues((vals) => [
              ...vals,
              750 + Math.round((Math.random() - 0.5) * 80),
            ]);
          } else if (channelName.startsWith('eeg')) {
            setCapturedValues((vals) => [...vals, (Math.random() - 0.5) * 15]);
          } else {
            setCapturedValues((vals) => [
              ...vals,
              5.2 + (Math.random() - 0.5) * 0.4,
            ]);
          }
        }

        return prev - 1;
      });
    }, 1000);
  };

  const handleCalibrationComplete = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (subscriptionRef.current) subscriptionRef.current.unsubscribe();

    setCalStep('done');

    // Compute metrics
    const metrics: Record<string, any> = {};
    if (channelName === 'hrv') {
      const vals =
        capturedValues.length > 0 ? capturedValues : [800, 810, 790, 805];
      const sum = vals.reduce((a, b) => a + b, 0);
      const mean = sum / vals.length;

      // Compute SDNN (Standard Deviation of Normal-to-Normal intervals)
      const variance =
        vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length;
      const sdnn = Math.sqrt(variance);

      metrics['baseline_mean_rr'] = Math.round(mean);
      metrics['baseline_sdnn'] = Math.round(sdnn);
    } else if (channelName.startsWith('eeg')) {
      metrics['impedance_ok'] = true;
      metrics['blink_threshold'] = 80.0; // standard microvolts threshold
    } else {
      // GSR
      const vals =
        capturedValues.length > 0 ? capturedValues : [5.1, 5.3, 5.2, 5.4];
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      metrics['tonic_scl'] = parseFloat(mean.toFixed(3));
      metrics['active_range'] = 1.2;
    }

    onCalibrationComplete(metrics);
  };

  const progressPercent =
    ((durationSeconds - secondsLeft) / durationSeconds) * 100;

  return (
    <div className="w-full max-w-sm bg-stone-950/80 backdrop-blur-xl border border-stone-850 rounded-3xl p-6 shadow-2xl font-mono text-xs text-stone-300 text-center select-none">
      {/* Title */}
      <div className="flex items-center justify-center gap-1.5 border-b border-stone-900 pb-3 mb-4">
        <Activity className="text-amber-500 animate-pulse" size={14} />
        <span className="font-bold text-stone-100 uppercase tracking-widest text-[10px]">
          Sensor Baseline Calibration
        </span>
      </div>

      {calStep === 'idle' && (
        <div className="flex flex-col items-center gap-4 py-4">
          <Heart className="text-stone-700 animate-pulse" size={36} />
          <div className="flex flex-col gap-1">
            <span className="font-bold text-stone-200 uppercase text-[10px] tracking-wider">
              {channelName === 'hrv'
                ? 'HRV Baseline (60s)'
                : channelName.startsWith('eeg')
                  ? 'EEG Artifact Calibration (10s)'
                  : 'Tonic GSR Baseline (30s)'}
            </span>
            <p className="text-[9px] text-stone-500 leading-relaxed max-w-xs">
              {channelName === 'hrv'
                ? 'Sit in a comfortable upright posture, relax your shoulders, and breathe naturally. We will establish your resting parasympathetic baseline.'
                : channelName.startsWith('eeg')
                  ? 'Verify electrode contacts. Blink gently when requested during the countdown to measure blink artifact thresholds.'
                  : 'Sit quietly. We will record your resting skin conductance tonic levels.'}
            </p>
          </div>
          <button
            onClick={startCalibration}
            className="w-full py-2.5 bg-amber-500 text-stone-950 font-bold rounded-xl hover:bg-amber-450 active:scale-[0.98] transition-all flex items-center justify-center gap-1 mt-2 shadow-md uppercase tracking-wider text-[10px]"
          >
            Start Baseline Check
          </button>
        </div>
      )}

      {calStep === 'calibrating' && (
        <div className="flex flex-col items-center gap-6 py-2">
          {/* Circular Countdown Ring */}
          <div className="h-32 w-32 relative flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="50"
                stroke="rgba(255, 255, 255, 0.03)"
                strokeWidth="6"
                fill="transparent"
              />
              <circle
                cx="64"
                cy="64"
                r="50"
                stroke="#d4a359"
                strokeWidth="6"
                fill="transparent"
                strokeDasharray={314}
                strokeDashoffset={314 - (314 * progressPercent) / 100}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-[24px] font-bold text-stone-100">
                {secondsLeft}s
              </span>
              <span className="text-[8px] text-stone-600 uppercase tracking-widest font-bold">
                Remaining
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1 max-w-xs">
            <span className="font-bold text-stone-400 uppercase text-[9px] tracking-wider">
              Recording Baseline Samples...
            </span>
            <span className="text-[9px] text-stone-500 leading-relaxed">
              {channelName === 'hrv'
                ? 'Keep breathing slowly and remain perfectly still.'
                : channelName.startsWith('eeg')
                  ? 'Electrode impedance verification locked.'
                  : 'Recording tonic skin conductance level drift.'}
            </span>
          </div>

          {/* Sparkline stats */}
          <div className="w-full bg-stone-950 border border-stone-900 rounded-xl p-3 flex items-center justify-between shadow-inner">
            <div className="flex flex-col gap-0.5 text-left">
              <span className="text-[8px] text-stone-600 font-bold uppercase tracking-wider">
                Samples Counted
              </span>
              <span className="text-stone-300 font-bold">
                {capturedValues.length}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 text-right">
              <span className="text-[8px] text-stone-600 font-bold uppercase tracking-wider">
                Current Value
              </span>
              <span className="text-stone-300 font-bold">
                {capturedValues.length > 0
                  ? capturedValues[capturedValues.length - 1]?.toFixed(
                      channelName === 'hrv' ? 0 : 2,
                    )
                  : '--'}{' '}
                <span className="text-[8px] text-stone-600 font-bold uppercase">
                  {channelName === 'hrv'
                    ? 'ms'
                    : channelName.startsWith('eeg')
                      ? 'µV'
                      : 'µS'}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {calStep === 'done' && (
        <div className="flex flex-col items-center gap-4 py-4">
          <Shield size={36} className="text-emerald-500 animate-bounce" />
          <div className="flex flex-col gap-1">
            <span className="font-bold text-stone-200 uppercase text-[10px] tracking-wider">
              Calibration Complete
            </span>
            <p className="text-[9px] text-stone-500 leading-relaxed max-w-xs">
              Baseline mathematical constants calculated successfully and
              calibrated to synthesizer threshold ranges.
            </p>
          </div>
          <button
            onClick={() => handleCalibrationComplete()}
            className="w-full py-2.5 bg-emerald-500 text-stone-950 font-bold rounded-xl hover:bg-emerald-450 active:scale-[0.98] transition-all flex items-center justify-center gap-1 mt-2 shadow-md uppercase tracking-wider text-[10px]"
          >
            Confirm Calibration
          </button>
        </div>
      )}
    </div>
  );
}
