import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider, migrate } from '@/adapters/storage';
import { LaunchSplash } from '@/screens/LaunchSplash';
import { HomeScreen } from '@/screens/HomeScreen';
import { SetupScreen } from '@/screens/SetupScreen';
import { DebugScreen } from '@/screens/DebugScreen';

type Screen = 'splash' | 'home' | 'setup' | 'debug';

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');

  return (
    <SQLiteProvider databaseName="lola.db" onInit={migrate}>
      {screen === 'splash' && (
        <LaunchSplash
          onDone={() => setScreen('home')}
          onSetup={() => setScreen('setup')}
          onDebug={() => setScreen('debug')}
        />
      )}
      {screen === 'home' && <HomeScreen />}
      {screen === 'setup' && <SetupScreen onClose={() => setScreen('home')} />}
      {screen === 'debug' && <DebugScreen onClose={() => setScreen('home')} />}
      <StatusBar style="light" />
    </SQLiteProvider>
  );
}
