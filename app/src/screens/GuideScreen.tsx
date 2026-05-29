// feat/guide-me-to-it — SPIKE screen.
//
// v0 validates the two independent spikes before the YOLO model exists:
//   (1) VisionCamera v5 renders + runs in the dev client, and
//   (2) the proximity haptic loop "feels" right on the Galaxy.
//
// Proximity is currently MOCK: drag the dot — its closeness to the center
// reticle drives the haptics. Swap the mock for
// `proximityFromBox(detection.box)` (objectDetection.ts) once the on-device
// detector is wired to a runOnFrame worklet. No model/detection is wired yet.

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, PanResponder, useWindowDimensions,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { startGuide, updateGuide, stopGuide } from '@/adapters/guideHaptics';
import { CONFIG } from '@/config';

export function GuideScreen({
  targetLabel = 'the object',
  onClose,
}: {
  targetLabel?: string;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const cx = width / 2;
  const cy = height / 2;

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  // Mock target (screen px). Starts off-center so there's somewhere to home to.
  const [dot, setDot] = useState({ x: width * 0.8, y: height * 0.35 });
  const [proximity, setProximity] = useState(0);

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  // Drive the haptic loop for the lifetime of the screen.
  useEffect(() => {
    startGuide();
    return () => stopGuide();
  }, []);

  // Recompute proximity whenever the mock dot moves. (Real version: feed
  // proximityFromBox(detection.box) here instead.)
  useEffect(() => {
    const dx = (dot.x - cx) / cx; // -1..1
    const dy = (dot.y - cy) / cy;
    const dist = Math.min(1, Math.hypot(dx, dy) / Math.SQRT2);
    const p = 1 - dist;
    setProximity(p);
    updateGuide(p);
  }, [dot, cx, cy]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setDot({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }),
      onPanResponderMove: (_e, g) => setDot({ x: g.moveX, y: g.moveY }),
    }),
  ).current;

  const locked = proximity >= CONFIG.GUIDE_LOCK_PROXIMITY;

  return (
    <View style={styles.root}>
      {hasPermission && device ? (
        <Camera style={StyleSheet.absoluteFill} device={device} isActive={true} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noCam]}>
          <Text style={styles.noCamText}>
            {hasPermission ? 'No back camera found' : 'Waiting for camera permission…'}
          </Text>
        </View>
      )}

      {/* Touch layer drives the MOCK target. */}
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
        <View style={[styles.reticle, { left: cx - 30, top: cy - 30 }, locked && styles.reticleLocked]} />
        <View style={[styles.dot, { left: dot.x - 14, top: dot.y - 14 }]} />
      </View>

      {/* HUD (dev spike — English, like DebugScreen) */}
      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.hudText}>
          Guiding to: {targetLabel} · proximity {(proximity * 100).toFixed(0)}%{locked ? ' · THERE!' : ''}
        </Text>
        <Text style={styles.hudHint}>
          SPIKE: drag the dot to the center to feel the pattern (mock — no detection).
        </Text>
      </View>

      <Pressable style={styles.close} onPress={onClose} hitSlop={16}>
        <Text style={styles.closeText}>Close</Text>
      </Pressable>
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
  reticleLocked: { borderColor: '#4ade80', borderWidth: 4 },
  dot: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1A73E8', borderWidth: 2, borderColor: '#fff',
  },
  hud: { position: 'absolute', bottom: 48, left: 16, right: 16, alignItems: 'center' },
  hudText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  hudHint: { color: '#bbb', fontSize: 12, marginTop: 6, textAlign: 'center' },
  close: {
    position: 'absolute', top: 48, right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
  },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
