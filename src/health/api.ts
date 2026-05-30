import { registerPlugin, Capacitor } from '@capacitor/core';

export interface HealthBridgePlugin {
  requestPermission(): Promise<{ granted: boolean }>;
  logMindfulSession(options: {
    startDate: string;
    endDate: string;
  }): Promise<{ success: boolean }>;
}

// Register the custom native plugin
export const HealthBridge = registerPlugin<HealthBridgePlugin>('HealthBridge');

// Local storage configuration keys
const KEY_APPLE_OPT_IN = 'am_health_opt_in_apple';
const KEY_GOOGLE_OPT_IN = 'am_health_opt_in_google';
const KEY_INCLUDE_TIMER = 'am_health_include_timer';

export const isIOS = () => Capacitor.getPlatform() === 'ios';
export const isAndroid = () => Capacitor.getPlatform() === 'android';
export const isMobile = () => isIOS() || isAndroid();

export const healthApi = {
  isSupported(): boolean {
    return isMobile();
  },

  getAppleOptIn(): boolean {
    return localStorage.getItem(KEY_APPLE_OPT_IN) === 'true';
  },

  setAppleOptIn(val: boolean) {
    localStorage.setItem(KEY_APPLE_OPT_IN, String(val));
  },

  getGoogleOptIn(): boolean {
    return localStorage.getItem(KEY_GOOGLE_OPT_IN) === 'true';
  },

  setGoogleOptIn(val: boolean) {
    localStorage.setItem(KEY_GOOGLE_OPT_IN, String(val));
  },

  getIncludeTimer(): boolean {
    return localStorage.getItem(KEY_INCLUDE_TIMER) === 'true';
  },

  setIncludeTimer(val: boolean) {
    localStorage.setItem(KEY_INCLUDE_TIMER, String(val));
  },

  async requestPermission(): Promise<boolean> {
    if (!isMobile()) return false;
    try {
      const res = await HealthBridge.requestPermission();
      return res.granted;
    } catch (e) {
      console.error('[HealthBridge] requestPermission error:', e);
      return false;
    }
  },

  async logPlayedSession(startDate: Date, endDate: Date): Promise<boolean> {
    const isOptedIn = isIOS()
      ? this.getAppleOptIn()
      : isAndroid()
        ? this.getGoogleOptIn()
        : false;
    if (!isOptedIn || !isMobile()) return false;

    try {
      const res = await HealthBridge.logMindfulSession({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      return res.success;
    } catch (e) {
      console.error('[HealthBridge] logMindfulSession error:', e);
      return false;
    }
  },
};
