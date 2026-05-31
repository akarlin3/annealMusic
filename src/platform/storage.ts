import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export interface StorageBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

export class LocalStorageBackend implements StorageBackend {
  private get storage(): Storage | null {
    if (typeof localStorage !== 'undefined') return localStorage;
    if (
      typeof window !== 'undefined' &&
      typeof window.localStorage !== 'undefined'
    ) {
      return window.localStorage;
    }
    return null;
  }

  async get(key: string): Promise<string | null> {
    const s = this.storage;
    return s ? s.getItem(key) : null;
  }

  async set(key: string, value: string): Promise<void> {
    const s = this.storage;
    if (s) s.setItem(key, value);
  }

  async remove(key: string): Promise<void> {
    const s = this.storage;
    if (s) s.removeItem(key);
  }

  async clear(): Promise<void> {
    const s = this.storage;
    if (s) s.clear();
  }
}

export class CapacitorPreferencesBackend implements StorageBackend {
  async get(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  }

  async set(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }

  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  }

  async clear(): Promise<void> {
    await Preferences.clear();
  }
}

export class HybridStorageBackend implements StorageBackend {
  private local = new LocalStorageBackend();
  private pref = new CapacitorPreferencesBackend();
  private isMobile: boolean;

  constructor(isMobile = false) {
    this.isMobile = isMobile;
  }

  private get active(): StorageBackend {
    return this.isMobile ? this.pref : this.local;
  }

  async get(key: string): Promise<string | null> {
    return this.active.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    await this.active.set(key, value);
  }

  async remove(key: string): Promise<void> {
    await this.active.remove(key);
  }

  async clear(): Promise<void> {
    await this.active.clear();
  }
}

// Global shared storage backend instance
export const appStorage = new HybridStorageBackend(
  Capacitor.isNativePlatform(),
);
