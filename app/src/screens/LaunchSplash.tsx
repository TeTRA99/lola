// FR-6.2 launch greeting + hidden gestures for SetupScreen (5s hold) and
// DebugScreen (10s hold). AC4.1.1–4.1.6.
//
// Auto-dismiss after 800ms unless the user is holding — held presses keep
// the splash visible past the auto-dismiss window. Release-triggered: the
// highest threshold crossed decides which screen to open.

import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { speak } from '@/adapters/tts';
import { COPY } from '@/services';
import { CONFIG } from '@/config';

const SPLASH_DURATION_MS = 800;

type Props = {
  onDone: () => void;
  onSetup?: () => void;
  onDebug?: () => void;
};

type GestureStage = 'none' | 'setup' | 'debug';

export function LaunchSplash({ onDone, onSetup, onDebug }: Props) {
  const [pressed, setPressed] = useState(false);

  const autoDismiss = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stage = useRef<GestureStage>('none');
  const greeted = useRef(false);

  // Greet once on mount.
  useEffect(() => {
    if (!greeted.current) {
      greeted.current = true;
      void speak(COPY.greeting);
    }
    return () => {
      [autoDismiss, setupTimer, debugTimer].forEach(t => {
        if (t.current) clearTimeout(t.current);
        t.current = null;
      });
    };
  }, []);

  useEffect(() => {
    if (pressed) {
      // Hold detected — cancel any pending auto-dismiss so the splash stays.
      if (autoDismiss.current) { clearTimeout(autoDismiss.current); autoDismiss.current = null; }
      stage.current = 'none';
      setupTimer.current = setTimeout(() => {
        if (stage.current === 'none') stage.current = 'setup';
      }, CONFIG.SETUP_GESTURE_HOLD_MS);
      debugTimer.current = setTimeout(() => {
        stage.current = 'debug';
      }, CONFIG.DEBUG_GESTURE_HOLD_MS);
    } else {
      // Released — clean up timers and fire the appropriate callback.
      if (setupTimer.current) { clearTimeout(setupTimer.current); setupTimer.current = null; }
      if (debugTimer.current) { clearTimeout(debugTimer.current); debugTimer.current = null; }
      const reached = stage.current;
      stage.current = 'none';

      if (reached === 'debug') {
        onDebug?.();
      } else if (reached === 'setup') {
        onSetup?.();
      } else if (!autoDismiss.current) {
        autoDismiss.current = setTimeout(onDone, SPLASH_DURATION_MS);
      }
    }
  }, [pressed, onSetup, onDebug, onDone]);

  return (
    <Pressable
      style={styles.root}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <Text style={styles.brand}>Lola</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: '#fff',
    fontSize: 80,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
