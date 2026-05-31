import type { AppMode } from './types';

export interface ModeAffordances {
  defaultLanding: string;
  creativeSubModes: ('sketch' | 'drone')[];
  defaultSubMode: 'sketch' | 'drone';
  showGallery: boolean;
  showTimeline: boolean;
  showLoopPedal: boolean;
  showMIDI: boolean;
  showCollab: boolean;
  showAIGeneration: boolean;
  showResearch: boolean;
  showCuratedLibrary: boolean;
}

export const MODE_VISIBILITY: Record<AppMode, ModeAffordances> = {
  meditation: {
    defaultLanding: '/listen',
    creativeSubModes: ['drone'],
    defaultSubMode: 'drone',
    showGallery: false,
    showTimeline: false,
    showLoopPedal: false,
    showMIDI: false,
    showCollab: false,
    showAIGeneration: false,
    showResearch: false,
    showCuratedLibrary: true,
  },
  musician: {
    defaultLanding: '/',
    creativeSubModes: ['sketch', 'drone'],
    defaultSubMode: 'sketch',
    showGallery: true,
    showTimeline: true,
    showLoopPedal: true,
    showMIDI: true,
    showCollab: true,
    showAIGeneration: true,
    showResearch: false,
    showCuratedLibrary: false,
  },
  researcher: {
    defaultLanding: '/research.html',
    creativeSubModes: ['sketch', 'drone'],
    defaultSubMode: 'sketch',
    showGallery: false,
    showTimeline: false,
    showLoopPedal: false,
    showMIDI: false,
    showCollab: false,
    showAIGeneration: false,
    showResearch: true,
    showCuratedLibrary: false,
  },
};
