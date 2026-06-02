// Home progress card for the on-device VLM download (feat/on-device-models).
// Caregiver-facing: in local mode it stays visible from launch until the vision
// model is actually loaded, showing the real phase (downloading % → preparing →
// ready). It briefly confirms "ready" then hides, and never appears in cloud mode
// or on cached/fast launches.
//
// It tracks the VLM (the headline model preloaded at launch). The small
// voice-command model loads lazily on the first Ask — that wait is covered by the
// spoken "preparing" line in HomeScreen.run() and shown in DebugScreen.
//
// Reliability note: it keys off the adapter's lifecycle PHASE, not raw download
// progress — the executorch downloader reports progress per-file and can hit
// 100% several times, so "done" is only when the model actually finishes loading.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import * as VlmAdapter from '@/adapters/visionLLM';
import { inferenceMode } from '@/services/ModelRouter';
import { COPY } from '@/services';
import { color, fontFamily } from '@/theme/tokens';

const READY_VISIBLE_MS = 2500; // how long to show "ready" before hiding

export function ModelPrepBanner() {
  const [active] = useState(() => inferenceMode() === 'local' && VlmAdapter.canDescribeLocally());
  const [vlm, setVlm] = useState<VlmAdapter.VlmStatus>(() => VlmAdapter.getStatus());
  const [hidden, setHidden] = useState(false);
  const fill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    return VlmAdapter.subscribeStatus(setVlm);
  }, [active]);

  // Once the model is ready, show the confirmation briefly, then hide for good.
  useEffect(() => {
    if (vlm.phase === 'ready' && !hidden) {
      const t = setTimeout(() => setHidden(true), READY_VISIBLE_MS);
      return () => clearTimeout(t);
    }
  }, [vlm.phase, hidden]);

  useEffect(() => {
    const target = vlm.phase === 'downloading' ? vlm.progress : vlm.phase === 'idle' ? 0 : 1;
    Animated.timing(fill, {
      toValue: target, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: false,
    }).start();
  }, [vlm, fill]);

  if (!active || hidden) return null;

  const isReady = vlm.phase === 'ready';
  let line: string;
  let showBar = false;
  if (vlm.phase === 'error') {
    line = COPY.models.bannerError;
  } else if (isReady) {
    line = COPY.models.bannerReady;
  } else if (vlm.phase === 'downloading') {
    line = COPY.models.bannerProgress(Math.round(vlm.progress * 100));
    showBar = true;
  } else {
    // idle / preparing → loading the graph into memory.
    line = COPY.models.bannerPreparing;
  }

  return (
    <View
      style={styles.card}
      accessibilityRole="progressbar"
      accessibilityLabel={`${COPY.models.bannerTitle}. ${line}`}
    >
      <Text style={styles.title}>{isReady ? COPY.models.bannerReady : COPY.models.bannerTitle}</Text>
      {!isReady && <Text style={styles.subtitle}>{COPY.models.bannerSubtitle}</Text>}
      {showBar && (
        <View style={styles.track}>
          <Animated.View
            style={[styles.fill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
          />
        </View>
      )}
      {!isReady && <Text style={styles.statusLine}>{line}</Text>}
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
  track: {
    height: 8, borderRadius: 4, backgroundColor: 'rgba(96,110,132,0.18)',
    overflow: 'hidden', marginTop: 12,
  },
  fill: { height: 8, borderRadius: 4, backgroundColor: color.primary[500] },
  statusLine: { color: color.text.low, fontSize: 13, fontFamily: fontFamily.semibold, fontWeight: '600', marginTop: 8 },
});
