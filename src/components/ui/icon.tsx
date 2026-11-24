import Octicons from '@expo/vector-icons/Octicons';
import type { ComponentProps } from 'react';

import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconName = ComponentProps<typeof Octicons>['name'];

type IconProps = {
  name: IconName;
  size?: number;
  /** A raw colour, or a theme token. Defaults to the text colour. */
  color?: string;
  tone?: ThemeColor;
};

/** GitHub's Octicons: crisp, consistent line icons used across the app. */
export function Icon({ name, size = 18, color, tone }: IconProps) {
  const theme = useTheme();
  return <Octicons name={name} size={size} color={color ?? theme[tone ?? 'text']} />;
}
