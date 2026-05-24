import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultInputDevice, enumerateInputDevices } from '@/input/devices';
import type { InputDevice } from '@/input/types';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('enumerateInputDevices', () => {
  it('returns only audioinput devices, mapping id + label', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([
          { kind: 'audioinput', deviceId: 'a', label: 'Built-in Mic' },
          { kind: 'videoinput', deviceId: 'cam', label: 'Webcam' },
          { kind: 'audiooutput', deviceId: 'spk', label: 'Speakers' },
          { kind: 'audioinput', deviceId: 'b', label: '' },
        ]),
      },
    });

    const devices = await enumerateInputDevices();
    expect(devices).toEqual([
      { deviceId: 'a', label: 'Built-in Mic' },
      { deviceId: 'b', label: '' },
    ]);
  });

  it('returns [] when the API is unavailable', async () => {
    vi.stubGlobal('navigator', { mediaDevices: {} });
    expect(await enumerateInputDevices()).toEqual([]);
  });
});

describe('defaultInputDevice', () => {
  it('returns null for an empty list', () => {
    expect(defaultInputDevice([])).toBeNull();
  });

  it('prefers the default/empty id, else the first device', () => {
    const list: InputDevice[] = [
      { deviceId: 'a', label: 'A' },
      { deviceId: 'default', label: 'Default' },
    ];
    expect(defaultInputDevice(list)?.deviceId).toBe('default');
    expect(defaultInputDevice([{ deviceId: 'a', label: 'A' }])?.deviceId).toBe(
      'a',
    );
  });
});
