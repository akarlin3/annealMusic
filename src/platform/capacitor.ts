import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { PlatformBridge } from './types';
import { FEATURE_FLAGS } from '../config/flags';
import { appStorage } from './storage';

const STORAGE_KEY = 'am_anon_id';

export const capacitorBridge: PlatformBridge = {
  getPlatform: () => (Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'),

  getPersistedAnonId: async () => {
    if (FEATURE_FLAGS.USE_STORAGE_ABSTRACTION) {
      return appStorage.get(STORAGE_KEY);
    }
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      return value;
    } catch {
      return null;
    }
  },

  setPersistedAnonId: async (id) => {
    if (FEATURE_FLAGS.USE_STORAGE_ABSTRACTION) {
      await appStorage.set(STORAGE_KEY, id);
      return;
    }
    try {
      await Preferences.set({ key: STORAGE_KEY, value: id });
    } catch (e) {
      console.error('Failed to save anon id to Preferences', e);
    }
  },

  clearPersistedAnonId: async () => {
    if (FEATURE_FLAGS.USE_STORAGE_ABSTRACTION) {
      await appStorage.remove(STORAGE_KEY);
      return;
    }
    try {
      await Preferences.remove({ key: STORAGE_KEY });
    } catch (e) {
      console.error('Failed to clear anon id from Preferences', e);
    }
  },

  requestMicPermission: async () => {
    // For modern native WebViews, calling `navigator.mediaDevices.getUserMedia`
    // will trigger native permissions. However, to proactively check/request
    // permissions, standard Web APIs in Capacitor generally inherit system status.
    // We return 'prompt' here and allow getUserMedia to drive the prompt natively,
    // but this abstraction allows future native shims if desired.
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((track) => track.stop());
        return 'granted';
      }
      return 'prompt';
    } catch (err) {
      const errorName = err instanceof Error ? err.name : '';
      if (
        errorName === 'NotAllowedError' ||
        errorName === 'PermissionDeniedError'
      ) {
        return 'denied';
      }
      return 'prompt';
    }
  },

  onAudioInterruption: (handler) => {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<{ type: 'begin' | 'end' }>;
      if (
        customEvent.detail &&
        (customEvent.detail.type === 'begin' ||
          customEvent.detail.type === 'end')
      ) {
        handler(customEvent.detail.type);
      }
    };
    window.addEventListener('am_audio_interruption', listener);
    return () => {
      window.removeEventListener('am_audio_interruption', listener);
    };
  },

  openAppSettings: async () => {
    // In Capacitor, we can deep link to app settings.
    // iOS: app-settings://
    // Android: Can be handled via standard intent or web fallback (e.g. open system settings)
    if (Capacitor.getPlatform() === 'ios') {
      window.open('app-settings://');
    } else {
      // In Android, opening app settings requires a native intent.
      // But standard webviews can sometimes redirect, or we can instruct the user.
      console.warn(
        'App settings redirect not natively configured on Android. Please open App Settings manually.',
      );
    }
  },
};
