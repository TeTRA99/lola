// FR-1 + FR-2 home: two big buttons. Top = Describe (E2.3), bottom = Ask (E3.3).

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COPY } from '@/services';
import * as DescribeService from '@/services/DescribeService';
import * as AskService from '@/services/AskService';
import { CameraHost } from '@/adapters/CameraHost';
import { stop as ttsStop } from '@/adapters/tts';
import { abort as sttAbort } from '@/adapters/stt';

export function HomeScreen() {
  const [busyDescribe, setBusyDescribe] = useState(false);
  const [busyAsk, setBusyAsk] = useState(false);

  // Tap while Lola is speaking / listening / thinking → just shut her up.
  // User has to tap again to start a fresh action. Avoids the "I tapped to
  // interrupt and now she's already pulling a new picture" feeling.
  const isBusy = busyDescribe || busyAsk;
  const cancelInflight = () => {
    ttsStop();
    sttAbort();
    setBusyDescribe(false);
    setBusyAsk(false);
  };

  const onDescribe = async () => {
    if (isBusy) { cancelInflight(); return; }
    setBusyDescribe(true);
    try { await DescribeService.run(); }
    finally { setTimeout(() => setBusyDescribe(false), 100); }
  };

  const onAsk = async () => {
    if (isBusy) { cancelInflight(); return; }
    setBusyAsk(true);
    try { await AskService.run(); }
    finally { setTimeout(() => setBusyAsk(false), 100); }
  };

  return (
    <View style={styles.root}>
      <CameraHost />
      <Pressable
        style={({ pressed }) => [
          styles.btn,
          styles.btnTop,
          pressed && styles.pressed,
          busyDescribe && styles.dim,
        ]}
        onPress={onDescribe}
        accessibilityRole="button"
        accessibilityLabel={COPY.buttons.describeLabel}
      >
        <Text style={styles.icon}>📷</Text>
        <Text style={styles.labelDark}>{COPY.buttons.describeLabel}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.btn,
          styles.btnBottom,
          pressed && styles.pressed,
          busyAsk && styles.dim,
        ]}
        onPress={onAsk}
        accessibilityRole="button"
        accessibilityLabel={COPY.buttons.askLabel}
      >
        <Text style={styles.icon}>🎤</Text>
        <Text style={styles.labelLight}>{COPY.buttons.askLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  btnTop: { backgroundColor: '#e8e8e8' },
  btnBottom: { backgroundColor: '#1a1a1a', borderTopWidth: 2, borderTopColor: '#000' },
  pressed: { opacity: 0.8 },
  dim: { opacity: 0.6 },
  icon: { fontSize: 120 },
  labelDark: { fontSize: 36, fontWeight: '700', color: '#000', marginTop: 16, letterSpacing: 0.5 },
  labelLight: { fontSize: 36, fontWeight: '700', color: '#fff', marginTop: 16, letterSpacing: 0.5 },
});
