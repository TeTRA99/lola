import { lazy, Suspense, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as QuickActions from 'expo-quick-actions';
import { useQuickActionCallback } from 'expo-quick-actions/hooks';
import * as SplashScreen from 'expo-splash-screen';
import { initExecutorch } from 'react-native-executorch/legacy';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher/legacy';
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
import { speak } from '@/adapters/tts';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import * as Settings from '@/services/Settings';
import { CONFIG } from '@/config';
import { preloadResident } from '@/adapters/llmResidency';

// Register the Expo resource fetcher with ExecuTorch once at boot. Required
// before any module (ImageEmbeddings, LLM, etc.) can download / load weights.
initExecutorch({ resourceFetcher: ExpoResourceFetcher });

// Keep the native (ink) splash up until the JS UI + fonts are ready, so there's
// no grey window flash between the native splash and our JS splash.
void SplashScreen.preventAutoHideAsync();

// Setup is reached two ways: the gear on Dad's Home (long-press-gated) and the
// OS app-icon "Configuración" shortcut. This id matches the shortcut on cold +
// warm launch below.
const SETUP_ACTION_ID = 'setup';

type Screen = 'splash' | 'home' | 'setup' | 'debug' | 'guide';

export default function App() {
  // Cold launch via the app-icon shortcut jumps straight to Setup — skip the
  // splash + greeting so the caregiver isn't waiting on a brand moment.
  const launchedToSetup = QuickActions.initial?.id === SETUP_ACTION_ID;
  const [screen, setScreen] = useState<Screen>(launchedToSetup ? 'setup' : 'splash');
  // Target for the guide screen when reached via the "guíame a X" voice flow
  // (null when opened from the dev shortcut → mock mode).
  const [guideTarget, setGuideTarget] = useState<
    { cocoLabel: string | null; spoken: string; cloudQuery?: string; refImageUri?: string | null } | null
  >(null);
  const fontsLoaded = useAppFonts();

  // Register the Android shortcut once (iOS uses the static action declared by
  // the config plugin in app.json). Dynamic Android shortcuts persist after the
  // first run, so this is idempotent.
  // Apply any saved language override (device language is the default).
  useEffect(() => { void loadStoredLang(); }, []);

  // On-device mode: start downloading/loading the VLM at launch so the splash +
  // welcome-voice window hides most of the first-run latency. Only one LLM can be
  // resident (executorch single runner), so we preload the headline VLM here; the
  // small voice-command model loads on first Ask (swapping the VLM out). No-op on
  // cached launches and in cloud mode.
  useEffect(() => {
    void (async () => {
      const mode = await Settings.getString(Settings.KEYS.inferenceMode, CONFIG.LOCAL_INFERENCE_DEFAULT);
      if (mode !== 'local') return;
      void preloadResident('vlm');
    })();
  }, []);

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

  // In-app door to Setup: the gear on Dad's Home (long-press-gated there).
  const openSettings = () => setScreen('setup');

  // Done always returns to Dad's Home, whether Setup was reached via the in-app
  // gear or the OS app-icon shortcut. (Previously the shortcut path exited the
  // app; the caregiver prefers landing back on Home.)
  const closeSetup = () => setScreen('home');

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
        <LaunchSplash onDone={() => setScreen('home')} />
      )}
      {screen === 'home' && (
        <HomeScreen
          onOpenSettings={openSettings}
          onDevDebug={(__DEV__ || CONFIG.SHOW_DEV_TOOLS) ? () => setScreen('debug') : undefined}
          onOpenGuide={(t) => { setGuideTarget(t); setScreen('guide'); }}
        />
      )}
      {/* Setup is reached via the OS app-icon shortcut or the in-app Home gear;
          either way Done returns to Dad's Home (see closeSetup). */}
      {screen === 'setup' && <SetupScreen onClose={closeSetup} />}
      {screen === 'debug' && (
        <DebugScreen
          onClose={() => setScreen('home')}
          onOpenGuide={(t) => { setGuideTarget(t ?? null); setScreen('guide'); }}
        />
      )}
      {screen === 'guide' && (
        <ErrorBoundary
          fallback={<GuideLoadFallback onClose={() => { setGuideTarget(null); setScreen('home'); }} />}
        >
          <Suspense fallback={<View style={{ flex: 1, backgroundColor: '#000' }} />}>
            <GuideScreen
              targetCocoLabel={guideTarget?.cocoLabel ?? null}
              targetLabel={guideTarget?.spoken ?? 'el objeto'}
              cloudQuery={guideTarget?.cloudQuery ?? null}
              refImageUri={guideTarget?.refImageUri ?? null}
              onClose={() => { setGuideTarget(null); setScreen('home'); }}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}

// Calm fallback if the lazy guide screen fails to mount (e.g. its native module
// can't be resolved). Says one line and returns to Home — tap returns sooner.
function GuideLoadFallback({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    void speak(COPY.guide.loadError);
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <Pressable style={styles.guideFallback} onPress={onClose} accessibilityRole="button">
      <Text style={styles.guideFallbackText}>{COPY.guide.loadError}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  guideFallback: {
    flex: 1, backgroundColor: '#0C0D0F',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36,
  },
  guideFallbackText: { color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center', lineHeight: 32 },
});
