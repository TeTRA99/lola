// FR-1 + FR-2 home: two big buttons. The Describe button (top) ships in this
// story (E2.3); the Ask button (bottom) lands in E3.3. Until then, the bottom
// is a dim placeholder so the layout shape is established.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COPY } from '@/services';
import * as DescribeService from '@/services/DescribeService';
import { CameraHost } from '@/adapters/CameraHost';

export function HomeScreen() {
  const [busy, setBusy] = useState(false);

  const onDescribe = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await DescribeService.run();
    } finally {
      // Brief grey-out to prevent double-fires.
      setTimeout(() => setBusy(false), 100);
    }
  };

  return (
    <View style={styles.root}>
      <CameraHost />
      <Pressable
        style={({ pressed }) => [
          styles.btn,
          styles.btnTop,
          pressed && styles.pressed,
          busy && styles.dim,
        ]}
        onPress={onDescribe}
        accessibilityRole="button"
        accessibilityLabel={COPY.buttons.describeLabel}
      >
        <Text style={styles.icon}>📷</Text>
        <Text style={styles.labelDark}>{COPY.buttons.describeLabel}</Text>
      </Pressable>
      <View style={[styles.btn, styles.btnBottom, styles.placeholder]}>
        <Text style={styles.placeholderIcon}>·</Text>
        <Text style={styles.labelLight}>{COPY.buttons.askLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  btnTop: { backgroundColor: '#e8e8e8' },
  btnBottom: { backgroundColor: '#1a1a1a' },
  pressed: { opacity: 0.8 },
  dim: { opacity: 0.6 },
  icon: { fontSize: 120 },
  placeholderIcon: { fontSize: 100, color: '#444' },
  labelDark: { fontSize: 36, fontWeight: '700', color: '#000', marginTop: 16, letterSpacing: 0.5 },
  labelLight: { fontSize: 36, fontWeight: '700', color: '#666', marginTop: 16, letterSpacing: 0.5 },
  placeholder: { borderTopWidth: 2, borderTopColor: '#000' },
});
