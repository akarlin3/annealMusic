export interface PlatformBridge {
  getPlatform(): 'web' | 'ios' | 'android';
  getPersistedAnonId(): Promise<string | null>;
  setPersistedAnonId(id: string): Promise<void>;
  clearPersistedAnonId(): Promise<void>;
  requestMicPermission(): Promise<'granted' | 'denied' | 'prompt'>;
  onAudioInterruption(handler: (event: 'begin' | 'end') => void): () => void;
  openAppSettings(): Promise<void>;
}
