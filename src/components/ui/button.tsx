import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useAppearance, useTheme } from '@/hooks/use-theme';

import { Loader } from '../feedback/loader';
import { ThemedText } from './themed-text';

export type ButtonProps = {
  title: string;
  onPress: () => void;
  /** primary: solid ink. secondary: soft grey fill. ghost: outline. */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Shows the spinning mark in place of the label and blocks presses. */
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const theme = useTheme();
  const appearance = useAppearance();
  const inactive = disabled || loading;
  const primary = variant === 'primary';

  const surface: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: theme.text }
      : variant === 'secondary'
        ? { backgroundColor: theme.backgroundElement }
        : { backgroundColor: 'transparent', borderColor: theme.border, borderWidth: 1 };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        surface,
        { opacity: disabled ? 0.4 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
        style,
      ]}>
      {loading ? (
        <View>
          <Loader
            size={24}
            tone={primary ? (appearance === 'dark' ? 'onLight' : 'onDark') : 'auto'}
            label="Please wait"
          />
        </View>
      ) : (
        <ThemedText style={[styles.label, { color: primary ? theme.background : theme.text }]}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  label: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
});
