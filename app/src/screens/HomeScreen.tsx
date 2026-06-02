// FR-1 + FR-2 home (handoff_home, "cards" layout). A light (sunken) screen with
// a top bar — prompt left, settings gear right — over two rounded action cards:
// top = Describir (white, camera), bottom = Preguntar (near-black, mic). The
// cards sit inside margins with a 14px dead-zone gap between them so taps near
// the screen edges / the seam don't land on the wrong action.
//
// Tapping a card runs that action and the active state cycle (listening →
// thinking → speaking) plays INSIDE the tapped card; the other card dims. Lola
// returns to idle on her own when she finishes; tapping again stops her (there
// is no stop button — locked #2).
//
// The visible state is driven off the same lifecycle the services already emit:
// haptic `fire()` events (listening_start / thinking_start / answer_ready) plus
// the TTS speaking-text stream. The run() promise resolving returns us to idle
// (services await speak() before resolving) or surfaces a calm error.
//
// The gear is long-press-gated (a plain tap shows a hint) so the low-vision end
// user can't trip into the caregiver Setup screen.

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { COPY } from '@/services';
import * as DescribeService from '@/services/DescribeService';
import * as AskService from '@/services/AskService';
import { CameraHost } from '@/adapters/CameraHost';
import { cameraNeedsAlwaysOn } from '@/adapters/camera';
import { subscribeHaptics, heartbeat, type HapticPattern } from '@/adapters/haptics';
import { subscribeSpeech, speak, stop as ttsStop } from '@/adapters/tts';
import { abort as sttAbort } from '@/adapters/stt';
import * as Settings from '@/services/Settings';
import { Icon } from '@/components/Icon';
import { ActionIcon } from '@/components/ActionIcon';
import { LolaMark } from '@/components/LolaMark';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Toast, type ToastMessage } from '@/components/Toast';
import { WelcomeOverlay } from '@/components/WelcomeOverlay';
import { ModelPrepBanner } from '@/components/ModelPrepBanner';
import { DetectionPrepBanner } from '@/components/DetectionPrepBanner';
import { presetForLevel, currentDetectionLevel, isModelDownloaded } from '@/adapters/detectionPresets';
import { inferenceMode } from '@/services/ModelRouter';
import * as VlmAdapter from '@/adapters/visionLLM';
import { CONFIG } from '@/config';
import { color, fontFamily } from '@/theme/tokens';
import { TOP_INSET, BOTTOM_INSET } from '@/theme/insets';

type Mode = 'describe' | 'ask';
type HomeState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
type ErrKind = 'camera' | 'perm';

const ACCENT_DARK = color.dad.askAccent; // #5AA2F5
const ACCENT_LIGHT = color.primary[500]; // #1A73E8

// On most devices the hidden camera is mounted only while a flow runs (see
// cameraNeedsAlwaysOn); on the MIUI brands that stream late it stays mounted.
const ALWAYS_ON_CAMERA = cameraNeedsAlwaysOn();

export function HomeScreen({
  onOpenSettings,
  onDevDebug,
  onOpenGuide,
}: {
  onOpenSettings?: () => void;
  onDevDebug?: () => void;
  onOpenGuide?: (target: { cocoLabel: string | null; spoken: string; cloudQuery?: string; refImageUri?: string | null }) => void;
}) {
  const [mode, setMode] = useState<Mode>('describe');
  const [state, setState] = useState<HomeState>('idle');
  const [errKind, setErrKind] = useState<ErrKind>('camera');
  const [spoken, setSpoken] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const running = state === 'listening' || state === 'thinking' || state === 'speaking';
  const runningRef = useRef(false);
  runningRef.current = running;
  // Set when the user taps to interrupt, so the in-flight run()'s resolution
  // doesn't overwrite the idle state we just forced.
  const cancelledRef = useRef(false);
  // True while a first-use hint is being spoken before a flow starts — blocks
  // re-entry so a second tap doesn't kick off a parallel run.
  const preparingRef = useRef(false);

  // The hidden camera is mounted on demand: it comes up the instant a card is
  // tapped (so its ~1s warmup overlaps the hint / "Un momento…" and is never
  // felt) and comes down once we're back at rest. On the MIUI brands that hang
  // on a fresh mount we keep it up the whole time instead (ALWAYS_ON_CAMERA).
  const [cameraMounted, setCameraMounted] = useState(ALWAYS_ON_CAMERA);

  // Show the Guide-detector prep banner if the chosen Detection-quality level
  // needs a model that isn't on the device yet. Evaluated at mount (Home remounts
  // on return from Setup, so a freshly-changed level re-triggers the download).
  const [detPending, setDetPending] = useState(() => !isModelDownloaded(presetForLevel(currentDetectionLevel()).modelName));

  // First-run welcome (item #6): a one-time voice-first interstitial. Shown once
  // ever, then suppressed via the welcomeSeen flag.
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    void Settings.getBool(Settings.KEYS.welcomeSeen, false).then(seen => {
      if (!seen) setShowWelcome(true);
    });
  }, []);
  const dismissWelcome = () => {
    setShowWelcome(false);
    void Settings.setBool(Settings.KEYS.welcomeSeen, true);
  };

  // Dev-only: surface which cloud-guide model the spike is using (only when the
  // guide backend is set to cloud in Debug). Never shown in the end-user build.
  const [devGuideLabel, setDevGuideLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!onDevDebug) return;
    void (async () => {
      const backend = await Settings.getString(Settings.KEYS.guideBackend, 'device');
      if (backend !== 'cloud') { setDevGuideLabel(null); return; }
      const model = await Settings.getString(Settings.KEYS.guideCloudModel, CONFIG.GUIDE_CLOUD_MODEL_DEFAULT);
      setDevGuideLabel(`cloud · ${model.replace(/^.*\//, '')}`);
    })();
  }, [onDevDebug]);

  // Tap anywhere while Lola is listening/thinking/speaking → stop her and
  // return to idle. (Re-tap a panel to start fresh.)
  const stopActive = () => {
    cancelledRef.current = true;
    ttsStop();
    sttAbort();
    setSpoken('');
    setState('idle');
  };

  // Map service lifecycle → in-panel state. Only the intermediate states come
  // from haptics; tap sets the optimistic first state and run() resolution
  // returns to idle / error.
  useEffect(() => {
    const offHaptics = subscribeHaptics((p: HapticPattern) => {
      if (!runningRef.current) return;
      if (p === 'listening_start') setState('listening');
      else if (p === 'thinking_start') setState('thinking');
      else if (p === 'answer_ready') setState('speaking');
    });
    const offSpeech = subscribeSpeech((text) => {
      if (!runningRef.current) return;
      if (text) { setSpoken(text); setState('speaking'); }
    });
    return () => { offHaptics(); offSpeech(); };
  }, []);

  // Idle heartbeat (opt-in): a gentle "lub-dub" every few seconds while Home is
  // idle so a low-vision user can feel the app is alive and waiting. Stops the
  // moment Lola is doing anything; resumes when idle again.
  const [heartbeatOn, setHeartbeatOn] = useState(false);
  useEffect(() => {
    void Settings.getBool(Settings.KEYS.idleHeartbeat, true).then(setHeartbeatOn);
  }, []);
  // Whether the one-time "that pulse is me" hint still needs to play. Starts
  // true (suppressed) until the stored flag loads, so we never speak before we
  // know it's the first time.
  const heartbeatHintDoneRef = useRef(true);
  useEffect(() => {
    void Settings.getBool(Settings.KEYS.heartbeatHintSeen, false).then(seen => {
      heartbeatHintDoneRef.current = seen;
    });
  }, []);
  useEffect(() => {
    if (!heartbeatOn || state !== 'idle' || showWelcome) return;
    const id = setInterval(() => {
      heartbeat();
      // First heartbeat ever → explain the buzz once, so it isn't a mystery.
      if (!heartbeatHintDoneRef.current) {
        heartbeatHintDoneRef.current = true;
        void Settings.setBool(Settings.KEYS.heartbeatHintSeen, true);
        void speak(COPY.onboarding.heartbeatHint);
      }
    }, 6000);
    return () => clearInterval(id);
  }, [heartbeatOn, state, showWelcome]);

  // Tear the on-demand camera back down once we return to rest (idle/error),
  // unless a fresh flow is still being prepared. No-op when it's kept always-on.
  useEffect(() => {
    if (ALWAYS_ON_CAMERA) return;
    if ((state === 'idle' || state === 'error') && !preparingRef.current) {
      setCameraMounted(false);
    }
  }, [state]);

  // Camera error is calm and self-clearing — Lola says her line and the screen
  // returns to the menu on its own (handoff §3). Tapping returns sooner. The
  // permission error keeps its recovery button until acted on.
  useEffect(() => {
    if (state === 'error' && errKind === 'camera') {
      const t = setTimeout(() => setState('idle'), 4000);
      return () => clearTimeout(t);
    }
  }, [state, errKind]);

  const run = async (m: Mode) => {
    if (runningRef.current) { stopActive(); return; } // tap during a run = stop
    if (preparingRef.current) return; // a first-use hint is still playing
    cancelledRef.current = false;
    // Bring the camera up the moment the card is tapped so it's warm by the
    // time we capture (no-op when it's already always-on).
    setCameraMounted(true);
    setMode(m);
    setSpoken('');
    // First-use hint (once per feature), spoken before the flow so it doesn't
    // collide with the mic (Preguntar) or Lola's answer (Describir).
    preparingRef.current = true;
    const hintKey = m === 'ask' ? Settings.KEYS.askHintSeen : Settings.KEYS.describeHintSeen;
    if (!(await Settings.getBool(hintKey, false))) {
      await Settings.setBool(hintKey, true);
      await speak(m === 'ask' ? COPY.onboarding.askHint : COPY.onboarding.describeHint);
    }
    // On-device first run: if the model is still downloading, say so rather than
    // leave a silent wait. The describe/ask call awaits the download and then runs.
    if (inferenceMode() === 'local' && !VlmAdapter.isReady()) {
      await speak(COPY.models.preparing);
    }
    preparingRef.current = false;
    if (cancelledRef.current) return;
    // Both modes open on "thinking" (Un momento…). For Ask, the mic isn't open
    // yet — AskService flips us to "Te escucho…" via the listening_start haptic
    // the moment it actually is, so the user doesn't talk into a warming-up mic.
    setState('thinking');
    try {
      const res = m === 'describe' ? await DescribeService.run() : await AskService.run();
      if (cancelledRef.current) return; // user interrupted — don't clobber idle
      if (res.ok) {
        // "Guíame a X" → hand off to the live guide screen instead of idling.
        if ('guide' in res.value && res.value.guide && onOpenGuide) {
          onOpenGuide(res.value.guide);
          return;
        }
        setState('idle');
      } else {
        console.log('[home] run returned error:', res.error);
        const perm = res.error === 'permission_denied' || res.error === 'permission_denied_mic';
        setErrKind(perm ? 'perm' : 'camera');
        setState('error');
      }
    } catch (e) {
      console.log('[home] run THREW:', e);
      if (cancelledRef.current) return;
      setErrKind('camera');
      setState('error');
    }
  };

  // Top bar fades out (and stops taking touches) while a flow is running.
  // NOTE: must stay above the `state === 'error'` early return below — all hooks
  // have to run on every render, error state included.
  const topBarOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(topBarOpacity, {
      toValue: running ? 0 : 1, duration: 300, useNativeDriver: true,
    }).start();
  }, [running, topBarOpacity]);

  // ---- ERROR (calm, never alarming) ----
  if (state === 'error') {
    const perm = errKind === 'perm';
    return (
      <Pressable
        style={styles.errorRoot}
        onPress={perm ? undefined : () => setState('idle')}
        accessibilityRole={perm ? undefined : 'button'}
      >
        <StatusBar style="light" />
        <View style={styles.errorCircle}>
          <Icon name={perm ? 'photo' : 'error'} size={62} color={color.heedAmber} />
        </View>
        <Text style={styles.errorTitle}>{perm ? COPY.home.errPerm : COPY.home.errCamera}</Text>
        <Text style={styles.errorSub}>{perm ? COPY.home.errPermSub : COPY.home.errCameraSub}</Text>
        {perm && (
          <View style={styles.errorBtnWrap}>
            <PrimaryButton
              dad
              label={COPY.home.errPermBtn}
              onPress={() => { void Linking.openSettings().catch(() => {}); setState('idle'); }}
            />
          </View>
        )}
      </Pressable>
    );
  }

  const describeState: HomeState = mode === 'describe' && running ? state : 'idle';
  const askState: HomeState = mode === 'ask' && running ? state : 'idle';
  const describeActive = describeState !== 'idle';
  const askActive = askState !== 'idle';

  return (
    <View style={styles.root}>
      {/* Light (sunken) surface → dark status-bar icons. */}
      <StatusBar style="dark" />
      {/* Camera is mounted on demand (or always, on the MIUI fallback brands)
          so it isn't streaming — and leaking its preview onto the status bar —
          while Home sits idle. */}
      {cameraMounted && <CameraHost />}

      {/* First-run on-device model download progress (local mode only; hides
          itself when ready / on cached launches / on cloud). */}
      <ModelPrepBanner />

      {/* Guide detector download — shown when the chosen Detection-quality level
          needs a model that isn't on the device yet. Starts the download here on
          Home (Home remounts on return from Setup, so a fresh level is picked up). */}
      {detPending && <DetectionPrepBanner onReady={() => setDetPending(false)} />}

      {/* Top bar: prompt (left) + settings gear (right). Long-press the gear to
          open Setup; a plain tap shows a hint (gated so the end user can't trip
          into the caregiver screen). The dev-only 🎯 jumps to the guide spike. */}
      <Animated.View
        style={[styles.topBar, { opacity: topBarOpacity }]}
        pointerEvents={running ? 'none' : 'auto'}
      >
        <Text style={styles.prompt}>{COPY.home.homePrompt}</Text>
        <View style={styles.topRight}>
          {devGuideLabel && <Text style={styles.devGuideLabel}>{devGuideLabel}</Text>}
          {onDevDebug && (
            <Pressable
              onPress={onDevDebug}
              style={styles.devBtn}
              accessibilityLabel="Dev: open Debug"
            >
              <Icon name="debug" size={22} color={color.text.low} />
            </Pressable>
          )}
          {onOpenSettings && (
            <Pressable
              onPress={() => setToast({ text: COPY.home.settingsHint })}
              onLongPress={onOpenSettings}
              delayLongPress={500}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel={COPY.splash.settings}
              accessibilityHint={COPY.home.settingsHint}
              style={styles.gearBtn}
            >
              <Icon name="settings" size={22} color={color.text.low} />
            </Pressable>
          )}
        </View>
      </Animated.View>

      <Card
        dark={false}
        action="describe"
        state={describeState}
        spoken={spoken}
        running={running}
        active={describeActive}
        onPress={() => run('describe')}
      />
      <View style={styles.cardGap} />
      <Card
        dark
        action="ask"
        state={askState}
        spoken={spoken}
        running={running}
        active={askActive}
        onPress={() => run('ask')}
      />

      <Toast message={toast} onHide={() => setToast(null)} />

      {showWelcome && <WelcomeOverlay onDismiss={dismissWelcome} />}
    </View>
  );
}

// ---------------- CARD ----------------
// Rounded action card. Idle weights: Describir taller (flex 1.32), Preguntar
// shorter (0.92). While a flow runs, the active card grows toward flex 1 and the
// other dims to 0.26. flex/opacity can't use the native driver, so this animates
// on the JS thread (the inner state animations still run natively).
function Card({
  dark, action, state, spoken, running, active, onPress,
}: {
  dark: boolean;
  action: Mode;
  state: HomeState;
  spoken: string;
  running: boolean;
  active: boolean;
  onPress: () => void;
}) {
  const baseFlex = dark ? 0.92 : 1.32;
  const flex = useRef(new Animated.Value(baseFlex)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const dimmed = running && !active;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(flex, {
        toValue: active ? 1 : baseFlex, duration: 350, easing: Easing.inOut(Easing.ease), useNativeDriver: false,
      }),
      Animated.timing(opacity, {
        toValue: dimmed ? 0.26 : 1, duration: 350, easing: Easing.inOut(Easing.ease), useNativeDriver: false,
      }),
    ]).start();
  }, [active, dimmed, baseFlex, flex, opacity]);

  const label = action === 'ask' ? COPY.buttons.askLabel : COPY.buttons.describeLabel;

  return (
    <Animated.View
      style={[styles.cardWrap, dark ? styles.cardWrapDark : styles.cardWrapLight, { flex, opacity }]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.card, dark ? styles.cardDark : styles.cardLight]}
      >
        {active && <GlowBackdrop dark={dark} />}
        <View style={styles.stage}>
          <FieldStage dark={dark} action={action} state={state} spoken={spoken} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ---------------- STATE CONTENT ----------------
function FieldStage({
  dark, action, state, spoken,
}: { dark: boolean; action: Mode; state: HomeState; spoken: string }) {
  const accent = dark ? ACCENT_DARK : ACCENT_LIGHT;
  const textColor = dark ? '#fff' : color.neutral.ink;
  const circleBg = dark ? 'rgba(90,162,245,0.16)' : color.primary[50];
  const isAsk = action === 'ask';

  if (state === 'idle') {
    return (
      <>
        <View style={[styles.idleCircle, { backgroundColor: circleBg }]}>
          <ActionIcon kind={isAsk ? 'ask' : 'describe'} size={90} color={accent} strokeWidth={1.45} />
        </View>
        <Text style={[styles.actionLabel, { color: textColor }]}>{isAsk ? COPY.buttons.askLabel : COPY.buttons.describeLabel}</Text>
      </>
    );
  }
  if (state === 'listening') {
    return (
      <>
        <PulseRing accent={accent}>
          <Icon name="ask" size={48} color={textColor} />
        </PulseRing>
        <Text style={[styles.statusLabel, { color: textColor }]}>{COPY.home.listening}</Text>
      </>
    );
  }
  if (state === 'thinking') {
    return (
      <>
        <SpinRing dark={dark} accent={accent}>
          <LolaMark size={52} />
        </SpinRing>
        <Text style={[styles.statusLabel, { color: textColor }]}>{COPY.home.thinking}</Text>
      </>
    );
  }
  // speaking
  return (
    <>
      <Waveform accent={accent} />
      {spoken ? (
        <Text
          style={[styles.spoken, { color: textColor }]}
          numberOfLines={5}
          ellipsizeMode="tail"
        >
          {spoken}
        </Text>
      ) : null}
    </>
  );
}

// ---------------- ANIMATED PIECES ----------------
function GlowBackdrop({ dark }: { dark: boolean }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glow,
        {
          backgroundColor: dark ? 'rgba(90,162,245,0.20)' : 'rgba(96,110,132,0.13)',
          opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.95] }),
          transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }],
        },
      ]}
    />
  );
}

function PulseRing({ accent, children }: { accent: string; children: React.ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(a, { toValue: 1, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return (
    <View style={styles.ringWrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pulseHalo,
          {
            borderColor: accent,
            opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
            transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
          },
        ]}
      />
      <View style={[styles.ring, { borderColor: accent }]}>{children}</View>
    </View>
  );
}

function SpinRing({ dark, accent, children }: { dark: boolean; accent: string; children: React.ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(a, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return (
    <View style={styles.ringWrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.spinRing,
          {
            borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(12,13,15,0.1)',
            borderTopColor: accent,
            transform: [{ rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
          },
        ]}
      />
      {children}
    </View>
  );
}

function Waveform({ accent }: { accent: string }) {
  const bars = useRef([0, 1, 2, 3, 4, 5, 6].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const loops = bars.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 420, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [bars]);
  return (
    <View style={styles.waveRow}>
      {bars.map((v, i) => (
        <Animated.View
          key={i}
          style={[styles.waveBar, { backgroundColor: accent, transform: [{ scaleY: v }] }]}
        />
      ))}
    </View>
  );
}

const cardShadowLight = Platform.select({
  android: { elevation: 6 },
  default: { shadowColor: '#0C0D0F', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 30 },
});
const cardShadowDark = Platform.select({
  android: { elevation: 10 },
  default: { shadowColor: '#0C0D0F', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.4, shadowRadius: 36 },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.neutral.sunken,
    paddingHorizontal: 16,
    paddingTop: TOP_INSET,
    paddingBottom: BOTTOM_INSET + 20,
  },
  topBar: {
    height: 46, marginVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  prompt: { color: color.text.high, fontSize: 21, fontFamily: fontFamily.extrabold, fontWeight: '800', letterSpacing: -0.2 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gearBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  devBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  devGuideLabel: { color: color.text.low, fontSize: 10, fontFamily: fontFamily.medium },

  cardWrap: { borderRadius: 34, minHeight: 190 },
  cardWrapLight: { backgroundColor: color.dad.describeBg, ...cardShadowLight },
  cardWrapDark: { backgroundColor: color.dad.askBg, ...cardShadowDark },
  card: {
    flex: 1, borderRadius: 34, overflow: 'hidden', padding: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  cardLight: { backgroundColor: color.dad.describeBg, borderWidth: 1.5, borderColor: color.neutral.border },
  cardDark: { backgroundColor: color.dad.askBg },
  cardGap: { height: 14 },

  stage: { alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 28, zIndex: 2 },
  glow: { position: 'absolute', width: 320, height: 320, borderRadius: 160 },

  idleCircle: { width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 44, fontFamily: fontFamily.extrabold, fontWeight: '800', letterSpacing: -0.5 },
  statusLabel: { fontSize: 28, fontFamily: fontFamily.bold, fontWeight: '700' },
  spoken: { fontSize: 23, fontFamily: fontFamily.semibold, fontWeight: '600', lineHeight: 31, textAlign: 'center', maxWidth: 260 },

  ringWrap: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 112, height: 112, borderRadius: 56, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  pulseHalo: { position: 'absolute', width: 112, height: 112, borderRadius: 56, borderWidth: 3 },
  spinRing: { position: 'absolute', width: 112, height: 112, borderRadius: 56, borderWidth: 3 },

  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 40, marginBottom: 6 },
  waveBar: { width: 5, height: 36, borderRadius: 3 },

  errorRoot: {
    flex: 1,
    backgroundColor: color.neutral.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  errorCircle: {
    width: 132, height: 132, borderRadius: 66,
    backgroundColor: 'rgba(240,180,92,0.14)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 32,
  },
  errorTitle: { color: '#fff', fontSize: 34, fontFamily: fontFamily.extrabold, fontWeight: '800', textAlign: 'center', marginBottom: 14, letterSpacing: -0.3 },
  errorSub: { color: 'rgba(255,255,255,0.66)', fontSize: 22, fontFamily: fontFamily.medium, textAlign: 'center', lineHeight: 32, maxWidth: 300 },
  errorBtnWrap: { width: '100%', maxWidth: 320, marginTop: 44 },
});
