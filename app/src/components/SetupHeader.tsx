// Caregiver screen header: optional back chevron (left), centered title, and an
// optional right-hand link ("Done"). Bottom hairline. Adds a top inset so the
// title clears the status bar / notch.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, fontFamily } from '@/theme/tokens';
import { TOP_INSET } from '@/theme/insets';
import { Icon } from './Icon';

type Props = {
  title: string;
  onBack?: () => void;
  onRightPress?: () => void;
  rightLabel?: string;
};

export function SetupHeader({ title, onBack, onRightPress, rightLabel }: Props) {
  return (
    <View style={[styles.wrap, { paddingTop: TOP_INSET + 6 }]}>
      <View style={styles.bar}>
        {onBack ? (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.side}>
            <Icon name="back" size={24} color={color.primary[500]} />
          </Pressable>
        ) : (
          <View style={styles.side} />
        )}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {rightLabel ? (
          <Pressable onPress={onRightPress} accessibilityRole="button" style={styles.side}>
            <Text style={styles.rightLabel}>{rightLabel}</Text>
          </Pressable>
        ) : (
          <View style={styles.side} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: color.neutral.border,
    backgroundColor: color.neutral.canvas,
  },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  side: { minWidth: 52, justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 19, fontFamily: fontFamily.extrabold, fontWeight: '800', color: color.text.high },
  rightLabel: { textAlign: 'right', color: color.primary[500], fontSize: 16, fontFamily: fontFamily.bold, fontWeight: '700' },
});
