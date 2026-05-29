// Lightweight touch slider — no native dependency (so it hot-reloads). Drag or
// tap anywhere on the track to set the value; `onChange` fires continuously and
// `onComplete` fires on release (use it to trigger a preview).

import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, fontFamily } from '@/theme/tokens';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onComplete?: (v: number) => void;
  /** Optional formatter for the value readout (e.g. "1.0×"). */
  format?: (v: number) => string;
};

export function Slider({ label, value, min, max, step, onChange, onComplete, format }: Props) {
  const [width, setWidth] = useState(1);
  const latest = useRef(value);
  latest.current = value;

  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));

  const setFromX = (x: number) => {
    const clamped = Math.max(0, Math.min(width, x));
    const raw = min + (clamped / width) * (max - min);
    const snapped = Math.round(raw / step) * step;
    const v = Number(snapped.toFixed(2));
    if (v !== latest.current) onChange(v);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{format ? format(value) : value.toFixed(2)}</Text>
      </View>
      <View
        style={styles.hit}
        onLayout={e => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={e => setFromX(e.nativeEvent.locationX)}
        onResponderMove={e => setFromX(e.nativeEvent.locationX)}
        onResponderRelease={() => onComplete?.(latest.current)}
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
  hit: { height: 36, justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: color.neutral.sunken, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: color.primary[500], borderRadius: 3 },
  thumb: {
    position: 'absolute', width: 24, height: 24, borderRadius: 12, marginLeft: -12,
    backgroundColor: color.neutral.white, borderWidth: 2, borderColor: color.primary[500],
    top: 6,
  },
});
