/* eslint-disable @typescript-eslint/no-explicit-any */
import { BridgeError } from './types';

export const BRIDGE_VERSION = '1.0';
export const SCHEMA_VERSION = 'v20';

export interface MethodDef {
  name: string;
  description: string;
  validate?: (params: any) => void;
}

export const METHOD_SCHEMAS: Record<string, MethodDef> = {
  'anneal.state.get': {
    name: 'anneal.state.get',
    description:
      'Returns the full parameter store state, active engine, and tuning parameters.',
  },
  'anneal.state.subscribe': {
    name: 'anneal.state.subscribe',
    description: 'Subscribe to changes on specific state keys.',
    validate: (params) => {
      if (!params || !Array.isArray(params.keys)) {
        throw new BridgeError(
          -32602,
          'Invalid params: keys must be an array of strings',
        );
      }
      const allowed = ['params', 'engineId', 'tuning', 'mode', 'engineParams'];
      for (const k of params.keys) {
        if (!allowed.includes(k)) {
          throw new BridgeError(
            -32602,
            `Invalid params: key "${k}" is not allowed`,
          );
        }
      }
    },
  },
  'anneal.state.unsubscribe': {
    name: 'anneal.state.unsubscribe',
    description: 'Unsubscribe from state changes.',
    validate: (params) => {
      if (!params || typeof params.subscriptionId !== 'string') {
        throw new BridgeError(
          -32602,
          'Invalid params: subscriptionId must be a string',
        );
      }
    },
  },
  'anneal.engine.getSpectrum': {
    name: 'anneal.engine.getSpectrum',
    description:
      'Retrieves the latest FFT spectrum frame (uint8 array representation).',
  },
  'anneal.engine.getPartials': {
    name: 'anneal.engine.getPartials',
    description: 'Retrieves the emergent coupled partials state [{freq, amp}].',
  },
  'anneal.state.set': {
    name: 'anneal.state.set',
    description: 'Patches the core parameters.',
    validate: (params) => {
      if (!params || typeof params.params !== 'object') {
        throw new BridgeError(
          -32602,
          'Invalid params: params object must be provided',
        );
      }
    },
  },
  'anneal.state.setEngineParam': {
    name: 'anneal.state.setEngineParam',
    description: 'Updates a specific engine parameter.',
    validate: (params) => {
      if (
        !params ||
        typeof params.engineId !== 'string' ||
        typeof params.key !== 'string' ||
        params.value === undefined
      ) {
        throw new BridgeError(
          -32602,
          'Invalid params: engineId, key, and value must be provided',
        );
      }
    },
  },
  'anneal.state.setEngine': {
    name: 'anneal.state.setEngine',
    description: 'Swaps the active synthesis engine.',
    validate: (params) => {
      if (!params || typeof params.engineId !== 'string') {
        throw new BridgeError(
          -32602,
          'Invalid params: engineId must be a string',
        );
      }
    },
  },
  'anneal.state.setTuning': {
    name: 'anneal.state.setTuning',
    description: 'Updates the reference tuning system.',
    validate: (params) => {
      if (!params || typeof params.tuning !== 'object') {
        throw new BridgeError(
          -32602,
          'Invalid params: tuning object must be provided',
        );
      }
      if (
        typeof params.tuning.system !== 'string' ||
        typeof params.tuning.referenceA4Hz !== 'number'
      ) {
        throw new BridgeError(
          -32602,
          'Invalid params: tuning system must be a string and referenceA4Hz a number',
        );
      }
    },
  },
  'anneal.session.start': {
    name: 'anneal.session.start',
    description:
      'Starts the active listening session or standalone meditation timer.',
  },
  'anneal.session.stop': {
    name: 'anneal.session.stop',
    description:
      'Stops the active listening session or standalone meditation timer.',
  },
  'anneal.session.status': {
    name: 'anneal.session.status',
    description:
      'Returns the current session state, elapsed and remaining time.',
  },
  'anneal.session.loadPatch': {
    name: 'anneal.session.loadPatch',
    description: 'Hydrates active param state with a complete pre-saved patch.',
    validate: (params) => {
      if (!params || typeof params.patch !== 'object') {
        throw new BridgeError(
          -32602,
          'Invalid params: patch object must be provided',
        );
      }
    },
  },
  'anneal.session.loadPiece': {
    name: 'anneal.session.loadPiece',
    description: 'Loads an arrangement piece.',
    validate: (params) => {
      if (!params || typeof params.piece !== 'object') {
        throw new BridgeError(
          -32602,
          'Invalid params: piece object must be provided',
        );
      }
    },
  },
  'anneal.version': {
    name: 'anneal.version',
    description: 'Returns app, bridge, and schema versions.',
  },
  'anneal.health': {
    name: 'anneal.health',
    description: 'Liveness check.',
  },
  'anneal.datalog.start': {
    name: 'anneal.datalog.start',
    description: 'Starts the session datalogger.',
    validate: (params) => {
      if (params && params.mode !== undefined) {
        const allowed = ['lightweight', 'standard', 'full', 'research-extreme'];
        if (!allowed.includes(params.mode)) {
          throw new BridgeError(
            -32602,
            `Invalid params: mode must be one of ${allowed.join(', ')}`,
          );
        }
      }
      if (params && params.rateHz !== undefined) {
        if (typeof params.rateHz !== 'number' || params.rateHz <= 0) {
          throw new BridgeError(
            -32602,
            'Invalid params: rateHz must be a positive number',
          );
        }
      }
    },
  },
  'anneal.datalog.stop': {
    name: 'anneal.datalog.stop',
    description: 'Stops the session datalogger.',
  },
  'anneal.datalog.snapshot': {
    name: 'anneal.datalog.snapshot',
    description:
      'Retrieves a snapshot of the latest N ticks from the ring buffer.',
    validate: (params) => {
      if (params && params.limit !== undefined) {
        if (typeof params.limit !== 'number' || params.limit <= 0) {
          throw new BridgeError(
            -32602,
            'Invalid params: limit must be a positive integer',
          );
        }
      }
    },
  },
  'anneal.datalog.stream': {
    name: 'anneal.datalog.stream',
    description:
      'Subscribes to real-time session datalogger tick notifications.',
  },
};
