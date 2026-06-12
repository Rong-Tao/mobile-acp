import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { PATHS } from '../theme';

type IconProps = {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 20, color = '#e7e9ee', strokeWidth = 1.6 }: IconProps) {
  const d = PATHS[name];
  if (!d) return null;
  const segments = d.split('M').filter(Boolean);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {segments.map((seg, i) => (
        <Path
          key={i}
          d={'M' + seg}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
