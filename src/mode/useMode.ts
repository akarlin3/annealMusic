import { useContext } from 'react';
import { ModeContext, type ModeContextType } from './ModeContext';

export function useMode(): ModeContextType {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
}
