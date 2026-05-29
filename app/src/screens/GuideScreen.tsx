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

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, PanResponder, useWindowDimensions,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, type CameraDevice } from 'react-native-vision-camera';
import { startGuide, updateGuide, stopGuide } from '@/adapters/guideHaptics';
import { useGuideDetection } from '@/adapters/useGuideDetection';
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

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    startGuide();
    return () => stopGuide();
  }, []);

  // Single sink for proximity from either source (mock touch or live detection).
  const applyProximity = useCallback((p: number | null) => {
    setProximity(p ?? 0);
    updateGuide(p);
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

  useEffect(() => {
    const dx = (dot.x - cx) / cx;
    const dy = (dot.y - cy) / cy;
    const dist = Math.min(1, Math.hypot(dx, dy) / Math.SQRT2);
    onProximity(1 - dist);
  }, [dot, cx, cy, onProximity]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setDot({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }),
      onPanResponderMove: (_e, g) => setDot({ x: g.moveX, y: g.moveY }),
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
  const { frameOutput, isReady, downloadProgress, error } = useGuideDetection(
    targetCocoLabel,
    onProximity,
  );

  if (!hasPermission || !device) return <CamFallback hasPermission={hasPermission} />;

  return (
    <>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive={true} outputs={[frameOutput]} />
      <View style={[styles.reticle, { left: width / 2 - 30, top: height / 2 - 30 }]} />
      {!isReady ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {error ? 'Detector error' : `Loading model… ${Math.round((downloadProgress ?? 0) * 100)}%`}
          </Text>
        </View>
      ) : null}
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
