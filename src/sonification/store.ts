import { create } from 'zustand';
import type {
  MappingSpec,
  SonificationState,
  SourceDef,
  MappingRule,
} from './types';
import { SonificationPlayer } from './SonificationPlayer';
import type { Orchestrator } from '@/audio/orchestrator';

interface SonificationStore {
  activeId: string | null;
  title: string;
  description: string;
  mappingSpec: MappingSpec;
  durationMs: number;
  playbackSpeed: number;
  loop: boolean;

  isPlaying: boolean;
  elapsedSec: number;
  player: SonificationPlayer | null;

  // Active connection to the audio engine orchestrator
  orchestrator: Orchestrator | null;

  setOrchestrator: (orch: Orchestrator | null) => void;
  loadSonification: (config: SonificationState) => void;
  unloadSonification: () => void;

  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  setSpeed: (speed: number) => void;
  setLoop: (loop: boolean) => void;
  setDurationMs: (ms: number) => void;

  addSource: (src: SourceDef) => void;
  removeSource: (sourceId: string) => void;
  addRule: (rule: MappingRule) => void;
  removeRule: (index: number) => void;
  updateRule: (index: number, rule: Partial<MappingRule>) => void;
}

const DEFAULT_SPEC: MappingSpec = {
  sources: [],
  rules: [],
};

export const useSonificationStore = create<SonificationStore>((set, get) => ({
  activeId: null,
  title: 'New Sonification',
  description: '',
  mappingSpec: DEFAULT_SPEC,
  durationMs: 10000,
  playbackSpeed: 1.0,
  loop: true,
  isPlaying: false,
  elapsedSec: 0,
  player: null,
  orchestrator: null,

  setOrchestrator: (orch) => {
    set({ orchestrator: orch });
  },

  loadSonification: (config) => {
    const { player } = get();
    if (player) {
      player.destroy();
    }

    const duration = config.durationMs || 10000;
    const speed = config.playbackSpeed || 1.0;
    const loop = config.loop !== undefined ? config.loop : true;

    const newPlayer = new SonificationPlayer(
      config.mappingSpec,
      duration,
      speed,
      loop,
    );

    set({
      activeId: config.id || null,
      title: config.title || 'New Sonification',
      description: config.description || '',
      mappingSpec: config.mappingSpec,
      durationMs: duration,
      playbackSpeed: speed,
      loop,
      player: newPlayer,
      isPlaying: false,
      elapsedSec: 0,
    });
  },

  unloadSonification: () => {
    const { player } = get();
    if (player) {
      player.destroy();
    }
    set({
      activeId: null,
      title: 'New Sonification',
      description: '',
      mappingSpec: DEFAULT_SPEC,
      durationMs: 10000,
      playbackSpeed: 1.0,
      loop: true,
      isPlaying: false,
      elapsedSec: 0,
      player: null,
    });
  },

  play: () => {
    const { player, orchestrator, isPlaying } = get();
    if (!player || isPlaying) return;

    player.start(orchestrator, (elapsed) => {
      set({ elapsedSec: elapsed });
    });

    set({ isPlaying: true });
  },

  pause: () => {
    const { player, isPlaying } = get();
    if (!player || !isPlaying) return;

    player.stop();
    set({ isPlaying: false });
  },

  seek: (t) => {
    const { player, orchestrator } = get();
    if (!player) return;

    player.seek(t, orchestrator);
    set({ elapsedSec: player.getElapsed() });
  },

  setSpeed: (speed) => {
    const { player } = get();
    const clamped = Math.max(0.1, Math.min(5.0, speed));
    if (player) {
      player.playbackSpeed = clamped;
    }
    set({ playbackSpeed: clamped });
  },

  setLoop: (loop) => {
    const { player } = get();
    if (player) {
      player.loop = loop;
    }
    set({ loop });
  },

  setDurationMs: (ms) => {
    const { player } = get();
    const duration = Math.max(1000, ms);
    if (player) {
      player.durationSec = duration / 1000;
    }
    set({ durationMs: duration });
  },

  addSource: (src) => {
    const state = get();
    const nextSources = [...state.mappingSpec.sources, src];
    const nextSpec = { ...state.mappingSpec, sources: nextSources };

    set({ mappingSpec: nextSpec });
    if (state.player) {
      state.loadSonification({
        id: state.activeId || undefined,
        title: state.title,
        description: state.description,
        mappingSpec: nextSpec,
        durationMs: state.durationMs,
        playbackSpeed: state.playbackSpeed,
        loop: state.loop,
      });
    }
  },

  removeSource: (sourceId) => {
    const state = get();
    const nextSources = state.mappingSpec.sources.filter(
      (s) => s.id !== sourceId,
    );
    const nextRules = state.mappingSpec.rules.filter(
      (r) => r.sourceId !== sourceId,
    );
    const nextSpec = { sources: nextSources, rules: nextRules };

    set({ mappingSpec: nextSpec });
    if (state.player) {
      state.loadSonification({
        id: state.activeId || undefined,
        title: state.title,
        description: state.description,
        mappingSpec: nextSpec,
        durationMs: state.durationMs,
        playbackSpeed: state.playbackSpeed,
        loop: state.loop,
      });
    }
  },

  addRule: (rule) => {
    const state = get();
    const nextRules = [...state.mappingSpec.rules, rule];
    const nextSpec = { ...state.mappingSpec, rules: nextRules };

    set({ mappingSpec: nextSpec });
    if (state.player) {
      state.loadSonification({
        id: state.activeId || undefined,
        title: state.title,
        description: state.description,
        mappingSpec: nextSpec,
        durationMs: state.durationMs,
        playbackSpeed: state.playbackSpeed,
        loop: state.loop,
      });
    }
  },

  removeRule: (index) => {
    const state = get();
    const nextRules = state.mappingSpec.rules.filter((_, i) => i !== index);
    const nextSpec = { ...state.mappingSpec, rules: nextRules };

    set({ mappingSpec: nextSpec });
    if (state.player) {
      state.loadSonification({
        id: state.activeId || undefined,
        title: state.title,
        description: state.description,
        mappingSpec: nextSpec,
        durationMs: state.durationMs,
        playbackSpeed: state.playbackSpeed,
        loop: state.loop,
      });
    }
  },

  updateRule: (index, partial) => {
    const state = get();
    const nextRules = state.mappingSpec.rules.map((r, i) =>
      i === index ? { ...r, ...partial } : r,
    );
    const nextSpec = { ...state.mappingSpec, rules: nextRules };

    set({ mappingSpec: nextSpec });
    if (state.player) {
      state.loadSonification({
        id: state.activeId || undefined,
        title: state.title,
        description: state.description,
        mappingSpec: nextSpec,
        durationMs: state.durationMs,
        playbackSpeed: state.playbackSpeed,
        loop: state.loop,
      });
    }
  },
}));
