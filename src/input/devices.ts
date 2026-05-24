import type { InputDevice } from '@/input/types';

/**
 * List audio input devices. Labels are empty strings until the user grants
 * permission (browser privacy), so callers must render placeholders pre-grant.
 */
export async function enumerateInputDevices(): Promise<InputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === 'audioinput')
    .map((d) => ({ deviceId: d.deviceId, label: d.label }));
}

/** Pick the default input device (the `default`/empty id, else the first). */
export function defaultInputDevice(devices: InputDevice[]): InputDevice | null {
  if (devices.length === 0) return null;
  return (
    devices.find((d) => d.deviceId === '' || d.deviceId === 'default') ??
    devices[0] ??
    null
  );
}
