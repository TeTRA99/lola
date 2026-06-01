// Caregiver primary CTA — full-width, brand-blue, optional trailing arrow.
// `danger` swaps to the error palette; `dad` bumps size/radius for the
// low-vision surface (used by Home permission recovery).

import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { color, radius, fontFamily, shadow } from '@/theme/tokens';
import { Icon } from './Icon';

type Props = {
  label: string;
  onPress: () => void;
  arrow?: boolean;
  disabled?: boolean;
  danger?: boolean;
  /** Leading icon name (e.g. `add` on "+ Add object"). */
  leadingIcon?: React.ComponentProps<typeof Icon>['name'];
  dad?: boolean;
  style?: ViewStyle;
};

export function PrimaryButton({
  label, onPress, arrow = false, disabled, danger, leadingIcon, dad, style,
}: Props) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        dad && styles.dad,
        {
          backgroundColor: disabled
            ? color.primary.disabled
            : danger
              ? (pressed ? color.status.errorPressed : color.status.error)
              : (pressed ? color.primary[700] : color.primary[500]),
        },
        !disabled && shadow('sm'),
        style,
      ]}
    >
      {leadingIcon && <Icon name={leadingIcon} size={dad ? 24 : 22} color="#fff" />}
      <Text style={[styles.label, dad && styles.labelDad]} numberOfLines={1}>{label}</Text>
      {arrow && !disabled && (
        <View style={styles.arrow}><Icon name="forward" size={dad ? 24 : 22} color="#fff" /></View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 56,
  },
  dad: { borderRadius: radius.xl, paddingVertical: 22, minHeight: 88 },
  label: {
    color: '#fff',
    fontFamily: fontFamily.bold,
    fontWeight: '700',
    fontSize: 18,
  },
  labelDad: { fontSize: 22 },
  arrow: { marginLeft: -2 },
});
