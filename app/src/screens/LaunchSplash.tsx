// FR-6.2 — launch greeting fires within 800ms of splash dismiss (AC6.3).
// The splash itself stays visible for 800ms then calls onDone; the TTS fires
// on mount in parallel so the audio overlap-with-fade gives a smooth handoff.

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { speak } from '@/adapters/tts';
import { COPY } from '@/services';

const SPLASH_DURATION_MS = 800;

export function LaunchSplash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    // Fire-and-forget: TTS is async but we don't gate dismiss on it.
    void speak(COPY.greeting);
    const t = setTimeout(onDone, SPLASH_DURATION_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>Lola</Text>
    </View>
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
