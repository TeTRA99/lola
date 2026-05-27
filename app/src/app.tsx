import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { CONFIG } from '@/config';
import { SQLiteProvider, migrate } from '@/adapters/storage';
import { LaunchSplash } from '@/screens/LaunchSplash';

void CONFIG;

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <SQLiteProvider databaseName="lola.db" onInit={migrate}>
      {!splashDone ? (
        <LaunchSplash onDone={() => setSplashDone(true)} />
      ) : (
        // Placeholder home — two-button screen lands in E2.3 + E3.3.
        <View style={styles.container}>
          <Text style={styles.brand}>Lola</Text>
          <Text style={styles.placeholder}>v0.9 scaffold — Sprint 1 in progress</Text>
          <StatusBar style="light" />
        </View>
      )}
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: '#fff',
    fontSize: 64,
    fontWeight: '700',
  },
  placeholder: {
    color: '#666',
    marginTop: 16,
    fontSize: 14,
  },
});
