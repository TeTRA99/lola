// Haptic adapter — STUB. E1.6 implements the real FR-5 patterns.
// This stub lets E2.2 DescribeService and E3.2 AskService land without
// blocking on E1.6. Signature locked per E1.6 spec; E1.6 replaces bodies.

export type HapticPattern =
  | 'looking'
  | 'thinking_start'
  | 'thinking_stop'
  | 'answer_ready'
  | 'listening_start'
  | 'listening_stop'
  | 'error';

export function fire(_pattern: HapticPattern): void {
  // TODO(E1.6): real implementation via expo-haptics + react-native-haptic-feedback.
  // For now: silent no-op so the service-layer wiring is testable.
}

export function stop(): void {
  // TODO(E1.6): cancel any running rhythmic pulse.
}
