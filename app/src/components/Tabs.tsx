// Segmented control on a sunken track. Active pill = white + small shadow.
// Used for Objects / Rooms in Setup.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, fontFamily, shadow } from '@/theme/tokens';
import { Icon } from './Icon';

export type TabItem<K extends string> = {
  key: K;
  label: string;
  icon: React.ComponentProps<typeof Icon>['name'];
};

type Props<K extends string> = {
  value: K;
  onChange: (k: K) => void;
  items: TabItem<K>[];
};

export function Tabs<K extends string>({ value, onChange, items }: Props<K>) {
  return (
    <View style={styles.track}>
      {items.map((it) => {
        const active = value === it.key;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.tab, active && [styles.tabActive, shadow('sm')]]}
          >
            <Icon name={it.icon} size={18} color={active ? color.text.high : color.text.medium} />
            <Text style={[styles.label, { color: active ? color.text.high : color.text.medium }]}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: color.neutral.sunken,
    padding: 5,
    borderRadius: radius.md + 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radius.sm + 1,
  },
  tabActive: { backgroundColor: color.neutral.white },
  label: { fontFamily: fontFamily.bold, fontWeight: '700', fontSize: 15.5 },
});
