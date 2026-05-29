import { PlatformBridge } from './types';

const STORAGE_KEY = 'am_anon_id';

export const webBridge: PlatformBridge = {
  getPlatform: () => 'web',
  getPersistedAnonId: async () => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY);
  },
  setPersistedAnonId: async (id) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, id);
    }
  },
  clearPersistedAnonId: async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  },
  requestMicPermission: async () => {
    if (typeof navigator === 'undefined' || !navigator.permissions) {
      return 'prompt';
    }
    try {
      const state = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      });
      return state.state as 'granted' | 'denied' | 'prompt';
    } catch {
      return 'prompt';
    }
  },
  onAudioInterruption: () => {
    // No-op on standard web
    return () => {};
  },
  openAppSettings: async () => {
    // No-op on standard web
  },
};
