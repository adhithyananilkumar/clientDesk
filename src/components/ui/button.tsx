import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useAppearance, useTheme } from '@/hooks/use-theme';

import { Loader } from '../feedback/loader';
import { Icon, type IconName } from './icon';
import { ThemedText } from './themed-text';

export type ButtonProps = {
  title: string;
  onPress: () => void;
  /** primary: solid ink. secondary: soft grey fill. ghost: outline. danger: red text on soft red. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'lg' | 'md' | 'sm';
  icon?: IconName;
  /** Shows the spinning mark in place of the label and blocks presses. */
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

const HEIGHT = { lg: 56, md: 46, sm: 36 } as const;
const FONT = { lg: 17, md: 15, sm: 14 } as const;

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  loading,
  disabled,
  style,
  accessibilityHint,
}: ButtonProps) {
  const theme = useTheme();
  const appearance = useAppearance();
  const inactive = disabled || loading;
  const primary = variant === 'primary';

  const surface: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: theme.text }
      : variant === 'secondary'
        ? { backgroundColor: theme.backgroundElement }
        : variant === 'danger'
          ? { backgroundColor: theme.dangerSoft }
          : { backgroundColor: 'transparent', borderColor: theme.borderStrong, borderWidth: 1 };

  const color = primary ? theme.background : variant === 'danger' ? theme.danger : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      // Small buttons still get a 44pt touch target.
      hitSlop={size === 'sm' ? { top: 4, bottom: 4 } : undefined}
      style={({ pressed }) => [
        styles.base,
        { minHeight: HEIGHT[size], paddingHorizontal: size === 'sm' ? Spacing.three : Spacing.four },
        surface,
        { opacity: disabled ? 0.4 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
        style,
      ]}>
      {loading ? (
        <View>
          <Loader
            size={size === 'lg' ? 24 : 18}
            tone={primary ? (appearance === 'dark' ? 'onLight' : 'onDark') : 'auto'}
            label="Please wait"
          />
        </View>
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={FONT[size]} color={color} /> : null}
          <ThemedText style={[styles.label, { fontSize: FONT[size], color }]} numberOfLines={1}>
            {title}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { lineHeight: 22, fontWeight: '600' },
});
