import { Capacitor } from '@capacitor/core';
import { webBridge } from './web';
import { capacitorBridge } from './capacitor';
import { PlatformBridge } from './types';

export const platform: PlatformBridge = Capacitor.isNativePlatform()
  ? capacitorBridge
  : webBridge;

export type { PlatformBridge };
