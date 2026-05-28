import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import { LaunchSplash } from '@/screens/LaunchSplash';
import { HomeScreen } from '@/screens/HomeScreen';
import { SetupScreen } from '@/screens/SetupScreen';
import { DebugScreen } from '@/screens/DebugScreen';

// Register the Expo resource fetcher with ExecuTorch once at boot. Required
// before any module (ImageEmbeddings, LLM, etc.) can download / load weights.
initExecutorch({ resourceFetcher: ExpoResourceFetcher });

type Screen = 'splash' | 'home' | 'setup' | 'debug';

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');
  console.log('[App] render with screen =', screen);

  return (
    <>
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
    </>
  );
}
