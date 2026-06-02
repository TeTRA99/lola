// feat/guide-me-to-it — SPIKE screen.
//
// Validates the feature's halves: (1) VisionCamera v5 runs in the dev client,
// (2) the proximity haptic loop feels right, (3) on-device YOLO26n detection
// drives proximity for a CHOSEN object.
//
// Two proximity sources via the on-screen toggle:
//   • MOCK (default): drag the dot — closeness to center drives the haptics.
//   • LIVE: pick a target label (chips); the haptics home in on that one object.
//     The real feature passes the target from the Describe step; the spike lets
//     you choose it. Boxes/preview are dev-only — the end user never sees them.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, PanResponder, ScrollView, AppState, Animated, Easing,
  useWindowDimensions, Platform,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, type CameraDevice } from 'react-native-vision-camera';
import { CameraView, Camera as ExpoCamera } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { speak } from '@/adapters/tts';
import { COPY } from '@/services/CopyModule';
import * as Settings from '@/services/Settings';
import { color, fontFamily } from '@/theme/tokens';
import { startGuide, updateGuide, stopGuide, pulseGuide } from '@/adapters/guideHaptics';
import { activateKeepAwake, releaseKeepAwake } from '@/adapters/keepAwake';
import { useGuideDetection } from '@/adapters/useGuideDetection';
import { useCloudGuideDetection, type CapturedFrame, type CloudGuideHint } from '@/adapters/useCloudGuideDetection';
import {
  bestDetectionFor, frameBoxToScreen, normalizePixelBox, proximityFromBox, screenSpaceDims,
  type RawDetection,
} from '@/adapters/objectDetection';
import { CONFIG } from '@/config';

// Curated, stable chip list so the picker doesn't flicker with detections.
const TARGET_OPTIONS = [
  'cup', 'bowl', 'bottle', 'chair', 'book', 'laptop',
  'remote', 'keyboard', 'spoon', 'knife', 'tv', 'sports ball',
];

export function GuideScreen({
  targetLabel = 'the object',
  targetCocoLabel = null,
  cloudQuery = null,
  refImageUri = null,
  onClose,
}: {
  targetLabel?: string;
  targetCocoLabel?: string | null;
  // Cloud "guide me to it" spike: the open-vocabulary query to ground (set by the
  // voice flow when guideBackend === 'cloud'). Present → use the cloud layer.
  cloudQuery?: string | null;
  // Saved-object reference photo to send when targeting === 'reference'.
  refImageUri?: string | null;
  onClose: () => void;
}) {
  const cloud = !!cloudQuery;
  // "Guiding" = the real (blind) flow, whether the target is an on-device COCO
  // label or a cloud open-vocab query. Gates the audio cues + branded overlay.
  const guiding = !!targetCocoLabel || cloud;
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [live, setLive] = useState(!!targetCocoLabel); // real flow opens live; dev opens mock
  // null = target not detected in frame; number = how centered (0..1).
  // Starts null (nothing seen yet) so "creo que lo veo" only fires on a real
  // detection, not on open.
  const [proximity, setProximity] = useState<number | null>(null);
  const [liveTarget, setLiveTarget] = useState<string | null>(targetCocoLabel);
  const lastHudAt = useRef(0);
  const lastSaidAt = useRef(0); // throttle the cloud "¡Ahí está!" so TTS doesn't back up
  const spottedRef = useRef(false); // said the tentative "creo que lo veo"
  const foundRef = useRef(false);   // said the affirmative "¡ahí está!"
  const lastFoundAt = useRef(0);    // timestamp of the last "¡ahí está!" (cooldown)
  const notFoundRef = useRef(false); // said "no la encuentro"
  const preparingRef = useRef(false); // said the "me estoy preparando" first-load cue
  const lostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeenRef = useRef(Date.now()); // last time the target was in view (idle check-in clock)
  // On-device model readiness (downloads on first use — can take minutes).
  const [model, setModel] = useState({ isReady: false, downloadProgress: 0 });
  // Becomes true when the "Buscando… movéme despacio" line is announced (after
  // the intro hint). The no-find countdown starts from here — NOT from model
  // readiness — so the intro narration doesn't eat the real searching window.
  const [searchArmed, setSearchArmed] = useState(false);

  // Real flow (target known) = blind UX: no preview/boxes, branded screen,
  // tap-to-exit. Dev (no target) keeps the debug preview + chips.
  const blind = guiding;
  // Dev builds (SHOW_DEV_TOOLS): show the cloud camera + box instead of the blind
  // overlay so we can see what the model sees/finds. Never on in production.
  const devPreview = cloud && CONFIG.SHOW_DEV_TOOLS;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const handleExit = useCallback(() => onCloseRef.current(), []);

  // Keep the camera active only while the app is foregrounded — otherwise the
  // OS disables the camera and VisionCamera throws "Camera is disabled / fatal
  // Camera error" on background→foreground.
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    // The cloud path does NOT run the continuous beat loop — it fires one discrete
    // pulseGuide() per poll result (see applyProximity), so a buzz always means a
    // fresh result. Only the on-device detector drives the continuous Geiger loop.
    if (!cloud) startGuide();
    return () => stopGuide();
  }, []);

  // iOS-only: hold the screen on for the hands-free guide session (the user holds
  // the phone up and follows haptics, never touching it, so iOS's idle timer dims
  // and locks mid-search). Scoped to iOS deliberately — on Android the active
  // VisionCamera preview already keeps the screen on, so this was never an issue
  // there, and we don't want to change the tested Android behavior. Released on
  // unmount so the rest of the app keeps normal auto-lock.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void activateKeepAwake('guide');
    return () => { void releaseKeepAwake('guide'); };
  }, []);

  // Diagnostics: surface model load state to Metro (blind flow hides the banner).
  useEffect(() => {
    console.log('[guide] model isReady:', model.isReady, 'downloadProgress:', model.downloadProgress);
  }, [model.isReady, model.downloadProgress]);

  // Blind-user audio: announce the search once on open (real flow only). The
  // first time the homing flow is ever used, explain the vibration first.
  useEffect(() => {
    if (!guiding) return;
    void (async () => {
      if (cloud) {
        // Cloud is a different interaction than the continuous Geiger — point at an
        // area, wait for the buzz (one answer per area), move on. Give matching
        // instructions and skip the Geiger-specific first-use hint.
        setSearchArmed(true);
        void speak(COPY.guide.searchingCloud(targetLabel));
        return;
      }
      if (!(await Settings.getBool(Settings.KEYS.guideHintSeen, false))) {
        await Settings.setBool(Settings.KEYS.guideHintSeen, true);
        await speak(COPY.onboarding.guideHint);
      }
      // Arm the no-find window now — the user can start searching as this plays.
      setSearchArmed(true);
      void speak(COPY.guide.searching(targetLabel));
    })();
  }, []);

  // While the on-device model is still loading (first-use download can take
  // minutes), tell the user it's preparing so it doesn't seem broken.
  useEffect(() => {
    if (!guiding || model.isReady) return;
    const t = setTimeout(() => {
      if (!model.isReady && !preparingRef.current) {
        preparingRef.current = true;
        void speak(COPY.guide.preparing);
      }
    }, CONFIG.GUIDE_PREPARING_MS);
    return () => clearTimeout(t);
  }, [model.isReady, targetCocoLabel]);

  // "No la encuentro" — starts only once the model is ready AND we've announced
  // the search (searchArmed), so neither the model download nor the intro
  // narration eats into the real searching window.
  useEffect(() => {
    if (!guiding || !model.isReady || !searchArmed) return;
    const t = setTimeout(() => {
      if (!spottedRef.current && !notFoundRef.current) {
        notFoundRef.current = true;
        void speak(COPY.guide.notFound(targetLabel));
      }
    }, cloud ? CONFIG.GUIDE_CLOUD_NOT_FOUND_MS : CONFIG.GUIDE_NOT_FOUND_MS);
    return () => clearTimeout(t);
  }, [model.isReady, targetCocoLabel, searchArmed]);

  // Tiered audio (real flow only):
  //  • detected in frame (any proximity) → tentative "creo que lo veo" once
  //  • centered enough (reachable threshold) → affirmative "¡ahí está!" once
  // Re-arm "found" when moving away; re-arm "spotted" only after the object has
  // been LOST for ~1.5s (so detector flicker doesn't re-trigger it).
  const locked = (proximity ?? 0) >= CONFIG.GUIDE_LOCK_PROXIMITY; // HUD "THERE!"
  useEffect(() => {
    // Cloud handles its own per-result confirmation in applyProximity (it speaks
    // "¡Ahí está!" on every positive); skip the on-device once-only tiered cues.
    if (!guiding || cloud) return;
    if (proximity === null) {
      if (!lostTimer.current) {
        lostTimer.current = setTimeout(() => {
          // Re-arm only "found" on a brief loss; keep "creo que lo veo" said once
          // per session so detector flicker doesn't repeat it (it fired 3× on the
          // Redmi as detection stabilized).
          foundRef.current = false;
          lostTimer.current = null;
        }, 1500);
      }
      return;
    }
    if (lostTimer.current) { clearTimeout(lostTimer.current); lostTimer.current = null; }
    if (!spottedRef.current) {
      spottedRef.current = true;
      void speak(COPY.guide.spotted);
    }
    // "¡ahí está!" fires when reachable, but only once per re-arm AND no sooner
    // than the cooldown — otherwise small wobbles across the threshold make Lola
    // repeat it back-to-back. After the cooldown, a genuine lose-and-refind says
    // it again (which is what we want).
    if (
      proximity >= CONFIG.GUIDE_FOUND_PROXIMITY &&
      !foundRef.current &&
      Date.now() - lastFoundAt.current >= CONFIG.GUIDE_FOUND_COOLDOWN_MS
    ) {
      foundRef.current = true;
      lastFoundAt.current = Date.now();
      void speak(COPY.guide.found);
      // No auto-close — the "found" line already tells the user to tap when done,
      // and a blind user must never be dropped silently. The idle check-in below
      // is the only follow-up; tap is the only exit.
    } else if (proximity < CONFIG.GUIDE_REARM_PROXIMITY) {
      foundRef.current = false;
    }
  }, [proximity, targetCocoLabel, handleExit, cloud]);

  // Idle check-in — the search never closes itself; instead, after a long stretch
  // with the target not in view, Lola reassures + reminds how to leave, and keeps
  // doing so on the same interval. Any time the target is in frame, the clock
  // resets (so we never talk over active homing). Tap is the only exit.
  useEffect(() => {
    if (proximity !== null) lastSeenRef.current = Date.now();
  }, [proximity]);

  useEffect(() => {
    if (!guiding || !model.isReady || !searchArmed) return;
    const id = setInterval(() => {
      if (Date.now() - lastSeenRef.current >= CONFIG.GUIDE_CHECKIN_IDLE_MS) {
        lastSeenRef.current = Date.now(); // re-arm so it repeats on the interval
        void speak(foundRef.current ? COPY.guide.checkinFound : COPY.guide.checkin);
      }
    }, CONFIG.GUIDE_CHECKIN_TICK_MS);
    return () => clearInterval(id);
  }, [targetCocoLabel, model.isReady, searchArmed]);

  useEffect(() => () => {
    if (lostTimer.current) clearTimeout(lostTimer.current);
  }, []);

  // Cloud: one discrete buzz per poll result + update proximity (for audio/HUD)
  // immediately — polls are ~2.5s apart, so no throttle needed.
  // On-device: feed the continuous beat loop every frame; throttle the HUD number.
  const applyProximity = useCallback((p: number | null) => {
    if (cloud) {
      pulseGuide(p);
      setProximity(p);
      // Speaking is handled by handleCloudHint (it has the box + landmark to build
      // a "where" cue); applyProximity only drives the haptic + proximity state.
      return;
    }
    updateGuide(p);
    const now = Date.now();
    if (now - lastHudAt.current > 160) {
      lastHudAt.current = now;
      setProximity(p);
    }
  }, [cloud]);

  // Cloud-only: on each positive poll, speak a short "where" cue — which way to
  // point (from the box's frame position) + any landmark the model reported.
  // Throttled (2s) so consecutive polls can't queue overlapping speech.
  const handleCloudHint = useCallback((hint: CloudGuideHint | null) => {
    if (!hint) return;
    const now = Date.now();
    if (now - lastSaidAt.current <= 2000) return;
    lastSaidAt.current = now;
    const cx = hint.box.x + hint.box.width / 2;
    const cy = hint.box.y + hint.box.height / 2;
    const dx = cx < 0.4 ? 'left' : cx > 0.6 ? 'right' : null;
    const dy = cy < 0.4 ? 'up' : cy > 0.6 ? 'down' : null;
    void speak(COPY.guide.locate({ dx, dy, near: hint.near }));
  }, []);

  const hudTarget = live ? liveTarget ?? 'best object' : targetLabel;
  const status: GuideStatus = !model.isReady
    ? 'preparing'
    : proximity === null
      ? 'searching'
      : proximity >= CONFIG.GUIDE_FOUND_PROXIMITY ? 'found' : 'spotted';

  return (
    <View style={styles.root}>
      {cloud ? (
        <CloudGuideLayer
          query={cloudQuery as string}
          refImageUri={refImageUri}
          active={appActive}
          debug={devPreview}
          onProximity={applyProximity}
          onHint={handleCloudHint}
          onModelState={setModel}
        />
      ) : live ? (
        <LiveLayer
          device={device}
          hasPermission={hasPermission}
          active={appActive}
          blind={blind}
          target={liveTarget}
          setTarget={setLiveTarget}
          onProximity={applyProximity}
          onModelState={setModel}
        />
      ) : (
        <MockLayer device={device} hasPermission={hasPermission} active={appActive} onProximity={applyProximity} />
      )}

      {blind && devPreview ? (
        // Dev cloud preview: camera + box shown by CloudGuideLayer; just an exit.
        <Pressable style={styles.close} onPress={handleExit} hitSlop={16}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      ) : blind ? (
        // Real (blind) flow: branded screen over the hidden camera, tap to exit.
        <BlindOverlay targetLabel={targetLabel} status={status} onExit={handleExit} />
      ) : (
        <>
          {/* Dev HUD + controls */}
          <View style={styles.hud} pointerEvents="none">
            <Text style={styles.hudText}>
              Guiding to: {hudTarget} · proximity {((proximity ?? 0) * 100).toFixed(0)}%{locked ? ' · THERE!' : ''}
            </Text>
            <Text style={styles.hudHint}>
              {live
                ? 'LIVE on-device detection. Pick a target chip below.'
                : 'MOCK: drag the dot to the center to feel the pattern.'}
            </Text>
          </View>
          <Pressable style={styles.toggle} onPress={() => setLive(v => !v)} hitSlop={12}>
            <Text style={styles.toggleText}>{live ? 'Use mock' : 'Use live detection'}</Text>
          </Pressable>
          <Pressable style={styles.close} onPress={handleExit} hitSlop={16}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

type GuideStatus = 'preparing' | 'searching' | 'spotted' | 'found';

/** Branded, preview-less screen for the real (blind/low-vision) flow. The whole
 *  screen is the exit target. Camera + boxes are hidden (camera runs underneath
 *  in LiveLayer for detection). A gentle pulse + status text give low-vision
 *  users something to see instead of a black "broken" screen. */
function BlindOverlay({
  targetLabel,
  status,
  onExit,
}: {
  targetLabel: string;
  status: GuideStatus;
  onExit: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const accent = status === 'found' ? '#22d3ee' : status === 'spotted' ? '#4ade80' : 'rgba(255,255,255,0.5)';
  const title = status === 'preparing'
    ? COPY.guide.preparingLegend
    : status === 'found' ? COPY.guide.here
      : status === 'spotted' ? COPY.guide.seeingIt
        : COPY.guide.looking(targetLabel);
  const homing = status === 'found' || status === 'spotted';
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, homing ? 1.3 : 1.12] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <Pressable style={styles.blindRoot} onPress={onExit} accessibilityRole="button" accessibilityLabel={COPY.guide.tapHint}>
      <Animated.View style={[styles.blindPulse, { borderColor: accent, transform: [{ scale }], opacity }]} />
      <Text style={styles.blindTitle}>{title}</Text>
      <Text style={styles.blindHint}>{COPY.guide.tapHint}</Text>
    </Pressable>
  );
}

/** CLOUD proximity: re-localizes an arbitrary (open-vocab) object via OpenRouter
 *  every ~2.5s and feeds the latest box's proximity into the same haptic loop.
 *  Mounts an expo-camera CameraView (NOT VisionCamera — no frame processor here;
 *  the two never mount together since this is an alternate layer). */
function CloudGuideLayer({
  query,
  refImageUri,
  active,
  debug = false,
  onProximity,
  onHint,
  onModelState,
}: {
  query: string;
  refImageUri: string | null;
  active: boolean;
  // Dev builds: show the camera preview + the latest box + a status banner so we
  // can SEE what the model is looking at and finding (the real flow hides all of it).
  debug?: boolean;
  onProximity: (p: number | null) => void;
  onHint: (hint: CloudGuideHint | null) => void;
  onModelState: (s: { isReady: boolean; downloadProgress: number }) => void;
}) {
  const { width, height } = useWindowDimensions();
  const camRef = useRef<CameraView>(null);
  const [perm, setPerm] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [ready, setReady] = useState(false); // camera stream is live
  const [refBase64, setRefBase64] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const p = await ExpoCamera.requestCameraPermissionsAsync();
      setPerm(p.granted ? 'granted' : 'denied');
    })();
  }, []);

  // No model download for the cloud path — report "ready" right away so the
  // GuideScreen skips "me estoy preparando" and arms the search immediately.
  useEffect(() => { onModelState({ isReady: true, downloadProgress: 1 }); }, [onModelState]);

  // Resolve the reference photo to a downscaled base64 ONCE (targeting=reference).
  useEffect(() => {
    if (!refImageUri) { setRefBase64(null); return; }
    let alive = true;
    void (async () => {
      try {
        const out = await manipulateAsync(
          refImageUri,
          [{ resize: { width: CONFIG.GUIDE_CLOUD_MAX_DIM } }],
          { compress: CONFIG.GUIDE_CLOUD_JPEG_QUALITY, format: SaveFormat.JPEG, base64: true },
        );
        if (alive) setRefBase64(out.base64 ?? null);
      } catch (e) {
        console.log('[guide-cloud] ref image load failed:', e);
        if (alive) setRefBase64(null);
      }
    })();
    return () => { alive = false; };
  }, [refImageUri]);

  const capture = useCallback(async (): Promise<CapturedFrame | null> => {
    const ref = camRef.current;
    if (!ref || !ready) return null;
    try {
      type Shot = { uri: string; width: number; height: number };
      type Cap = CameraView & {
        takePictureAsync(o: { base64: boolean; quality: number; skipProcessing: boolean; shutterSound?: boolean }): Promise<Shot | undefined>;
      };
      // skipProcessing:false so the JPEG is oriented UPRIGHT (matching the preview).
      // With skipProcessing:true the still is the sensor's landscape buffer + an EXIF
      // tag, so the model analyzes a sideways image and its box coords come back
      // rotated relative to the portrait preview.
      const shot = await (ref as Cap).takePictureAsync({
        base64: false, quality: CONFIG.GUIDE_CLOUD_JPEG_QUALITY, skipProcessing: false, shutterSound: false,
      });
      if (!shot) return null;
      // Center-crop the upright still to the PREVIEW's aspect ratio: the full-screen
      // CameraView 'cover'-crops the still's sides, so without this the model sees a
      // wider FOV than the user does and "where" cues / the overlay drift. After the
      // crop, model-space == preview-space == overlay-space.
      const targetAspect = width / height; // portrait → < 1
      const stillAspect = shot.width / shot.height;
      const crop = stillAspect > targetAspect
        ? { originX: Math.round((shot.width - shot.height * targetAspect) / 2), originY: 0, width: Math.round(shot.height * targetAspect), height: shot.height }
        : { originX: 0, originY: Math.round((shot.height - shot.width / targetAspect) / 2), width: shot.width, height: Math.round(shot.width / targetAspect) };
      const longer = Math.max(crop.width, crop.height);
      const ratio = longer > CONFIG.GUIDE_CLOUD_MAX_DIM ? CONFIG.GUIDE_CLOUD_MAX_DIM / longer : 1;
      const actions: Parameters<typeof manipulateAsync>[1] = [{ crop }];
      if (ratio < 1) actions.push({ resize: { width: Math.round(crop.width * ratio), height: Math.round(crop.height * ratio) } });
      const out = await manipulateAsync(shot.uri, actions, {
        compress: CONFIG.GUIDE_CLOUD_JPEG_QUALITY, format: SaveFormat.JPEG, base64: true,
      });
      if (!out.base64) return null;
      return { base64: out.base64, width: out.width, height: out.height };
    } catch (e) {
      console.log('[guide-cloud] capture failed:', e);
      return null;
    }
  }, [ready]);

  const cg = useCloudGuideDetection({
    query,
    refBase64,
    active: active && perm === 'granted' && ready,
    capture,
    onProximity,
    onHint,
  });

  if (perm !== 'granted') return <CamFallback hasPermission={perm !== 'denied'} />;

  // Dev preview: the box is normalized to the captured (upright) frame; the preview
  // is 'cover'-fit, so this is approximate but enough to see what's being found.
  const b = cg.lastBox;
  return (
    <>
      <CameraView
        ref={camRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        active={active}
        onCameraReady={() => setReady(true)}
        onMountError={(e) => { console.log('[guide-cloud] mount error:', e); setReady(false); }}
      />
      {debug && (
        <>
          {b && (
            <View
              style={[styles.detBoxActive, {
                left: b.x * width, top: b.y * height, width: b.width * width, height: b.height * height,
              }]}
            >
              <Text style={[styles.detLabel, styles.detLabelActive]}>
                {query} {Math.round(cg.lastConfidence * 100)}%
              </Text>
            </View>
          )}
          <View style={[styles.reticle, { left: width / 2 - 30, top: height / 2 - 30 }]} />
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              {cg.model.replace(/^.*\//, '')} · "{query}"{refBase64 ? ' +ref' : ''} · poll {cg.polls}
              {cg.lastLatencyMs != null ? ` · ${cg.lastLatencyMs}ms` : ''}
              {cg.lastError ? ` · ERR ${cg.lastError}` : cg.lastFound ? ' · FOUND' : ' · …'}
            </Text>
            {cg.lastFound && cg.lastNear ? (
              <Text style={styles.bannerRaw} numberOfLines={2}>near: {cg.lastNear}</Text>
            ) : null}
            {!cg.lastFound && cg.lastRaw ? (
              <Text style={styles.bannerRaw} numberOfLines={3}>raw: {cg.lastRaw}</Text>
            ) : null}
          </View>
        </>
      )}
    </>
  );
}

/** MOCK proximity: a draggable dot; closeness to center drives the haptics. */
function MockLayer({
  device,
  hasPermission,
  active,
  onProximity,
}: {
  device?: CameraDevice;
  hasPermission: boolean;
  active: boolean;
  onProximity: (p: number | null) => void;
}) {
  const { width, height } = useWindowDimensions();
  const cx = width / 2;
  const cy = height / 2;
  const [dot, setDot] = useState({ x: width * 0.8, y: height * 0.35 });

  const ctx = useRef({ cx, cy, onProximity });
  ctx.current = { cx, cy, onProximity };

  const report = (x: number, y: number) => {
    const c = ctx.current;
    const dx = (x - c.cx) / c.cx;
    const dy = (y - c.cy) / c.cy;
    c.onProximity(1 - Math.min(1, Math.hypot(dx, dy) / Math.SQRT2));
  };

  useEffect(() => {
    report(dot.x, dot.y);
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        setDot({ x: pageX, y: pageY });
        report(pageX, pageY);
      },
      onPanResponderMove: (_e, g) => {
        setDot({ x: g.moveX, y: g.moveY });
        report(g.moveX, g.moveY);
      },
    }),
  ).current;

  return (
    <>
      {hasPermission && device ? (
        <Camera style={StyleSheet.absoluteFill} device={device} isActive={active} onError={onCameraError} />
      ) : (
        <CamFallback hasPermission={hasPermission} />
      )}
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
        <View style={[styles.reticle, { left: cx - 30, top: cy - 30 }]} />
        <View style={[styles.dot, { left: dot.x - 14, top: dot.y - 14 }]} />
      </View>
    </>
  );
}

/** LIVE proximity: on-device YOLO26n homing in on the chosen target label. */
function LiveLayer({
  device,
  hasPermission,
  active,
  blind,
  target,
  setTarget,
  onProximity,
  onModelState,
}: {
  device?: CameraDevice;
  hasPermission: boolean;
  active: boolean;
  blind: boolean;
  target: string | null;
  setTarget: (t: string | null) => void;
  onProximity: (p: number | null) => void;
  onModelState: (s: { isReady: boolean; downloadProgress: number }) => void;
}) {
  const { width, height } = useWindowDimensions();
  const [det, setDet] = useState<{ boxes: RawDetection[]; w: number; h: number; best: RawDetection | null }>({
    boxes: [], w: 0, h: 0, best: null,
  });
  const [workletErr, setWorkletErr] = useState<string | null>(null);
  const lastAt = useRef(0);
  const lastLogAt = useRef(0);

  // Diagnostics: the blind flow hides the on-screen banner, so log what the
  // detector is actually doing (frames arriving? labels? errors?) to Metro.
  useEffect(() => {
    console.log('[guide] LiveLayer mounted — hasPermission:', hasPermission, 'device:', device?.id ?? 'NONE', 'active:', active);
  }, [hasPermission, device, active]);
  useEffect(() => {
    if (workletErr) console.log('[guide] FRAME-PROCESSOR ERROR:', workletErr);
  }, [workletErr]);

  const onResult = useCallback(
    (boxes: RawDetection[], w: number, h: number) => {
      const best = bestDetectionFor(boxes, target);
      // Proximity = how centered the object is in the camera's (portrait) view.
      // executorch returns screen-space coords, so normalize by the portrait
      // screen-space dims (min,max), not the native landscape frame dims.
      const ss = screenSpaceDims(w, h);
      onProximity(best ? proximityFromBox(normalizePixelBox(best.bbox, ss.w, ss.h)) : null);
      const now = Date.now();
      // Throttled detection log (~1.5s) so we can see if frames flow and what
      // the model sees vs. the target we're homing on.
      if (now - lastLogAt.current > 1500) {
        lastLogAt.current = now;
        console.log(
          `[guide] frame ${w}x${h} · ${boxes.length} det · target=${target ?? 'any'} · best=${best ? 'YES' : 'no'} · ` +
          boxes.slice(0, 6).map(b => `${String(b.label)}:${b.score.toFixed(2)}`).join(', '),
        );
      }
      if (now - lastAt.current > 120) {
        lastAt.current = now;
        setDet({ boxes, w, h, best });
      }
    },
    [target, onProximity, width, height],
  );

  const { frameOutput, isReady, downloadProgress, error, detectorLabel } = useGuideDetection(onResult, setWorkletErr);
  const outputs = useMemo(() => [frameOutput], [frameOutput]);

  // Report model readiness up so the screen can show "preparando…" + gate audio.
  useEffect(() => {
    onModelState({ isReady, downloadProgress: downloadProgress ?? 0 });
  }, [isReady, downloadProgress, onModelState]);

  useEffect(() => {
    if (error) console.error('[guide] detector error:', error);
  }, [error]);
  const errMsg = error ? (error as { message?: string }).message ?? String(error) : null;

  // DEBUG: raw normalized frame-centroid of the tracked object (0..1). When the
  // phone physically points straight at the object, this should read ~0.50,0.50.
  const bnSS = screenSpaceDims(det.w, det.h);
  const bn = det.best ? normalizePixelBox(det.best.bbox, bnSS.w, bnSS.h) : null;
  const aimReadout = bn ? ` · aim(${(bn.x + bn.width / 2).toFixed(2)},${(bn.y + bn.height / 2).toFixed(2)})` : '';

  if (!hasPermission || !device) return <CamFallback hasPermission={hasPermission} />;

  return (
    <>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive={active} outputs={outputs} onError={onCameraError} />

      {/* Blind/real flow hides all of this — the camera runs only for detection;
          GuideScreen draws the branded BlindOverlay on top. */}
      {!blind && (
      <>
      {/* Debug overlay (frame is landscape; back camera rotated 90° CW). The
          actively-tracked target is highlighted. Positions are best-effort. */}
      {det.w > 0 &&
        det.boxes.map((d, i) => {
          const r = frameBoxToScreen(d.bbox, det.w, det.h, width, height);
          const isBest = det.best != null && d === det.best;
          return (
            <View
              key={i}
              style={[isBest ? styles.detBoxActive : styles.detBox, {
                left: r.left, top: r.top, width: r.width, height: r.height,
              }]}
            >
              <Text style={[styles.detLabel, isBest && styles.detLabelActive]}>
                {String(d.label)} {Math.round(d.score * 100)}%
              </Text>
            </View>
          );
        })}

      <View style={[styles.reticle, { left: width / 2 - 30, top: height / 2 - 30 }]} />

      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          {errMsg
            ? `model err: ${errMsg}`
            : workletErr
              ? `frame err: ${workletErr}`
              : !isReady
                ? `Loading ${detectorLabel}… ${Math.round((downloadProgress ?? 0) * 100)}%`
                : `${detectorLabel} · tracking: ${target ?? 'best'} · ${det.boxes.length} obj${aimReadout}`}
        </Text>
      </View>

      {/* Target picker — pick one object to home in on. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chips}
        contentContainerStyle={styles.chipsContent}
      >
        <Chip label="Any" active={target === null} onPress={() => setTarget(null)} />
        {TARGET_OPTIONS.map(t => (
          <Chip key={t} label={t} active={target === t} onPress={() => setTarget(t)} />
        ))}
      </ScrollView>
      </>
      )}
    </>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

// VisionCamera emits native camera errors here. The common ones —
// "device/camera-is-disabled" and the generic fatal "Encountered a fatal Camera
// error" — fire when the OS reclaims the camera (app backgrounded, screen lock,
// or a device-policy/MDM restriction) and recover on their own once the app
// foregrounds and `isActive` flips back on. Without an onError prop VisionCamera
// logs them via console.error (the red ERROR spam in Metro); swallow them with a
// quiet log instead so they don't look like a crash.
function onCameraError(e: Error) {
  const code = (e as { code?: string }).code;
  console.log('[guide] camera error (transient, recovers on foreground):', code ?? '', e.message);
}

function CamFallback({ hasPermission }: { hasPermission: boolean }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.noCam]}>
      <Text style={styles.noCamText}>
        {hasPermission ? 'No back camera found' : 'Waiting for camera permission…'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  // Branded preview-less overlay (real/blind flow)
  blindRoot: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: color.neutral.ink,
    alignItems: 'center', justifyContent: 'center', gap: 28,
  },
  blindPulse: {
    width: 150, height: 150, borderRadius: 75, borderWidth: 3,
  },
  blindTitle: {
    color: '#fff', fontSize: 30, fontFamily: fontFamily.extrabold, fontWeight: '800',
    textAlign: 'center', paddingHorizontal: 32, letterSpacing: -0.5,
  },
  blindHint: {
    position: 'absolute', bottom: 56, left: 24, right: 24,
    color: 'rgba(255,255,255,0.5)', fontSize: 15, fontFamily: fontFamily.medium, textAlign: 'center',
  },
  noCam: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  noCamText: { color: '#888', fontSize: 16 },
  reticle: {
    position: 'absolute', width: 60, height: 60, borderRadius: 30,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
  },
  dot: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1A73E8', borderWidth: 2, borderColor: '#fff',
  },
  hud: { position: 'absolute', bottom: 36, left: 16, right: 16, alignItems: 'center' },
  hudText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  hudHint: { color: '#bbb', fontSize: 12, marginTop: 6, textAlign: 'center' },
  banner: {
    position: 'absolute', top: 110, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  bannerText: { color: '#fff', fontSize: 14 },
  bannerRaw: { color: '#fbbf24', fontSize: 11, marginTop: 4, maxWidth: 320 },
  detBox: { position: 'absolute', borderWidth: 2, borderColor: 'rgba(74,222,128,0.7)' },
  detBoxActive: { position: 'absolute', borderWidth: 3, borderColor: '#22d3ee' },
  detLabel: {
    color: '#000', backgroundColor: 'rgba(74,222,128,0.7)', fontSize: 11, fontWeight: '700',
    alignSelf: 'flex-start', paddingHorizontal: 3,
  },
  detLabelActive: { backgroundColor: '#22d3ee' },
  chips: { position: 'absolute', bottom: 88, left: 0, right: 0, maxHeight: 40 },
  chipsContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  chipActive: { backgroundColor: '#22d3ee', borderColor: '#22d3ee' },
  chipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#000' },
  toggle: {
    position: 'absolute', top: 48, left: 16,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
  },
  toggleText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  close: {
    position: 'absolute', top: 48, right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
  },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
