// Home progress card for the Guide's on-device object detector. Shown only when
// the caregiver has picked a "Detection quality" level whose model isn't on the
// device yet (HomeScreen gates this on isModelDownloaded). It loads that model so
// the download happens here — on Home, with visible progress — instead of lazily
// on the first Guide. Once ready it marks the model downloaded, shows a brief
// "ready" confirmation, then calls onReady so Home drops it (freeing the graph;
// the Guide reloads it from the on-disk cache, no re-download).
//
// Unlike ModelPrepBanner (VLM, local-mode only), this is inference-mode-agnostic:
// the Guide detector is always on-device.

import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useObjectDetection } from 'react-native-executorch/legacy';
import { presetForLevel, currentDetectionLevel, markModelDownloaded } from '@/adapters/detectionPresets';
import { COPY } from '@/services';
import { color, fontFamily } from '@/theme/tokens';

const READY_VISIBLE_MS = 1800;

export function DetectionPrepBanner({ onReady }: { onReady: () => void }) {
  // Resolve the chosen level's model once on mount (Home remounts on return from
  // Setup, so this picks up a freshly-changed level).
  const preset = useMemo(() => presetForLevel(currentDetectionLevel()), []);
  const det = useObjectDetection({ model: useMemo(() => preset.model(), [preset]) });
  const fill = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(false);

  useEffect(() => {
    if (!det.isReady || doneRef.current) return;
    doneRef.current = true;
    markModelDownloaded(preset.modelName);
    const t = setTimeout(onReady, READY_VISIBLE_MS); // show "ready" briefly, then hand back
    return () => clearTimeout(t);
  }, [det.isReady, preset.modelName, onReady]);

  useEffect(() => {
    Animated.timing(fill, {
      toValue: det.isReady ? 1 : (det.downloadProgress ?? 0),
      duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false,
    }).start();
  }, [det.isReady, det.downloadProgress, fill]);

  const pct = Math.round((det.downloadProgress ?? 0) * 100);
  const line = det.isReady ? COPY.models.detectorReady : COPY.models.bannerProgress(pct);

  return (
    <View style={styles.card} accessibilityRole="progressbar" accessibilityLabel={`${COPY.models.detectorTitle}. ${line}`}>
      <Text style={styles.title}>{det.isReady ? COPY.models.detectorReady : COPY.models.detectorTitle}</Text>
      {!det.isReady && <Text style={styles.subtitle}>{COPY.models.detectorSubtitle}</Text>}
      {!det.isReady && (
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        </View>
      )}
      {!det.isReady && <Text style={styles.statusLine}>{line}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.primary[50],
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: color.neutral.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 12,
  },
  title: { color: color.text.high, fontSize: 17, fontFamily: fontFamily.bold, fontWeight: '700' },
  subtitle: { color: color.text.low, fontSize: 14, fontFamily: fontFamily.medium, marginTop: 4, lineHeight: 19 },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(96,110,132,0.18)', overflow: 'hidden', marginTop: 12 },
  fill: { height: 8, borderRadius: 4, backgroundColor: color.primary[500] },
  statusLine: { color: color.text.low, fontSize: 13, fontFamily: fontFamily.semibold, fontWeight: '600', marginTop: 8 },
});
