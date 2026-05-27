// Placeholder — full DebugScreen lands in E6.4. This stub satisfies the
// routing integration from E4.1.

import { Pressable, StyleSheet, Text, View } from 'react-native';

export function DebugScreen({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Debug (placeholder — E6.4 fills this)</Text>
      <Pressable style={styles.btn} onPress={onClose}>
        <Text style={styles.btnText}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#fff', fontSize: 18, marginBottom: 24, textAlign: 'center' },
  btn: { backgroundColor: '#444', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 8 },
  btnText: { color: '#fff', fontSize: 16 },
});
