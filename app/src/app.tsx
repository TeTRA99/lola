import { lazy, Suspense, useEffect, useState } from 'react';
import { BackHandler, Platform, View } from 'react-native';
import * as QuickActions from 'expo-quick-actions';
import { useQuickActionCallback } from 'expo-quick-actions/hooks';
import * as SplashScreen from 'expo-splash-screen';
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import { LaunchSplash } from '@/screens/LaunchSplash';
import { HomeScreen } from '@/screens/HomeScreen';
import { SetupScreen } from '@/screens/SetupScreen';
import { DebugScreen } from '@/screens/DebugScreen';
// Lazy so react-native-vision-camera's native module only loads when the guide
// screen is opened — an older dev client without it won't crash at app launch.
const GuideScreen = lazy(() =>
  import('@/screens/GuideScreen').then(m => ({ default: m.GuideScreen })),
);
import { useAppFonts } from '@/theme/fonts';
import { loadStoredLang } from '@/i18n';
import { COPY } from '@/services';

// Register the Expo resource fetcher with ExecuTorch once at boot. Required
// before any module (ImageEmbeddings, LLM, etc.) can download / load weights.
initExecutorch({ resourceFetcher: ExpoResourceFetcher });

// Keep the native (ink) splash up until the JS UI + fonts are ready, so there's
// no grey window flash between the native splash and our JS splash.
void SplashScreen.preventAutoHideAsync();

// The OS app-icon "Configuración" shortcut is the real door to Setup (locked
// decision #3). Its id is matched on cold + warm launch below.
const SETUP_ACTION_ID = 'setup';

type Screen = 'splash' | 'home' | 'setup' | 'debug' | 'guide';

export default function App() {
  // Cold launch via the app-icon shortcut jumps straight to Setup — skip the
  // splash + greeting so the caregiver isn't waiting on a brand moment.
  const launchedToSetup = QuickActions.initial?.id === SETUP_ACTION_ID;
  const [screen, setScreen] = useState<Screen>(launchedToSetup ? 'setup' : 'splash');
  const fontsLoaded = useAppFonts();

  // Register the Android shortcut once (iOS uses the static action declared by
  // the config plugin in app.json). Dynamic Android shortcuts persist after the
  // first run, so this is idempotent.
  // Apply any saved language override (device language is the default).
  useEffect(() => { void loadStoredLang(); }, []);

  // Reveal the app only once fonts are ready — hides the native splash directly
  // onto our JS splash (both ink), no grey gap.
  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  // Note: the system navigation bar is intentionally LEFT VISIBLE so there is
  // always an obvious way Home/Back (important for a low-vision user, and it
  // matches the design mockups). Content clears it via the bottom inset in
  // @/theme/insets rather than by hiding the bar.

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void QuickActions.setItems([
      {
        id: SETUP_ACTION_ID,
        title: COPY.splash.settings,
        subtitle: COPY.splash.shortcutSub,
        icon: 'shortcut_setup',
      },
    ]);
  }, []);

  // Warm launch (app already running) — the OS fires the action; jump to Setup.
  // Fires with the initial action too, which is a no-op when we already started
  // on Setup above.
  useQuickActionCallback((action) => {
    if (action?.id === SETUP_ACTION_ID) setScreen('setup');
  });

  // Leave the app when Setup is dismissed. Android's BackHandler.exitApp() only
  // *backgrounds* the task (it doesn't kill the process), so we ALSO reset the
  // screen to Home first — otherwise a warm resume would drop the caregiver
  // right back into Setup. Net effect: Done sends the app away, and reopening
  // behaves like a normal app (resumes to Home; a cold launch shows the splash).
  const closeSetup = () => {
    setScreen('home');
    // Exit the app only in production. In dev, exiting would also drop the
    // Metro connection on every Done — just return to Home instead.
    if (Platform.OS === 'android' && !__DEV__) BackHandler.exitApp();
  };

  console.log('[App] render with screen =', screen, 'fonts =', fontsLoaded);

  // Hold on a plain ink background until the brand fonts are ready so we never
  // flash system-font text — and so the real splash (greeting + timers) mounts
  // exactly once, after the swap.
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#0C0D0F' }} />;
  }

  return (
    <>
      {screen === 'splash' && (
        <LaunchSplash
          onDone={() => setScreen('home')}
          onDebug={() => setScreen('debug')}
        />
      )}
      {screen === 'home' && (
        <HomeScreen
          onDevSetup={__DEV__ ? () => setScreen('setup') : undefined}
          onDevGuide={__DEV__ ? () => setScreen('guide') : undefined}
        />
      )}
      {/* Setup is only reached via the OS app-icon shortcut, so finishing it
          should return the caregiver to where they came from — i.e. leave the
          app — not drop into Dad's Home. */}
      {screen === 'setup' && <SetupScreen onClose={closeSetup} />}
      {screen === 'debug' && (
        <DebugScreen onClose={() => setScreen('home')} onOpenGuide={() => setScreen('guide')} />
      )}
      {screen === 'guide' && (
        <Suspense fallback={<View style={{ flex: 1, backgroundColor: '#000' }} />}>
          <GuideScreen onClose={() => setScreen('home')} />
        </Suspense>
      )}
    </>
  );
}
