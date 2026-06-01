// Thin wrapper over Ionicons. Screens reference icons by the semantic name map
// in tokens (`describe`, `ask`, `settings`, …) rather than raw glyph names, so
// swapping the icon for a concept happens in one place.

import { Ionicons } from '@expo/vector-icons';
import { iconNames, type IconName } from '@/theme/tokens';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  style?: React.ComponentProps<typeof Ionicons>['style'];
};

export function Icon({ name, size = 24, color = '#000', style }: Props) {
  return (
    <Ionicons
      name={iconNames[name] as React.ComponentProps<typeof Ionicons>['name']}
      size={size}
      color={color}
      style={style}
    />
  );
}
