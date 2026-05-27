// Mock both haptic libs at module load.

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
}));

jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: { trigger: jest.fn() },
}));

import * as Haptics from 'expo-haptics';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { fire, stop, _resetForTests } from '../haptics';

const mImpact = Haptics.impactAsync as jest.MockedFunction<typeof Haptics.impactAsync>;
const mSelection = Haptics.selectionAsync as jest.MockedFunction<typeof Haptics.selectionAsync>;
const mTrigger = ReactNativeHapticFeedback.trigger as jest.MockedFunction<
  typeof ReactNativeHapticFeedback.trigger
>;

beforeEach(() => {
  jest.clearAllMocks();
  _resetForTests();
});

afterEach(() => {
  // Make sure no timers leak between tests.
  _resetForTests();
});

describe('haptics adapter — one-shot patterns', () => {
  test('looking → single Light impact', () => {
    fire('looking');
    expect(mImpact).toHaveBeenCalledWith('Light');
    expect(mImpact).toHaveBeenCalledTimes(1);
  });

  test('listening_start → selectionAsync', () => {
    fire('listening_start');
    expect(mSelection).toHaveBeenCalledTimes(1);
  });

  test('listening_stop → selectionAsync', () => {
    fire('listening_stop');
    expect(mSelection).toHaveBeenCalledTimes(1);
  });

  test('error → notificationWarning via react-native-haptic-feedback', () => {
    fire('error');
    expect(mTrigger).toHaveBeenCalledWith(
      'notificationWarning',
      expect.objectContaining({ enableVibrateFallback: true }),
    );
  });
});

describe('haptics adapter — answer_ready double tap', () => {
  test('fires first impact immediately, second after gap', async () => {
    jest.useFakeTimers();
    fire('answer_ready');
    expect(mImpact).toHaveBeenCalledTimes(1);
    expect(mImpact).toHaveBeenLastCalledWith('Medium');

    jest.advanceTimersByTime(150);  // gap_ms from CONFIG.HEARTBEAT_ANSWER_READY = [50, 100, 50]
    expect(mImpact).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});

describe('haptics adapter — thinking rhythmic pulse', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('thinking_start fires immediate impact + scheduled repeats', () => {
    fire('thinking_start');
    expect(mImpact).toHaveBeenCalledTimes(1);

    // Period = HEARTBEAT_THINKING_ON_MS (200) + HEARTBEAT_THINKING_OFF_MS (400) = 600ms.
    jest.advanceTimersByTime(600);
    expect(mImpact).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(600);
    expect(mImpact).toHaveBeenCalledTimes(3);
  });

  test('thinking_stop halts the rhythmic timer', () => {
    fire('thinking_start');
    jest.advanceTimersByTime(600);
    expect(mImpact).toHaveBeenCalledTimes(2);

    fire('thinking_stop');
    jest.advanceTimersByTime(2000);
    expect(mImpact).toHaveBeenCalledTimes(2);  // no further ticks
  });

  test('any non-thinking_start pattern cancels the rhythmic pulse', () => {
    fire('thinking_start');
    jest.advanceTimersByTime(600);  // 2 impacts
    fire('looking');                 // should cancel + fire one more impact
    expect(mImpact).toHaveBeenCalledTimes(3);
    jest.advanceTimersByTime(2000);
    expect(mImpact).toHaveBeenCalledTimes(3);  // no further ticks
  });

  test('stop() halts both thinking + answer_ready timers', () => {
    fire('thinking_start');
    fire('answer_ready');  // also schedules a timer
    stop();
    jest.advanceTimersByTime(2000);
    // Only the initial impacts fired (thinking_start initial + answer_ready first tap).
    // Total = 2; no further activity.
    expect(mImpact).toHaveBeenCalledTimes(2);
  });

  // B1 regression — double-fire thinking_start must NOT leak a parallel interval.
  test('double thinking_start does not stack two intervals', () => {
    fire('thinking_start');  // initial impact #1
    jest.advanceTimersByTime(600);  // tick → impact #2
    fire('thinking_start');  // re-fire: clears prev, fires initial impact #3
    jest.advanceTimersByTime(600);  // single tick → impact #4 (not #4 AND #5)
    expect(mImpact).toHaveBeenCalledTimes(4);
    jest.advanceTimersByTime(600);
    expect(mImpact).toHaveBeenCalledTimes(5);  // still one tick per period
  });
});
