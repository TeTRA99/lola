// Always-visible-label text field (handoff Components/Field). The label sits
// inside the bordered box above the input; focus paints a blue ring, error
// turns the border red. Helper / error text renders below via the optional
// `hint` / `error` props.

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { color, radius, fontFamily } from '@/theme/tokens';
import { Icon } from './Icon';

type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
};

export function Field({ label, value, onChangeText, placeholder, hint, error }: Props) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? color.status.error : focused ? color.primary[500] : color.neutral.border;
  return (
    <View>
      <View
        style={[
          styles.box,
          { borderColor },
          focused && styles.boxFocused,
        ]}
      >
        <Text style={[styles.label, error && styles.labelError]}>{label}</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={color.text.low}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {error ? (
        <View style={styles.errRow}>
          <Icon name="error" size={14} color={color.status.error} />
          <Text style={styles.errText}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: color.neutral.white,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingTop: 9,
    paddingBottom: 10,
  },
  boxFocused: {
    // Approximation of the web `box-shadow: 0 0 0 3px primary50` focus ring.
    backgroundColor: color.neutral.white,
  },
  label: {
    fontSize: 11,
    fontFamily: fontFamily.semibold,
    fontWeight: '600',
    color: color.text.medium,
    marginBottom: 2,
  },
  labelError: { color: color.status.error },
  input: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    lineHeight: 22,
    color: color.text.high,
    padding: 0,
  },
  hint: { fontSize: 12.5, color: color.text.low, marginTop: 6, paddingLeft: 2 },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  errText: { color: color.status.error, fontSize: 13, fontFamily: fontFamily.semibold, fontWeight: '600' },
});
