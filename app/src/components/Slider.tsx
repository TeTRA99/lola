// Lightweight touch slider — no native dependency (so it hot-reloads).
// PanResponder drives it so a drag is claimed cleanly even inside a ScrollView
// (no jerky hand-off). `onChange` fires continuously during the drag and
// `onComplete` fires on release (use it to trigger a preview).

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
  const [width, setWidth] = useState(1);

  // Refs so the (once-created) PanResponder always sees fresh values/callbacks.
  const widthRef = useRef(1);
  widthRef.current = width;
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const setFromX = useRef((x: number) => {});
  setFromX.current = (x: number) => {
    const w = widthRef.current || 1;
    const clamped = Math.max(0, Math.min(w, x));
    const raw = min + (clamped / w) * (max - min);
    const snapped = Math.round(raw / step) * step;
    const v = Number(snapped.toFixed(2));
    if (v !== valueRef.current) onChangeRef.current(v);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      // Don't let the parent ScrollView reclaim the gesture mid-drag.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: e => setFromX.current(e.nativeEvent.locationX),
      onPanResponderMove: e => setFromX.current(e.nativeEvent.locationX),
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
        style={styles.hit}
        onLayout={e => setWidth(e.nativeEvent.layout.width)}
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
