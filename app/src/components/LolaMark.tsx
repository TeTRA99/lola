// Lola "geometric" lens mark (locked logo, handoff §5 / Logo & App Icon.html):
// rounded-square primary field + white ring + primary iris + offset white
// catchlight. Rendered as SVG so it scales crisply at any size.

import Svg, { Rect, Circle } from 'react-native-svg';
import { color } from '@/theme/tokens';

type Props = {
  size?: number;
  /** Field background — defaults to brand primary. */
  bg?: string;
  /** Outer lens ring — defaults to white. */
  ring?: string;
  /** Iris — defaults to brand primary. */
  iris?: string;
};

export function LolaMark({
  size = 40,
  bg = color.primary[500],
  ring = '#FFFFFF',
  iris = color.primary[500],
}: Props) {
  // Geometry is authored on a 40×40 grid (matches the prototype LolaMark) and
  // scaled via the SVG viewBox.
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Rect width={40} height={40} rx={11} fill={bg} />
      <Circle cx={20} cy={20} r={11} fill={ring} />
      <Circle cx={20} cy={20} r={5.6} fill={iris} />
      <Circle cx={22.6} cy={17.4} r={1.9} fill="#FFFFFF" />
    </Svg>
  );
}
