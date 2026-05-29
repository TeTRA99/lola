// FR-1 + FR-2 home (handoff §3). Two equal panels — top = Describir (white,
// camera), bottom = Preguntar (near-black, mic). Tapping a panel runs that
// action and the active state cycle (listening → thinking → speaking) plays
// INSIDE the tapped panel; the other panel dims and disables. Lola returns to
// idle on her own when she finishes — there is no stop button (locked #2).
//
// The visible state is driven off the same lifecycle the services already emit:
// haptic `fire()` events (listening_start / thinking_start / answer_ready) plus
// the TTS speaking-text stream. The run() promise resolving returns us to idle
// (services await speak() before resolving) or surfaces a calm error.

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Linking,
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
import { subscribeHaptics, heartbeat, type HapticPattern } from '@/adapters/haptics';
import { subscribeSpeech, stop as ttsStop } from '@/adapters/tts';
import { abort as sttAbort } from '@/adapters/stt';
import * as Settings from '@/services/Settings';
import { Icon } from '@/components/Icon';
import { ActionIcon } from '@/components/ActionIcon';
import { LolaMark } from '@/components/LolaMark';
import { PrimaryButton } from '@/components/PrimaryButton';
import { color, fontFamily } from '@/theme/tokens';
import { TOP_INSET, BOTTOM_INSET } from '@/theme/insets';

type Mode = 'describe' | 'ask';
type HomeState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
type ErrKind = 'camera' | 'perm';

const ACCENT_DARK = color.dad.askAccent; // #5AA2F5
const ACCENT_LIGHT = color.primary[500]; // #1A73E8

export function HomeScreen({ onDevSetup }: { onDevSetup?: () => void }) {
  const [mode, setMode] = useState<Mode>('describe');
  const [state, setState] = useState<HomeState>('idle');
  const [errKind, setErrKind] = useState<ErrKind>('camera');
  const [spoken, setSpoken] = useState('');
  const running = state === 'listening' || state === 'thinking' || state === 'speaking';
  const runningRef = useRef(false);
  runningRef.current = running;
  // Set when the user taps to interrupt, so the in-flight run()'s resolution
  // doesn't overwrite the idle state we just forced.
  const cancelledRef = useRef(false);

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
  useEffect(() => {
    if (!heartbeatOn || state !== 'idle') return;
    const id = setInterval(heartbeat, 6000);
    return () => clearInterval(id);
  }, [heartbeatOn, state]);

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
    cancelledRef.current = false;
    setMode(m);
    setSpoken('');
    setState(m === 'ask' ? 'listening' : 'thinking');
    try {
      const res = m === 'describe' ? await DescribeService.run() : await AskService.run();
      if (cancelledRef.current) return; // user interrupted — don't clobber idle
      if (res.ok) {
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
      {/* Top panel is white → dark status icons. */}
      <StatusBar style="dark" />
      <CameraHost />

      {/* Dev-only shortcut to Setup (production reaches Setup via the OS
          app-icon shortcut). Rendered only when a handler is passed. */}
      {onDevSetup && (
        <Pressable
          onPress={onDevSetup}
          style={styles.devGear}
          accessibilityLabel="Dev: open Setup"
        >
          <Icon name="settings" size={20} color="rgba(255,255,255,0.92)" />
        </Pressable>
      )}

      <Panel
        dark={false}
        action="describe"
        state={describeState}
        spoken={spoken}
        dimmed={running && !describeActive}
        disabled={false}
        onPress={() => run('describe')}
      />
      <View style={styles.divider} />
      <Panel
        dark
        action="ask"
        state={askState}
        spoken={spoken}
        dimmed={running && !askActive}
        disabled={false}
        onPress={() => run('ask')}
      />
    </View>
  );
}

// ---------------- PANEL ----------------
function Panel({
  dark, action, state, spoken, dimmed, disabled, onPress,
}: {
  dark: boolean;
  action: Mode;
  state: HomeState;
  spoken: string;
  dimmed: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const dim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(dim, { toValue: dimmed ? 0.32 : 1, duration: 350, useNativeDriver: true }).start();
  }, [dimmed, dim]);

  const active = state !== 'idle';
  const label = action === 'ask' ? COPY.buttons.askLabel : COPY.buttons.describeLabel;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.panel, { backgroundColor: dark ? color.dad.askBg : color.dad.describeBg }]}
    >
      {/* Pad each panel's content by its system-bar inset so it centers in the
          VISIBLE half (status bar over the top panel, nav bar over the bottom),
          keeping the two panels looking evenly split. */}
      <Animated.View
        style={[
          styles.panelInner,
          { opacity: dim, paddingTop: dark ? 0 : TOP_INSET, paddingBottom: dark ? BOTTOM_INSET : 0 },
        ]}
      >
        {active && <GlowBackdrop dark={dark} />}
        <View style={styles.stage}>
          <FieldStage dark={dark} action={action} state={state} spoken={spoken} />
        </View>
      </Animated.View>
    </Pressable>
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
          <ActionIcon kind={isAsk ? 'ask' : 'describe'} size={84} color={accent} strokeWidth={1.6} />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.neutral.ink },
  devGear: {
    position: 'absolute', top: TOP_INSET + 8, right: 14, zIndex: 10,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(80,80,80,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)' },
  panel: { flex: 1, overflow: 'hidden' },
  panelInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stage: { alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 28, zIndex: 2 },
  glow: { position: 'absolute', width: 320, height: 320, borderRadius: 160 },

  idleCircle: { width: 128, height: 128, borderRadius: 64, alignItems: 'center', justifyContent: 'center' },
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
