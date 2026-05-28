// FR-5 Heartbeat haptic adapter.
// Library division (per E1.6 spec rev 2 AC1.6.3):
//   - one-shot patterns (looking, listening_*, answer_ready taps, error tail)
//     → expo-haptics impact/selection APIs
//   - rhythmic / multi-element patterns (thinking_start)
//     → setInterval driving expo-haptics impacts (baseline)
//     → escalate to react-native-haptic-feedback custom AHAP if AC1.6.5 fails

import * as Haptics from 'expo-haptics';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { CONFIG } from '@/config';

export type HapticPattern =
  | 'looking'
  | 'thinking_start'
  | 'thinking_stop'
  | 'answer_ready'
  | 'listening_start'
  | 'listening_stop'
  | 'error';

let thinkingTimer: ReturnType<typeof setInterval> | null = null;
let answerReadyTimer: ReturnType<typeof setTimeout> | null = null;

function clearThinking(): void {
  if (thinkingTimer) {
    clearInterval(thinkingTimer);
    thinkingTimer = null;
  }
}

function clearAnswerReadyDoubleTap(): void {
  if (answerReadyTimer) {
    clearTimeout(answerReadyTimer);
    answerReadyTimer = null;
  }
}

/** Test seam — clear any active timer so each test starts clean. */
export function _resetForTests(): void {
  clearThinking();
  clearAnswerReadyDoubleTap();
}

export function fire(pattern: HapticPattern): void {
  // Any non-thinking_start pattern cancels the rhythmic pulse.
  if (pattern !== 'thinking_start') clearThinking();

  switch (pattern) {
    case 'looking':
      // Single light tap, ~50ms perceived.
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;

    case 'listening_start':
    case 'listening_stop':
      // Soft selection tap — lighter than 'looking'.
      void Haptics.selectionAsync();
      return;

    case 'answer_ready': {
      // Double tap: HEARTBEAT_ANSWER_READY = [tap_ms, gap_ms, tap_ms].
      const [, gap] = CONFIG.HEARTBEAT_ANSWER_READY;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      clearAnswerReadyDoubleTap();
      answerReadyTimer = setTimeout(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        answerReadyTimer = null;
      }, gap);
      return;
    }

    case 'error':
      // Long soft pulse — closest expo-haptics primitive is notification warning;
      // for richer iOS rendering, react-native-haptic-feedback's notificationWarning
      // uses UINotificationFeedbackGenerator (system-coalesced ~600ms feel).
      ReactNativeHapticFeedback.trigger('notificationWarning', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      return;

    case 'thinking_start':
      // Initial tick immediate; then schedule repeating impacts. Medium impact
      // is meaningfully more perceptible on Android than Light — Charly couldn't
      // feel Light during testing on his Galaxy. B1 fix: explicit clearThinking
      // to guard against double-fire.
      clearThinking();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      thinkingTimer = setInterval(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }, CONFIG.HEARTBEAT_THINKING_ON_MS + CONFIG.HEARTBEAT_THINKING_OFF_MS);
      return;

    case 'thinking_stop':
      // already cleared above
      return;
  }
}

export function stop(): void {
  clearThinking();
  clearAnswerReadyDoubleTap();
}
