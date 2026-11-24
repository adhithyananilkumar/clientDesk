import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type WordmarkProps = Omit<TextProps, 'children'> & { size?: number };

/** "Client" in a medium weight, "Desk" in a light, softer grey: the product name lockup. */
export function Wordmark({ size = 32, style, ...rest }: WordmarkProps) {
  const theme = useTheme();

  return (
    <Text
      accessibilityRole="header"
      style={[{ fontSize: size, lineHeight: size * 1.25, letterSpacing: -size * 0.02 }, style]}
      {...rest}>
      <Text style={{ color: theme.text, fontWeight: '600' }}>Client</Text>
      <Text style={{ color: theme.textSecondary, fontWeight: '300' }}>Desk</Text>
    </Text>
  );
}
