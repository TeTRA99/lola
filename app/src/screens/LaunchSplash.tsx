// FR-6.2 launch greeting. Brand moment on the ink surface: floating lens mark,
// "Lola" wordmark, and greeting. Auto-dismisses to Home after the splash window.
//
// Setup is reached from the gear on Dad's Home (and the OS app-icon shortcut),
// and the Debug screen is reached from a dev-only icon on Home (debug builds),
// so the splash no longer carries any hidden gesture.

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LolaMark } from '@/components/LolaMark';
import { speak } from '@/adapters/tts';
import { COPY } from '@/services';
import * as Settings from '@/services/Settings';
import { color, fontFamily } from '@/theme/tokens';

const SPLASH_DURATION_MS = 3000;

type Props = {
  onDone: () => void;
};

export function LaunchSplash({ onDone }: Props) {
  const float = useRef(new Animated.Value(0)).current;
  const autoDismiss = useRef<ReturnType<typeof setTimeout> | null>(null);
  const greeted = useRef(false);

  // A ref to the callback lets the timer fire the latest closure without
  // re-running the mount effect.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!greeted.current) {
      greeted.current = true;
      // Personalize with the caregiver-set name ("Hola, Carlos, …") if present.
      void Settings.getString(Settings.KEYS.userName, '').then(name => speak(COPY.greetingFor(name)));
    }
    // Gentle float loop on the mark (translateY 0 → -7 → 0, 3600ms).
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -7, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    autoDismiss.current = setTimeout(() => onDoneRef.current(), SPLASH_DURATION_MS);
    return () => {
      loop.stop();
      if (autoDismiss.current) { clearTimeout(autoDismiss.current); autoDismiss.current = null; }
    };
  }, [float]);

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <Animated.View style={{ transform: [{ translateY: float }] }}>
          <LolaMark size={92} />
        </Animated.View>
        <Text style={styles.wordmark}>Lola</Text>
        <Text style={styles.greeting}>{COPY.splash.hello}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.neutral.ink,
    alignItems: 'center',
    justifyContent: 'center',
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
});
