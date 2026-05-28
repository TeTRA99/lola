// FR-6.2 launch greeting + hidden gestures for SetupScreen (5s hold) and
// DebugScreen (10s hold). AC4.1.1–4.1.6.
//
// Auto-dismiss after 800ms unless the user is holding — held presses keep
// the splash visible past the auto-dismiss window. Release-triggered: the
// highest threshold crossed decides which screen to open.

import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Constants from 'expo-constants';
import { speak } from '@/adapters/tts';
import { COPY } from '@/services';
import { CONFIG } from '@/config';

const SPLASH_DURATION_MS = 3000;
// Native app version (from app.json) — only changes on a real APK rebuild.
const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
// JS bundle load time — updates on every hot reload so Charly can tell at a
// glance whether the latest dev push made it onto the phone.
const BUNDLE_LOADED_AT = new Date();
function pad(n: number): string { return n < 10 ? `0${n}` : `${n}`; }
const BUNDLE_STAMP = `${pad(BUNDLE_LOADED_AT.getHours())}:${pad(BUNDLE_LOADED_AT.getMinutes())}:${pad(BUNDLE_LOADED_AT.getSeconds())}`;

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

  // Greet + arm initial auto-dismiss once on mount. Refs to the callbacks let
  // the timer fire the latest closure without re-running this effect.
  const onDoneRef = useRef(onDone);
  const onSetupRef = useRef(onSetup);
  const onDebugRef = useRef(onDebug);
  onDoneRef.current = onDone;
  onSetupRef.current = onSetup;
  onDebugRef.current = onDebug;

  useEffect(() => {
    console.log('[splash] mount effect ran');
    if (!greeted.current) {
      greeted.current = true;
      void speak(COPY.greeting);
    }
    // Arm the initial auto-dismiss right at mount — no input needed.
    autoDismiss.current = setTimeout(() => {
      console.log('[splash] auto-dismiss timer fired, calling onDone');
      onDoneRef.current();
    }, SPLASH_DURATION_MS);
    return () => {
      console.log('[splash] mount effect CLEANUP running — unmounting');
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
        onDebugRef.current?.();
      } else if (reached === 'setup') {
        onSetupRef.current?.();
      } else if (!autoDismiss.current) {
        autoDismiss.current = setTimeout(() => onDoneRef.current(), SPLASH_DURATION_MS);
      }
    }
  }, [pressed]);

  return (
    <Pressable
      style={styles.root}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <Text style={styles.brand}>Lola</Text>
      <Text style={styles.build}>v{APP_VERSION} · bundle {BUNDLE_STAMP}</Text>
      <Pressable
        style={styles.gearBtn}
        onPress={() => {
          // Cancel the auto-dismiss before navigating away.
          if (autoDismiss.current) { clearTimeout(autoDismiss.current); autoDismiss.current = null; }
          onSetupRef.current?.();
        }}
        accessibilityLabel="Configuración"
      >
        <Text style={styles.gearIcon}>⚙</Text>
      </Pressable>
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
  build: {
    color: '#888',
    fontSize: 14,
    marginTop: 12,
    fontVariant: ['tabular-nums'],
  },
  gearBtn: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
  },
  gearIcon: { color: '#888', fontSize: 32 },
});
