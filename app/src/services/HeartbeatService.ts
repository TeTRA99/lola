// FR-5 Heartbeat state machine — drives the HapticAdapter via state transitions.
// Filled in alongside E2.2 / E3.2 (state machine wiring); haptic primitives in E1.6.

export type HeartbeatState =
  | 'idle'
  | 'looking'
  | 'listening'
  | 'thinking'
  | 'answer_ready'
  | 'speaking'
  | 'error';

export function transition(_to: HeartbeatState): void {
  throw new Error('not_implemented');
}

export function getState(): HeartbeatState {
  throw new Error('not_implemented');
}
