import { useState, type ComponentRef, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

export const DangerColor = '#E5484D';

export type TextFieldRef = ComponentRef<typeof TextInput>;

export type TextFieldProps = Omit<TextInputProps, 'placeholder'> & {
  /** Shown inside the empty field, and read out by screen readers. */
  label: string;
  error?: string;
  ref?: Ref<TextFieldRef>;
};

const INSET = Spacing.four - Spacing.one;

/**
 * Pill-shaped field. The label sits inside the empty field, exactly where the
 * text goes, and simply gives way once you start typing: no floating, no
 * shrinking, no separate hint. An ink outline shows on focus, red on error.
 */
export function TextField({ label, error, style, onFocus, onBlur, ref, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor={error ? DangerColor : theme.textSecondary}
        selectionColor={theme.text}
        cursorColor={theme.text}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            borderColor: error ? DangerColor : focused ? theme.text : 'transparent',
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <ThemedText type="caption" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.two },
  input: {
    height: 60,
    borderWidth: 2,
    borderRadius: Radius.pill,
    paddingHorizontal: INSET,
    paddingVertical: 0,
    fontSize: 17,
  },
  error: { color: DangerColor, paddingHorizontal: INSET },
});
