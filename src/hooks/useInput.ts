import { useCallback, useEffect, useRef, useState } from 'react';
import type { Orchestrator } from '@/audio/orchestrator';
import { enumerateInputDevices } from '@/input/devices';
import { FeedbackDetector, readRms } from '@/input/meter';
import { InputError, type InputDevice, type InputState } from '@/input/types';

const FEEDBACK_GUARD_MS = 100;
const FEEDBACK_RMS = 0.9;
const FEEDBACK_SUSTAIN_MS = 2000;

export interface InputApi {
  state: InputState;
  devices: InputDevice[];
  deviceId: string | undefined;
  deviceLabel: string;
  level: number;
  monitoring: boolean;
  latencyMs: number;
  errorMessage: string;
  connect: (deviceId?: string) => void;
  disconnect: () => void;
  selectDevice: (deviceId: string) => void;
  setLevel: (v: number) => void;
  setMonitoring: (on: boolean) => void;
  getAnalyser: () => AnalyserNode | null;
}

const DEFAULT_LEVEL = 1;

/**
 * React bridge for the live-input voice: owns the input UI state (none of which
 * is persisted or URL-encoded — input is a runtime/hardware concern) and drives
 * the orchestrator's `InputVoice`. The orchestrator is created on demand so the
 * input can connect before the user presses Begin.
 */
export function useInput(
  ensureOrchestrator: () => Orchestrator,
  onToast?: (text: string) => void,
): InputApi {
  const [state, setState] = useState<InputState>('idle');
  const [devices, setDevices] = useState<InputDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [deviceLabel, setDeviceLabel] = useState('');
  const [level, setLevelState] = useState(DEFAULT_LEVEL);
  const [monitoring, setMonitoringState] = useState(false);
  const [latencyMs, setLatencyMs] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const orchRef = useRef<Orchestrator | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      setDevices(await enumerateInputDevices());
    } catch {
      // enumeration failures are non-fatal; keep the prior list
    }
  }, []);

  const connect = useCallback(
    (requestedDeviceId?: string) => {
      const orch = ensureOrchestrator();
      orchRef.current = orch;
      setState('prompting');
      setErrorMessage('');

      void orch
        .connectInput(requestedDeviceId)
        .then(async (result) => {
          setState('connected');
          setDeviceLabel(result.deviceLabel);
          setLatencyMs(result.latencyMs);
          setDeviceId(requestedDeviceId);

          const voice = orch.getInputVoice();
          if (voice) {
            voice.setLevel(level);
            voice.setMonitoring(monitoring);
            unsubRef.current?.();
            unsubRef.current = voice.on((e) => {
              if (e.type === 'device-changed') {
                setDeviceLabel(e.deviceLabel);
                setDeviceId(undefined);
                void refreshDevices();
                onToast?.('Input device changed — reconnected to default');
              } else if (e.type === 'error') {
                setState('error');
                setErrorMessage(e.error.message);
                onToast?.('Input device disconnected');
              }
            });
          }
          await refreshDevices();
        })
        .catch((err: unknown) => {
          const kind = err instanceof InputError ? err.kind : 'unknown';
          const message =
            err instanceof InputError
              ? err.message
              : 'Could not connect to the input device.';
          setState(kind === 'denied' ? 'denied' : 'error');
          setErrorMessage(message);
        });
    },
    [ensureOrchestrator, level, monitoring, onToast, refreshDevices],
  );

  const disconnect = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
    void orchRef.current?.disconnectInput();
    setState('idle');
    setDeviceLabel('');
    setLatencyMs(0);
    setDeviceId(undefined);
    setErrorMessage('');
  }, []);

  const selectDevice = useCallback(
    (id: string) => {
      if (id === deviceId) return;
      connect(id);
    },
    [connect, deviceId],
  );

  const setLevel = useCallback((v: number) => {
    setLevelState(v);
    orchRef.current?.getInputVoice()?.setLevel(v);
  }, []);

  const setMonitoring = useCallback((on: boolean) => {
    setMonitoringState(on);
    orchRef.current?.getInputVoice()?.setMonitoring(on);
  }, []);

  const getAnalyser = useCallback(
    () => orchRef.current?.getInputVoice()?.getAnalyser() ?? null,
    [],
  );

  // Detach the event listener on unmount (the orchestrator owns teardown).
  useEffect(
    () => () => {
      unsubRef.current?.();
      unsubRef.current = null;
    },
    [],
  );

  // Feedback guard: while monitoring, dim it if the input RMS sustains hot.
  useEffect(() => {
    if (!monitoring) return;
    const detector = new FeedbackDetector(
      FEEDBACK_RMS,
      Math.ceil(FEEDBACK_SUSTAIN_MS / FEEDBACK_GUARD_MS),
    );
    const timer = setInterval(() => {
      const analyser = orchRef.current?.getInputVoice()?.getAnalyser();
      if (!analyser) return;
      if (detector.push(readRms(analyser))) {
        setMonitoring(false);
        onToast?.('Possible feedback — reduce input or use headphones.');
      }
    }, FEEDBACK_GUARD_MS);
    return () => clearInterval(timer);
  }, [monitoring, setMonitoring, onToast]);

  return {
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
  };
}
