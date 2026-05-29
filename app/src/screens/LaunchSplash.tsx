// FR-6.2 launch greeting. Brand moment on the ink surface: floating lens mark,
// "Lola" wordmark, greeting, and a caregiver legend pointing to the OS app-icon
// Setup shortcut (handoff §1).
//
// The visible UI carries NO settings affordance (locked decision #3). Setup is
// reached only through the OS app-icon "Configuración" shortcut. The splash
// keeps a single invisible escape hatch for the developer: a 10-second hold
// opens the Debug screen (nothing on screen hints at it).
//
// Auto-dismiss after the splash window unless the user is holding; a held press
// past the debug threshold opens Debug on release.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { LolaMark } from '@/components/LolaMark';
import { Icon } from '@/components/Icon';
import { speak } from '@/adapters/tts';
import { COPY } from '@/services';
import { CONFIG } from '@/config';
import { color, fontFamily } from '@/theme/tokens';

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
  onDebug?: () => void;
};

export function LaunchSplash({ onDone, onDebug }: Props) {
  const [pressed, setPressed] = useState(false);
  const float = useRef(new Animated.Value(0)).current;

  const autoDismiss = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reachedDebug = useRef(false);
  const greeted = useRef(false);

  // Refs to the callbacks let the timer fire the latest closure without
  // re-running the mount effect.
  const onDoneRef = useRef(onDone);
  const onDebugRef = useRef(onDebug);
  onDoneRef.current = onDone;
  onDebugRef.current = onDebug;

  useEffect(() => {
    if (!greeted.current) {
      greeted.current = true;
      void speak(COPY.greeting);
    }
    // Gentle float loop on the mark (translateY 0 → -7 → 0, 3600ms).
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -7, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    // Arm the initial auto-dismiss right at mount — no input needed.
    autoDismiss.current = setTimeout(() => onDoneRef.current(), SPLASH_DURATION_MS);
    return () => {
      loop.stop();
      [autoDismiss, debugTimer].forEach(t => {
        if (t.current) clearTimeout(t.current);
        t.current = null;
      });
    };
  }, [float]);

  useEffect(() => {
    if (pressed) {
      // Hold cancels auto-dismiss; crossing the debug threshold arms Debug.
      if (autoDismiss.current) { clearTimeout(autoDismiss.current); autoDismiss.current = null; }
      reachedDebug.current = false;
      debugTimer.current = setTimeout(() => {
        reachedDebug.current = true;
      }, CONFIG.DEBUG_GESTURE_HOLD_MS);
    } else {
      if (debugTimer.current) { clearTimeout(debugTimer.current); debugTimer.current = null; }
      const wasDebug = reachedDebug.current;
      reachedDebug.current = false;

      if (wasDebug) {
        onDebugRef.current?.();
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
      <Text style={styles.build}>v{APP_VERSION} · bundle {BUNDLE_STAMP}</Text>

      <View style={styles.center}>
        <Animated.View style={{ transform: [{ translateY: float }] }}>
          <LolaMark size={92} />
        </Animated.View>
        <Text style={styles.wordmark}>Lola</Text>
        <Text style={styles.greeting}>{COPY.splash.hello}</Text>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <Icon name="settings" size={15} color="rgba(255,255,255,0.62)" />
          <Text style={styles.legendTitle}>{COPY.splash.settings}</Text>
        </View>
        <Text style={styles.legendHint}>{COPY.splash.settingsHint}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.neutral.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  build: {
    position: 'absolute',
    top: 52,
    color: 'rgba(255,255,255,0.22)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
    fontVariant: ['tabular-nums'],
  },
  center: { alignItems: 'center' },
  wordmark: {
    color: '#fff',
    fontSize: 46,
    fontFamily: fontFamily.extrabold,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 30,
  },
  greeting: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 19,
    fontFamily: fontFamily.regular,
    marginTop: 12,
  },
  legend: {
    position: 'absolute',
    bottom: 28,
    left: 24,
    right: 24,
    alignItems: 'center',
    gap: 3,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendTitle: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13.5,
    fontFamily: fontFamily.bold,
    fontWeight: '700',
  },
  legendHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12.5,
    fontFamily: fontFamily.medium,
    textAlign: 'center',
    lineHeight: 17,
  },
});
