// First-run welcome (item #6). A one-time, voice-first interstitial shown over
// Home the first launch only. Lola speaks the orientation (Describir / Preguntar
// + a gentle "ask someone to help you set up" nudge) and the screen dismisses
// either on tap or on its own when the speech finishes — whichever comes first.
//
// Voice-first so it works for a blind user; the big on-screen text + soft pulse
// give a low-vision user something to see. The splash already greeted, so this
// continues rather than saying hello again.

import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';
import { LolaMark } from '@/components/LolaMark';
import { speak, stop as ttsStop } from '@/adapters/tts';
import { COPY } from '@/services';
import { color, fontFamily } from '@/theme/tokens';

// Safety net: dismiss even if TTS never resolves (no voice installed, etc.).
const MAX_VISIBLE_MS = 30000;

export function WelcomeOverlay({ onDismiss }: { onDismiss: () => void }) {
  const pulse = useRef(new Animated.Value(0)).current;
  // Guard so tap and speech-end (and the fallback timer) can't double-fire.
  const doneRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      ttsStop();
      onDismissRef.current();
    };

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();

    // Queues after the splash greeting; resolves when Lola finishes speaking.
    void speak(COPY.onboarding.welcome).then(finish);
    const fallback = setTimeout(finish, MAX_VISIBLE_MS);

    return () => { loop.stop(); clearTimeout(fallback); };
  }, [pulse]);

  const handleTap = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    ttsStop();
    onDismissRef.current();
  };

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <Pressable
      style={styles.root}
      onPress={handleTap}
      accessibilityRole="button"
      accessibilityLabel={COPY.onboarding.welcomeTapHint}
    >
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <LolaMark size={88} />
      </Animated.View>
      <Text style={styles.title}>{COPY.onboarding.welcomeTitle}</Text>
      <Text style={styles.body}>{COPY.onboarding.welcomeBody}</Text>
      <Text style={styles.tapHint}>{COPY.onboarding.welcomeTapHint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    // zIndex orders against the iOS stack; elevation must clear the cards'
    // Android elevation (6/10) so they don't paint on top of the overlay.
    zIndex: 50, elevation: 50,
    backgroundColor: color.neutral.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 26,
  },
  title: {
    color: '#fff', fontSize: 32, fontFamily: fontFamily.extrabold, fontWeight: '800',
    textAlign: 'center', letterSpacing: -0.5,
  },
  body: {
    color: 'rgba(255,255,255,0.72)', fontSize: 22, fontFamily: fontFamily.medium,
    textAlign: 'center', lineHeight: 32,
  },
  tapHint: {
    position: 'absolute', bottom: 56, left: 24, right: 24,
    color: 'rgba(255,255,255,0.5)', fontSize: 16, fontFamily: fontFamily.semibold,
    fontWeight: '600', textAlign: 'center',
  },
});
