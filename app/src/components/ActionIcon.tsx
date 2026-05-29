// Home button icons (handoff assets/icons): an eye for Describir and a
// question-bubble for Preguntar — replacing the old camera/mic glyphs. Ported
// from the design SVGs (24×24 viewBox, 1.7 stroke, round caps) to
// react-native-svg so they scale crisply at the large home size.

import Svg, { Path, Circle } from 'react-native-svg';

type Props = {
  kind: 'describe' | 'ask';
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function ActionIcon({ kind, size = 24, color = '#000', strokeWidth = 1.7 }: Props) {
  const stroke = {
    stroke: color,
    strokeWidth,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {kind === 'describe' ? (
        <>
          <Path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z" {...stroke} />
          <Circle cx={12} cy={12} r={3.1} {...stroke} />
        </>
      ) : (
        <>
          <Path d="M20.5 11.3a8.2 8.2 0 0 1-11.7 7.4L3.5 20.2l1.5-5.1A8.2 8.2 0 1 1 20.5 11.3z" {...stroke} />
          <Path d="M9.8 9.4a2.3 2.3 0 0 1 4.4.9c0 1.6-2.1 2-2.1 3.4" {...stroke} />
          <Path d="M12 16.4v.05" {...stroke} />
        </>
      )}
    </Svg>
  );
}
