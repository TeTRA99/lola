// No native module is registered in the test env, so requireOptionalNativeModule
// naturally returns null → volumeKeys falls back to a no-op (the same safety path
// an un-rebuilt dev client takes). No mock needed.

import { classifyVolumePress, INITIAL_DOUBLE_PRESS } from '../useVolumeTrigger';
import { subscribeVolumeKeys, isVolumeKeysAvailable } from '../volumeKeys';

describe('classifyVolumePress (pure double-press reducer)', () => {
  test('two Up presses within the window → describe (and resets)', () => {
    const first = classifyVolumePress(1000, 'up', INITIAL_DOUBLE_PRESS);
    expect(first.fired).toBeNull();
    const second = classifyVolumePress(1300, 'up', first.next);
    expect(second.fired).toBe('describe');
    expect(second.next).toEqual(INITIAL_DOUBLE_PRESS); // a 3rd press can't re-fire
  });

  test('two Down presses within the window → ask', () => {
    const first = classifyVolumePress(0, 'down', INITIAL_DOUBLE_PRESS);
    const second = classifyVolumePress(200, 'down', first.next);
    expect(second.fired).toBe('ask');
  });

  test('Up then Down → nothing (direction mismatch becomes a new first press)', () => {
    const first = classifyVolumePress(0, 'up', INITIAL_DOUBLE_PRESS);
    const second = classifyVolumePress(100, 'down', first.next);
    expect(second.fired).toBeNull();
    expect(second.next).toEqual({ lastDir: 'down', lastAt: 100 });
  });

  test('second press just past the window → no fire (new first press)', () => {
    const first = classifyVolumePress(0, 'up', INITIAL_DOUBLE_PRESS);
    const second = classifyVolumePress(401, 'up', first.next); // default window 400ms
    expect(second.fired).toBeNull();
    expect(second.next).toEqual({ lastDir: 'up', lastAt: 401 });
  });

  test('a single press fires nothing', () => {
    expect(classifyVolumePress(0, 'up', INITIAL_DOUBLE_PRESS).fired).toBeNull();
  });
});

describe('subscribeVolumeKeys (native module absent)', () => {
  test('reports unavailable and returns a safe no-op unsubscribe', () => {
    expect(isVolumeKeysAvailable()).toBe(false);
    const unsub = subscribeVolumeKeys(() => { throw new Error('should never be called'); });
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
  });
});
