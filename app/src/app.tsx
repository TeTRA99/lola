import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { CONFIG } from '@/config';
import { SQLiteProvider, migrate } from '@/adapters/storage';

// Smoke import of CONFIG proves the `@/*` path alias works at both
// type-check time (tsconfig paths) and runtime (babel-plugin-module-resolver).
// AC1.1.10 + AC1.1.11.
void CONFIG;

export default function App() {
  return (
    <SQLiteProvider databaseName="lola.db" onInit={migrate}>
      <View style={styles.container}>
        <Text style={styles.brand}>Lola</Text>
        <Text style={styles.placeholder}>v0.9 scaffold — Sprint 1 in progress</Text>
        <StatusBar style="light" />
      </View>
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
