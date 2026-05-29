import { beforeEach, describe, expect, it } from 'vitest';
import { useParamStore } from '@/state/params';
import {
  doc,
  sculptParamsMap,
  engineIdText,
  initializeCrdtSync,
  setApplyingRemote,
} from './crdt';

describe('Zustand - CRDT synchronization', () => {
  beforeEach(() => {
    // Reset Zustand store state
    useParamStore.getState().reset();

    // Clear Yjs document maps and text
    doc.transact(() => {
      sculptParamsMap.clear();
      engineIdText.delete(0, engineIdText.length);
    });

    setApplyingRemote(false);
  });

  it('seals default parameter values in Yjs on initialization', () => {
    initializeCrdtSync();

    // Verify initial values seeded in Yjs Map
    expect(sculptParamsMap.get('rootFreq')).toBe(110);
    expect(sculptParamsMap.get('spread')).toBe(1.0);
    expect(sculptParamsMap.get('density')).toBe(6);
    expect(engineIdText.toString()).toBe('sine');
  });

  it('propagates Zustand parameter updates to the Yjs document', () => {
    initializeCrdtSync();

    // Change parameter locally in Zustand store
    useParamStore.getState().setParam('spread', 1.25);
    expect(sculptParamsMap.get('spread')).toBe(1.25);

    useParamStore.getState().setEngine('physical');
    expect(engineIdText.toString()).toBe('physical');
  });

  it('ingests remote Yjs CRDT changes into the Zustand store', () => {
    initializeCrdtSync();

    // Simulate a remote peer transaction updating the Yjs Map
    doc.transact(() => {
      sculptParamsMap.set('brightness', 0.85);
      sculptParamsMap.set('space', 0.99);

      engineIdText.delete(0, engineIdText.length);
      engineIdText.insert(0, 'granular');
    });

    // Verify the Zustand store has successfully absorbed the remote values
    expect(useParamStore.getState().params.brightness).toBe(0.85);
    expect(useParamStore.getState().params.space).toBe(0.99);
    expect(useParamStore.getState().engineId).toBe('granular');
  });

  it('correctly clamps out-of-bounds remote parameters during ingestion', () => {
    initializeCrdtSync();

    // Simulate an out-of-bounds update from a peer
    doc.transact(() => {
      sculptParamsMap.set('rootFreq', 9999); // max is 4200
      sculptParamsMap.set('volume', -5); // min is 0
    });

    // Assert that the local Zustand store safely clamps these incoming changes
    expect(useParamStore.getState().params.rootFreq).toBe(4200);
    expect(useParamStore.getState().params.volume).toBe(0);
  });
});
