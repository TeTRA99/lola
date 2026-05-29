// Bottom-center pill toast: ink bg, white text, success/error dot. Slides up +
// fades in, auto-dismisses after 2.4s. Driven by a `{ text, type }` message;
// pass `null` to hide. Calls `onHide` once the dismiss timer elapses so the
// parent can clear its message state.

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { color, radius, fontFamily, shadow } from '@/theme/tokens';
import { Icon } from './Icon';

export type ToastMessage = { text: string; type?: 'success' | 'error' };

const VISIBLE_MS = 2400;

export function Toast({ message, onHide }: { message: ToastMessage | null; onHide: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  const hideRef = useRef(onHide);
  hideRef.current = onHide;

  useEffect(() => {
    if (!message) return;
    Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(
        () => hideRef.current(),
      );
    }, VISIBLE_MS);
    return () => clearTimeout(t);
  }, [message, anim]);

  if (!message) return null;
  const isError = message.type === 'error';
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View
        style={[
          styles.pill,
          shadow('lg'),
          {
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
          },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: isError ? color.status.error : color.status.success }]}>
          <Icon name={isError ? 'cancel' : 'check'} size={15} color="#fff" />
        </View>
        <Text style={styles.text} numberOfLines={1}>{message.text}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 26, alignItems: 'center', zIndex: 60 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: color.neutral.ink,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: radius.md + 1,
    maxWidth: '84%',
  },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontFamily: fontFamily.semibold, fontWeight: '600', fontSize: 15 },
});
