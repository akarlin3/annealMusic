/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ParamKey } from '@/state/params';
import type { EngineId } from '@/audio/engines/types';

export interface OscMessage {
  address: string;
  args: any[];
}

// Maps ParamKey to their expected value types
export const OSC_PARAM_TYPES: Record<ParamKey, 'f' | 'i'> = {
  rootFreq: 'f',
  spread: 'f',
  density: 'i',
  coupling: 'f',
  drift: 'f',
  brightness: 'f',
  space: 'f',
  volume: 'f',
};

/**
 * Bidirectional mapper for OSC Addresses
 */
export class OSCNamespace {
  /**
   * Translates a parameter state update to a list of OSC messages
   */
  static stateToOsc(key: string, value: any): OscMessage[] {
    const messages: OscMessage[] = [];

    if (key === 'params') {
      // Core params mapping
      Object.entries(value).forEach(([paramKey, paramVal]) => {
        if (paramKey in OSC_PARAM_TYPES) {
          messages.push({
            address: `/anneal/state/${paramKey}`,
            args: [Number(paramVal)],
          });
        }
      });
    } else if (key === 'engineId') {
      messages.push({
        address: '/anneal/state/engine',
        args: [String(value)],
      });
    } else if (key === 'mode') {
      messages.push({
        address: '/anneal/state/mode',
        args: [String(value)],
      });
    } else if (key === 'engineParams') {
      // Maps engine params: engineParams[engineId][paramKey]
      Object.entries(value).forEach(([engineId, paramsBag]: [string, any]) => {
        if (paramsBag && typeof paramsBag === 'object') {
          Object.entries(paramsBag).forEach(([paramKey, paramVal]) => {
            messages.push({
              address: `/anneal/state/engine_params/${engineId}/${paramKey}`,
              args: [
                typeof paramVal === 'string' ? paramVal : Number(paramVal),
              ],
            });
          });
        }
      });
    }

    return messages;
  }

  /**
   * Parses an incoming control OSC message and maps it to a state mutation patch or method call
   */
  static oscToControl(msg: OscMessage): {
    type: 'param' | 'engine' | 'engineParam' | 'session' | 'unknown';
    key?: string;
    value?: any;
    engineId?: string;
    action?: 'start' | 'stop';
  } {
    const { address, args } = msg;

    // Check core control parameters: /anneal/control/<param>
    const coreMatch = address.match(/^\/anneal\/control\/([a-zA-Z0-9]+)$/);
    if (coreMatch) {
      const key = coreMatch[1];
      if (key) {
        if (key === 'engine') {
          return {
            type: 'engine',
            value: args[0] !== undefined ? String(args[0]) : '',
          };
        }
        if (key in OSC_PARAM_TYPES) {
          const val = args[0] !== undefined ? Number(args[0]) : 0;
          return {
            type: 'param',
            key,
            value: key === 'density' ? Math.round(val) : val,
          };
        }
      }
    }

    // Check engine-specific control parameters: /anneal/control/engine_params/<engine>/<param>
    const engineMatch = address.match(
      /^\/anneal\/control\/engine_params\/([a-zA-Z0-9_]+)\/([a-zA-Z0-9_]+)$/,
    );
    if (engineMatch) {
      const engineId = engineMatch[1] as EngineId;
      const paramKey = engineMatch[2];
      const rawVal = args[0];
      const value = typeof rawVal === 'string' ? rawVal : Number(rawVal ?? 0);
      return { type: 'engineParam', engineId, key: paramKey, value };
    }

    // Check session lifecycle: /anneal/control/session/start and stop
    if (address === '/anneal/control/session/start') {
      return { type: 'session', action: 'start' };
    }
    if (address === '/anneal/control/session/stop') {
      return { type: 'session', action: 'stop' };
    }

    return { type: 'unknown' };
  }
}
