import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon } from './icon';
import { ThemedText } from './themed-text';

type FieldShellProps = {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
};

/** Label above, hint/error below. Shared by inputs and pickers. */
export function FieldShell({ label, hint, error, optional, children }: FieldShellProps) {
  const theme = useTheme();
  return (
    <View style={styles.shell}>
      <View style={styles.labelRow}>
        <ThemedText style={styles.label}>{label}</ThemedText>
        {optional ? (
          <ThemedText type="caption" themeColor="textTertiary">
            Optional
          </ThemedText>
        ) : null}
      </View>
      {children}
      {error ? (
        <ThemedText type="caption" style={{ color: theme.danger }} accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

export type FormFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

/** Filled, rounded input with a label above. Multi-line grows to fit. */
export function FormField({ label, hint, error, optional, multiline, style, onFocus, onBlur, ref, ...rest }: FormFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={theme.textTertiary}
        selectionColor={theme.text}
        cursorColor={theme.text}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            borderColor: error ? theme.danger : focused ? theme.text : 'transparent',
          },
          style,
        ]}
        {...rest}
      />
    </FieldShell>
  );
}

type SelectFieldProps = {
  label: string;
  value?: string | null;
  placeholder: string;
  onPress: () => void;
  hint?: string;
  error?: string;
  optional?: boolean;
  leading?: ReactNode;
  disabled?: boolean;
};

/** Looks like an input; opens a sheet or picker. */
export function SelectField({ label, value, placeholder, onPress, hint, error, optional, leading, disabled }: SelectFieldProps) {
  const theme = useTheme();
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ?? placeholder}`}
        style={({ pressed }) => [
          styles.input,
          styles.select,
          {
            backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
            borderColor: error ? theme.danger : 'transparent',
            opacity: disabled ? 0.5 : 1,
          },
        ]}>
        {leading}
        <ThemedText
          style={[styles.selectText, { color: value ? theme.text : theme.textTertiary }]}
          numberOfLines={1}>
          {value ?? placeholder}
        </ThemedText>
        <Icon name="chevron-down" size={16} tone="textSecondary" />
      </Pressable>
    </FieldShell>
  );
}

/** Rounded search box with a clear button. */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  autoFocus,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
      <Icon name="search" size={16} tone="textSecondary" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        selectionColor={theme.text}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        style={[styles.searchInput, { color: theme.text }]}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
          <Icon name="x" size={16} tone="textSecondary" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { gap: Spacing.two },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  input: {
    minHeight: 52,
    borderRadius: Radius.md,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multiline: { minHeight: 120, paddingTop: 14 },
  select: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  selectText: { flex: 1, fontSize: 16, lineHeight: 22 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 48,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
  },
  searchInput: { flex: 1, fontSize: 16, height: '100%' },
});
