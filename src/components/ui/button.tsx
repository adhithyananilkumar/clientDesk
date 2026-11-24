import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Loader } from '../feedback/loader';
import { ThemedText } from './themed-text';

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  /** Shows the spinning mark in place of the label and blocks presses. */
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const primary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary
          ? { backgroundColor: theme.text }
          : { backgroundColor: 'transparent', borderColor: theme.border, borderWidth: 1 },
        { opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {loading ? (
        <View>
          <Loader size={26} tone={primary ? (theme.text === '#FFFFFF' ? 'onLight' : 'onDark') : 'auto'} label="Please wait" />
        </View>
      ) : (
        <ThemedText
          type="small"
          style={[styles.label, { color: primary ? theme.background : theme.text }]}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  label: { fontSize: 16, fontWeight: '600' },
});
