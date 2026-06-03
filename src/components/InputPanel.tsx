import { useId } from 'react';
import { Headphones, Mic, MicOff } from 'lucide-react';
import LevelMeter from '@/components/LevelMeter';
import InfoTip from '@/components/InfoTip';
import type { InputApi } from '@/hooks/useInput';
import { platform } from '@/platform';

interface InputPanelProps {
  input: InputApi;
}

const labelCaps = 'font-mono text-[10px] uppercase tracking-[0.22em]';

function deviceName(label: string, index: number): string {
  return label || `Input ${index + 1}`;
}

/**
 * Live-input panel: connect flow, device picker, level meter, input level,
 * monitoring toggle, and latency readout. Stays user-controllable at all times
 * (the arc never touches input), so it is never disabled by session state.
 */
export default function InputPanel({ input }: InputPanelProps) {
  const levelInputId = useId();
  const {
    state,
    devices,
    deviceId,
    deviceLabel,
    level,
    monitoring,
    latencyMs,
    errorMessage,
    connect,
    disconnect,
    selectDevice,
    setLevel,
    setMonitoring,
    getAnalyser,
  } = input;

  return (
    <section
      className="mt-6 rounded-sm p-5"
      style={{
        background: 'rgba(245, 158, 11, 0.03)',
        border: '1px solid #1c1917',
      }}
    >
      <div className="mb-4 flex items-center gap-2">
        <Mic size={12} strokeWidth={1.5} style={{ color: '#a8a29e' }} />
        <span className={labelCaps} style={{ color: '#a8a29e' }}>
          Input
        </span>
        <InfoTip id="input.connect" label="live input" />
      </div>

      {(state === 'idle' || state === 'prompting') && (
        <div className="flex flex-col gap-3">
          <p className="max-w-md text-[13px]" style={{ color: '#a8a29e' }}>
            Bring a live instrument or mic into the texture. Audio is processed
            entirely in your browser and never leaves your device.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => connect()}
              disabled={state === 'prompting'}
              className="flex items-center gap-2 rounded-full px-4 py-2 transition-all"
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid #44403c',
                color: '#fef3c7',
                cursor: state === 'prompting' ? 'wait' : 'pointer',
                opacity: state === 'prompting' ? 0.6 : 1,
              }}
            >
              <Mic size={13} strokeWidth={1.5} style={{ color: '#f59e0b' }} />
              <span className={labelCaps}>
                {state === 'prompting'
                  ? 'Allow microphone access…'
                  : 'Connect input'}
              </span>
            </button>
            <span
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: '#a8a29e' }}
            >
              <Headphones size={12} strokeWidth={1.5} />
              Use headphones to avoid feedback
            </span>
          </div>
        </div>
      )}

      {(state === 'denied' || state === 'error') && (
        <div className="flex flex-col gap-3">
          <p className="max-w-md text-[13px]" style={{ color: '#fca5a5' }}>
            {state === 'denied'
              ? platform.getPlatform() === 'web'
                ? 'Microphone access was blocked. Re-enable it in your browser, then retry — Chrome: site settings (lock icon); Safari: Settings ▸ Websites ▸ Microphone.'
                : 'Microphone access was blocked. Please enable microphone permission in your device settings to capture loop audio.'
              : errorMessage || 'Could not connect to the input device.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => connect()}
              className="rounded-full px-4 py-2 transition-all"
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid #44403c',
                color: '#fef3c7',
              }}
            >
              <span className={labelCaps}>Retry</span>
            </button>
            {state === 'denied' && platform.getPlatform() !== 'web' && (
              <button
                type="button"
                onClick={() => platform.openAppSettings()}
                className="rounded-full px-4 py-2 transition-all"
                style={{
                  background: 'rgba(245, 158, 11, 0.04)',
                  border: '1px solid #44403c',
                  color: '#fbbf24',
                }}
              >
                <span className={labelCaps}>Open Settings</span>
              </button>
            )}
          </div>
        </div>
      )}

      {state === 'connected' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5">
              <label
                htmlFor="input-device-select"
                className={labelCaps}
                style={{ color: '#a8a29e' }}
              >
                Device
              </label>
              <InfoTip id="input.device" label="Device" />
            </span>
            <select
              id="input-device-select"
              aria-label="Input device"
              value={deviceId ?? ''}
              onChange={(e) => selectDevice(e.target.value)}
              className="max-w-xs rounded-sm px-3 py-2 text-[13px]"
              style={{
                background: '#0c0a09',
                border: '1px solid #44403c',
                color: '#d6d3d1',
              }}
            >
              {devices.length === 0 && (
                <option value="">{deviceLabel || 'Default device'}</option>
              )}
              {devices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {deviceName(d.label, i)}
                </option>
              ))}
            </select>
          </div>

          <div className="max-w-xs">
            <LevelMeter getAnalyser={getAnalyser} />
          </div>

          <div className="max-w-xs">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="flex items-center gap-1.5">
                <label
                  htmlFor={levelInputId}
                  className="text-[13px]"
                  style={{ color: '#d6d3d1' }}
                >
                  Input Level
                </label>
                <InfoTip id="input.level" label="Input Level" />
              </span>
              <span
                className="font-mono text-[11px] tabular-nums"
                style={{ color: '#fbbf24' }}
              >
                {Math.round(level * 100)}%
              </span>
            </div>
            <input
              id={levelInputId}
              type="range"
              className="am-range"
              min={0}
              max={1}
              step={0.001}
              value={
                level <= 0
                  ? 0
                  : Math.min(
                      1,
                      Math.max(0, Math.log(level / 0.01) / Math.log(2 / 0.01)),
                    )
              }
              aria-label="Input Level"
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setLevel(val === 0 ? 0 : 0.01 * Math.pow(2 / 0.01, val));
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                role="switch"
                aria-checked={monitoring}
                aria-label="Monitoring"
                onClick={() => setMonitoring(!monitoring)}
                title="Monitoring plays your input through the speakers. Use headphones to avoid feedback."
                className="flex items-center gap-2 rounded-full px-3 py-1.5 transition-all"
                style={{
                  background: monitoring
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'transparent',
                  border: '1px solid #44403c',
                  color: monitoring ? '#fef3c7' : '#a8a29e',
                }}
              >
                {monitoring ? (
                  <Mic
                    size={12}
                    strokeWidth={1.5}
                    style={{ color: '#f59e0b' }}
                  />
                ) : (
                  <MicOff size={12} strokeWidth={1.5} />
                )}
                <span className={labelCaps}>
                  Monitoring {monitoring ? 'on' : 'off'}
                </span>
              </button>
              <InfoTip id="input.monitoring" label="Monitoring" />
            </span>

            <button
              type="button"
              onClick={disconnect}
              className="rounded-full px-3 py-1.5 transition-all"
              style={{ border: '1px solid #44403c', color: '#a8a29e' }}
            >
              <span className={labelCaps}>Disconnect</span>
            </button>
          </div>

          <div
            className={`flex items-center gap-1.5 ${labelCaps}`}
            style={{ color: '#a8a29e' }}
          >
            ~{latencyMs} MS INPUT LATENCY · ESTIMATE
            <InfoTip id="input.latency" label="Latency" />
          </div>
        </div>
      )}
    </section>
  );
}
