// feat/guide-me-to-it — SPIKE screen.
//
// Validates the feature's halves before full integration:
//   (1) VisionCamera v5 renders + runs in the dev client,
//   (2) the proximity haptic loop "feels" right on the Galaxy, and
//   (3) (live mode) on-device YOLO26n detection drives proximity for real.
//
// Two proximity sources, switchable with the on-screen toggle:
//   • MOCK (default): drag the dot — closeness to the center reticle drives the
//     haptics. Needs no model/camera, so the haptic feel is testable immediately.
//   • LIVE: useGuideDetection feeds real detections. UNVERIFIED ON DEVICE — wired
//     per docs + typechecked, but not yet run on hardware. The model downloads
//     only when live mode is turned on.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, PanResponder, useWindowDimensions,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, type CameraDevice } from 'react-native-vision-camera';
import { startGuide, updateGuide, stopGuide } from '@/adapters/guideHaptics';
import { useGuideDetection } from '@/adapters/useGuideDetection';
import {
  bestDetectionFor, normalizePixelBox, proximityFromBox, type RawDetection,
} from '@/adapters/objectDetection';
import { CONFIG } from '@/config';

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
  const [live, setLive] = useState(false);
  const [proximity, setProximity] = useState(0);
  const lastHudAt = useRef(0);

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    startGuide();
    return () => stopGuide();
  }, []);

  // Single sink for proximity from either source (mock touch or live detection).
  // Haptics read module state (updateGuide), so they update every frame with no
  // render. The HUD number is cosmetic — throttle it to ~6/s to avoid a
  // render-per-frame storm (which, with a fresh outputs array, can loop).
  const applyProximity = useCallback((p: number | null) => {
    updateGuide(p);
    const now = Date.now();
    if (now - lastHudAt.current > 160) {
      lastHudAt.current = now;
      setProximity(p ?? 0);
    }
  }, []);

  const locked = proximity >= CONFIG.GUIDE_LOCK_PROXIMITY;

  return (
    <View style={styles.root}>
      {live ? (
        <LiveLayer
          device={device}
          hasPermission={hasPermission}
          targetCocoLabel={targetCocoLabel}
          onProximity={applyProximity}
        />
      ) : (
        <MockLayer device={device} hasPermission={hasPermission} onProximity={applyProximity} />
      )}

      {/* HUD (dev spike — English, like DebugScreen) */}
      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.hudText}>
          Guiding to: {targetLabel} · proximity {(proximity * 100).toFixed(0)}%{locked ? ' · THERE!' : ''}
        </Text>
        <Text style={styles.hudHint}>
          {live
            ? 'LIVE on-device detection (unverified on device).'
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
  onProximity,
}: {
  device?: CameraDevice;
  hasPermission: boolean;
  onProximity: (p: number | null) => void;
}) {
  const { width, height } = useWindowDimensions();
  const cx = width / 2;
  const cy = height / 2;
  const [dot, setDot] = useState({ x: width * 0.8, y: height * 0.35 });

  // Latest center + sink in a ref so the once-created PanResponder never goes
  // stale, and we compute proximity in the handler — NOT in an effect (a
  // setState-in-effect here caused "maximum update depth exceeded" while dragging).
  const ctx = useRef({ cx, cy, onProximity });
  ctx.current = { cx, cy, onProximity };

  const report = (x: number, y: number) => {
    const c = ctx.current;
    const dx = (x - c.cx) / c.cx;
    const dy = (y - c.cy) / c.cy;
    c.onProximity(1 - Math.min(1, Math.hypot(dx, dy) / Math.SQRT2));
  };

  // Initial reading, once. Empty deps → cannot loop.
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
        <Camera style={StyleSheet.absoluteFill} device={device} isActive={true} />
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

/** LIVE proximity: on-device YOLO26n via VisionCamera frame output. */
function LiveLayer({
  device,
  hasPermission,
  targetCocoLabel,
  onProximity,
}: {
  device?: CameraDevice;
  hasPermission: boolean;
  targetCocoLabel: string | null;
  onProximity: (p: number | null) => void;
}) {
  const { width, height } = useWindowDimensions();
  const [det, setDet] = useState<{ boxes: RawDetection[]; w: number; h: number }>({ boxes: [], w: 0, h: 0 });
  const [workletErr, setWorkletErr] = useState<string | null>(null);
  const lastAt = useRef(0);

  // Each frame: drive haptics (every frame, no render) + refresh the debug
  // overlay (throttled).
  const onResult = useCallback(
    (boxes: RawDetection[], w: number, h: number) => {
      const best = bestDetectionFor(boxes, targetCocoLabel);
      onProximity(best ? proximityFromBox(normalizePixelBox(best.bbox, w, h)) : null);
      const now = Date.now();
      if (now - lastAt.current > 150) {
        lastAt.current = now;
        setDet({ boxes, w, h });
      }
    },
    [targetCocoLabel, onProximity],
  );

  const { frameOutput, isReady, downloadProgress, error } = useGuideDetection(onResult, setWorkletErr);
  // Stable identity — a fresh array each render makes VisionCamera re-init and
  // can spiral into "maximum update depth exceeded".
  const outputs = useMemo(() => [frameOutput], [frameOutput]);

  useEffect(() => {
    if (error) console.error('[guide] detector error:', error);
  }, [error]);
  const errMsg = error ? (error as { message?: string }).message ?? String(error) : null;

  if (!hasPermission || !device) return <CamFallback hasPermission={hasPermission} />;

  return (
    <>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive={true} outputs={outputs} />

      {/* Debug overlay: every detection as a box + label/score. Positions are
          best-effort (frame orientation may offset them) — the count + labels
          are what confirm detection is working. */}
      {det.w > 0 &&
        det.boxes.map((d, i) => {
          const n = normalizePixelBox(d.bbox, det.w, det.h);
          return (
            <View
              key={i}
              style={[styles.detBox, {
                left: n.x * width, top: n.y * height,
                width: n.width * width, height: n.height * height,
              }]}
            >
              <Text style={styles.detLabel}>{String(d.label)} {Math.round(d.score * 100)}%</Text>
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
                : `live: ${det.boxes.length} obj · frame ${det.w}×${det.h}`}
        </Text>
      </View>
    </>
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
  hud: { position: 'absolute', bottom: 48, left: 16, right: 16, alignItems: 'center' },
  hudText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  hudHint: { color: '#bbb', fontSize: 12, marginTop: 6, textAlign: 'center' },
  banner: {
    position: 'absolute', top: 110, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  bannerText: { color: '#fff', fontSize: 14 },
  detBox: { position: 'absolute', borderWidth: 2, borderColor: '#4ade80' },
  detLabel: {
    color: '#000', backgroundColor: '#4ade80', fontSize: 11, fontWeight: '700',
    alignSelf: 'flex-start', paddingHorizontal: 3,
  },
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
