// Lightweight touch slider — no native dependency (so it hot-reloads).
//
// Uses PanResponder + the ABSOLUTE touch X (gestureState.moveX) minus the
// track's measured window position. (Using nativeEvent.locationX is jumpy,
// because it re-bases to whichever child — fill/thumb — is under the finger as
// you drag.) The track's left/width are measured on layout and refreshed on
// grant, so the thumb tracks the finger smoothly.

import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { color, fontFamily } from '@/theme/tokens';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onComplete?: (v: number) => void;
  format?: (v: number) => string;
};

export function Slider({ label, value, min, max, step, onChange, onComplete, format }: Props) {
  const [, force] = useState(0);
  const viewRef = useRef<View>(null);
  const trackLeft = useRef(0);
  const trackWidth = useRef(1);

  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const setFromAbsX = useRef((absX: number) => {});
  setFromAbsX.current = (absX: number) => {
    const w = trackWidth.current || 1;
    const x = Math.max(0, Math.min(w, absX - trackLeft.current));
    const raw = min + (x / w) * (max - min);
    const snapped = Number((Math.round(raw / step) * step).toFixed(2));
    if (snapped !== valueRef.current) onChangeRef.current(snapped);
  };

  const measure = () => {
    viewRef.current?.measureInWindow((x, _y, w) => {
      trackLeft.current = x;
      if (w) trackWidth.current = w;
    });
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (_e, g) => { measure(); setFromAbsX.current(g.x0); },
      onPanResponderMove: (_e, g) => setFromAbsX.current(g.moveX),
      onPanResponderRelease: () => onCompleteRef.current?.(valueRef.current),
    }),
  ).current;

  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{format ? format(value) : value.toFixed(2)}</Text>
      </View>
      <View
        ref={viewRef}
        style={styles.hit}
        onLayout={() => { measure(); force(n => n + 1); }}
        {...pan.panHandlers}
      >
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct * 100}%` }]} />
        </View>
        <View style={[styles.thumb, { left: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  label: { fontSize: 14, fontFamily: fontFamily.semibold, fontWeight: '600', color: color.text.high },
  value: { fontSize: 14, fontFamily: fontFamily.mono, color: color.text.medium },
  hit: { height: 40, justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: color.neutral.sunken, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: color.primary[500], borderRadius: 3 },
  thumb: {
    position: 'absolute', width: 26, height: 26, borderRadius: 13, marginLeft: -13,
    backgroundColor: color.neutral.white, borderWidth: 2, borderColor: color.primary[500],
    top: 7,
  },
});
