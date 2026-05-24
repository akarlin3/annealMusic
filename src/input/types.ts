/** Public types for the live-input voice (mic / line-in / audio interface). */

/** A selectable audio input device. `label` is empty until permission is granted. */
export interface InputDevice {
  deviceId: string;
  label: string;
}

/** UI-facing connection state for the input panel. */
export type InputState =
  | 'idle'
  | 'prompting'
  | 'connected'
  | 'denied'
  | 'error';

/** Typed permission/connection failure kinds (mapped from `DOMException.name`). */
export type InputErrorKind =
  | 'denied'
  | 'notfound'
  | 'unreadable'
  | 'unsupported'
  | 'unknown';

/** A typed error for the input path — never a bare throw (errors are typed). */
export class InputError extends Error {
  readonly kind: InputErrorKind;

  constructor(kind: InputErrorKind, message: string) {
    super(message);
    this.name = 'InputError';
    this.kind = kind;
  }
}

/** Result of a successful connect: the device label + estimated input latency. */
export interface ConnectResult {
  deviceLabel: string;
  latencyMs: number;
}

/** Events the `InputVoice` emits for device-change / loss / error recovery. */
export type InputVoiceEvent =
  | { type: 'device-changed'; deviceLabel: string }
  | { type: 'disconnected'; reason: 'device-lost' | 'manual' }
  | { type: 'error'; error: InputError };
