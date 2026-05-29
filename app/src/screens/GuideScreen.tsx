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
  View, Text, StyleSheet, Pressable, PanResponder, ScrollView, AppState, useWindowDimensions,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, type CameraDevice } from 'react-native-vision-camera';
import { speak } from '@/adapters/tts';
import { COPY } from '@/services/CopyModule';
import { startGuide, updateGuide, stopGuide } from '@/adapters/guideHaptics';
import { useGuideDetection } from '@/adapters/useGuideDetection';
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
  onClose,
}: {
  targetLabel?: string;
  targetCocoLabel?: string | null;
  onClose: () => void;
}) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [live, setLive] = useState(!!targetCocoLabel); // real flow opens live; dev opens mock
  // null = target not detected in frame; number = how centered (0..1).
  // Starts null (nothing seen yet) so "creo que lo veo" only fires on a real
  // detection, not on open.
  const [proximity, setProximity] = useState<number | null>(null);
  const [liveTarget, setLiveTarget] = useState<string | null>(targetCocoLabel);
  const lastHudAt = useRef(0);
  const spottedRef = useRef(false); // said the tentative "creo que lo veo"
  const foundRef = useRef(false);   // said the affirmative "¡ahí está!"
  const notFoundRef = useRef(false); // said "no la encuentro"
  const lostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    startGuide();
    return () => stopGuide();
  }, []);

  // Blind-user audio: announce the search once on open (real flow only).
  useEffect(() => {
    if (targetCocoLabel) void speak(COPY.guide.searching(targetLabel));
  }, []);

  // If the target is never spotted within the window, it's probably not in this
  // scene — say so once (we can't navigate the user elsewhere, just tell them).
  useEffect(() => {
    if (!targetCocoLabel) return;
    const t = setTimeout(() => {
      if (!spottedRef.current && !notFoundRef.current) {
        notFoundRef.current = true;
        void speak(COPY.guide.notFound(targetLabel));
      }
    }, CONFIG.GUIDE_NOT_FOUND_MS);
    return () => clearTimeout(t);
  }, []);

  // Tiered audio (real flow only):
  //  • detected in frame (any proximity) → tentative "creo que lo veo" once
  //  • centered enough (reachable threshold) → affirmative "¡ahí está!" once
  // Re-arm "found" when moving away; re-arm "spotted" only after the object has
  // been LOST for ~1.5s (so detector flicker doesn't re-trigger it).
  const locked = (proximity ?? 0) >= CONFIG.GUIDE_LOCK_PROXIMITY; // HUD "THERE!"
  useEffect(() => {
    if (!targetCocoLabel) return;
    if (proximity === null) {
      if (!lostTimer.current) {
        lostTimer.current = setTimeout(() => {
          spottedRef.current = false;
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
    if (proximity >= CONFIG.GUIDE_FOUND_PROXIMITY && !foundRef.current) {
      foundRef.current = true;
      void speak(COPY.guide.found);
    } else if (proximity < CONFIG.GUIDE_REARM_PROXIMITY) {
      foundRef.current = false;
    }
  }, [proximity, targetCocoLabel]);

  useEffect(() => () => { if (lostTimer.current) clearTimeout(lostTimer.current); }, []);

  // Haptics update every frame via module state (no render); HUD number throttled.
  const applyProximity = useCallback((p: number | null) => {
    updateGuide(p);
    const now = Date.now();
    if (now - lastHudAt.current > 160) {
      lastHudAt.current = now;
      setProximity(p);
    }
  }, []);

  const hudTarget = live ? liveTarget ?? 'best object' : targetLabel;

  return (
    <View style={styles.root}>
      {live ? (
        <LiveLayer
          device={device}
          hasPermission={hasPermission}
          active={appActive}
          target={liveTarget}
          setTarget={setLiveTarget}
          onProximity={applyProximity}
        />
      ) : (
        <MockLayer device={device} hasPermission={hasPermission} active={appActive} onProximity={applyProximity} />
      )}

      {/* HUD (dev spike — English, like DebugScreen) */}
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
      <Pressable style={styles.close} onPress={onClose} hitSlop={16}>
        <Text style={styles.closeText}>Close</Text>
      </Pressable>
    </View>
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
        <Camera style={StyleSheet.absoluteFill} device={device} isActive={active} />
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
  target,
  setTarget,
  onProximity,
}: {
  device?: CameraDevice;
  hasPermission: boolean;
  active: boolean;
  target: string | null;
  setTarget: (t: string | null) => void;
  onProximity: (p: number | null) => void;
}) {
  const { width, height } = useWindowDimensions();
  const [det, setDet] = useState<{ boxes: RawDetection[]; w: number; h: number; best: RawDetection | null }>({
    boxes: [], w: 0, h: 0, best: null,
  });
  const [workletErr, setWorkletErr] = useState<string | null>(null);
  const lastAt = useRef(0);

  const onResult = useCallback(
    (boxes: RawDetection[], w: number, h: number) => {
      const best = bestDetectionFor(boxes, target);
      // Proximity = how centered the object is in the camera's (portrait) view.
      // executorch returns screen-space coords, so normalize by the portrait
      // screen-space dims (min,max), not the native landscape frame dims.
      const ss = screenSpaceDims(w, h);
      onProximity(best ? proximityFromBox(normalizePixelBox(best.bbox, ss.w, ss.h)) : null);
      const now = Date.now();
      if (now - lastAt.current > 120) {
        lastAt.current = now;
        setDet({ boxes, w, h, best });
      }
    },
    [target, onProximity, width, height],
  );

  const { frameOutput, isReady, downloadProgress, error } = useGuideDetection(onResult, setWorkletErr);
  const outputs = useMemo(() => [frameOutput], [frameOutput]);

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
      <Camera style={StyleSheet.absoluteFill} device={device} isActive={active} outputs={outputs} />

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
                ? `Loading model… ${Math.round((downloadProgress ?? 0) * 100)}%`
                : `tracking: ${target ?? 'best'} · ${det.boxes.length} obj${aimReadout}`}
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
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
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
