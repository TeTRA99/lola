// Setup list row: rounded thumbnail + title/subtitle + edit / delete buttons.
// Thumbnail is a real reference photo when available, else a soft tinted tile.

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, fontFamily } from '@/theme/tokens';
import { Icon } from './Icon';

type Props = {
  title: string;
  subtitle?: string;
  /** When set, shows a clock glyph before the subtitle (object "last seen"). */
  seenIcon?: boolean;
  thumbUri?: string | null;
  onEdit: () => void;
  onDelete: () => void;
};

export function ListRow({ title, subtitle, seenIcon, thumbUri, onEdit, onDelete }: Props) {
  return (
    <View style={styles.row}>
      {thumbUri ? (
        <Image source={{ uri: thumbUri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Icon name="photo" size={20} color={color.text.low} />
        </View>
      )}
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <View style={styles.subRow}>
            {seenIcon && <Icon name="lastSeen" size={13} color={color.text.low} />}
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          </View>
        ) : null}
      </View>
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${title}`}
        style={styles.editBtn}
      >
        <Icon name="edit" size={18} color={color.text.medium} />
      </Pressable>
      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${title}`}
        style={styles.deleteBtn}
      >
        <Icon name="delete" size={18} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: color.neutral.white,
    borderWidth: 1,
    borderColor: color.neutral.border,
    borderRadius: radius.lg - 2,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: color.neutral.sunken },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontFamily: fontFamily.bold, fontWeight: '700', fontSize: 16, color: color.text.high },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  subtitle: { flex: 1, fontSize: 13, fontFamily: fontFamily.medium, color: color.text.medium },
  editBtn: {
    width: 44, height: 40, borderRadius: radius.sm + 1,
    borderWidth: 1, borderColor: color.neutral.border, backgroundColor: color.neutral.white,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtn: {
    width: 44, height: 40, borderRadius: radius.sm + 1,
    backgroundColor: color.status.error,
    alignItems: 'center', justifyContent: 'center',
  },
});
