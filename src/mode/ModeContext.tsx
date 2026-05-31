import { createContext, useState, useEffect, ReactNode } from 'react';
import type { AppMode } from './types';
import { appStorage } from '@/platform/storage';

export interface ModeContextType {
  mode: AppMode | null;
  loading: boolean;
  setMode: (mode: AppMode) => Promise<void>;
  showPicker: boolean;
  setShowPicker: (show: boolean) => void;
}

export const ModeContext = createContext<ModeContextType | undefined>(
  undefined,
);

const STORAGE_KEY = 'am_app_mode';

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    async function loadMode() {
      try {
        const stored = await appStorage.get(STORAGE_KEY);
        if (
          stored === 'meditation' ||
          stored === 'musician' ||
          stored === 'researcher'
        ) {
          setModeState(stored as AppMode);
        } else {
          // No valid mode stored -> first-time user
          setShowPicker(true);
        }
      } catch (e) {
        console.error('Failed to load mode from storage', e);
      } finally {
        setLoading(false);
      }
    }
    void loadMode();
  }, []);

  const setMode = async (nextMode: AppMode) => {
    try {
      await appStorage.set(STORAGE_KEY, nextMode);
      setModeState(nextMode);
      setShowPicker(false);
    } catch (e) {
      console.error('Failed to save mode to storage', e);
    }
  };

  return (
    <ModeContext.Provider
      value={{ mode, loading, setMode, showPicker, setShowPicker }}
    >
      {children}
    </ModeContext.Provider>
  );
}
