// Mug icon for the Setup → Objects empty state (handoff objects-mug.svg).
// Ported to react-native-svg (24×24 viewBox, 1.5 stroke, round caps) so it
// scales crisply at the large empty-state size.

import Svg, { Path } from 'react-native-svg';

type Props = { size?: number; color?: string; strokeWidth?: number };

export function MugIcon({ size = 24, color = '#000', strokeWidth = 1.5 }: Props) {
  const s = {
    stroke: color,
    strokeWidth,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 8h11v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" {...s} />
      <Path d="M16 10h2.5a2.5 2.5 0 0 1 0 5H16" {...s} />
      <Path d="M8 3.5v1.8M11.5 3.5v1.8" {...s} />
    </Svg>
  );
}
