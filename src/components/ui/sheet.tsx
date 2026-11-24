import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Gutter, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';
import { ThemedText } from './themed-text';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Bottom sheet: dimmed backdrop, rounded panel that slides up.
 * The modal stays mounted until the exit animation has played.
 */
export function Sheet({ visible, onClose, title, subtitle, children, footer }: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  // Mount immediately on open; unmount only after the exit animation.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) return;
    const timer = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {visible ? (
        <View style={styles.root}>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={StyleSheet.absoluteFill}>
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            />
          </Animated.View>
          <Animated.View
            entering={SlideInDown.springify().damping(22).stiffness(220)}
            exiting={SlideOutDown.duration(200)}
            style={[styles.panel, { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.three }]}>
            <View style={[styles.grabber, { backgroundColor: theme.borderStrong }]} />
            {title ? (
              <View style={styles.head}>
                <ThemedText style={styles.title} accessibilityRole="header">
                  {title}
                </ThemedText>
                {subtitle ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                    {subtitle}
                  </ThemedText>
                ) : null}
              </View>
            ) : null}
            <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" bounces={false}>
              {children}
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}

export type SheetOption<T> = {
  value: T;
  label: string;
  description?: string;
  icon?: IconName;
  iconTone?: ThemeColor;
  leading?: ReactNode;
  destructive?: boolean;
};

/** One row in a sheet. Selected rows get a check mark. */
export function SheetRow<T>({
  option,
  selected,
  onPress,
  multi,
}: {
  option: SheetOption<T>;
  selected?: boolean;
  onPress: () => void;
  multi?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? 'checkbox' : 'button'}
      accessibilityState={{ selected, checked: multi ? selected : undefined }}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.backgroundElement : 'transparent' }]}>
      {option.leading ??
        (option.icon ? (
          <View style={[styles.rowIcon, { backgroundColor: theme.backgroundElement }]}>
            <Icon
              name={option.icon}
              size={16}
              color={option.destructive ? theme.danger : option.iconTone ? theme[option.iconTone] : theme.text}
            />
          </View>
        ) : null)}
      <View style={styles.rowText}>
        <ThemedText style={[styles.rowLabel, option.destructive && { color: theme.danger }]} numberOfLines={1}>
          {option.label}
        </ThemedText>
        {option.description ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.rowDescription} numberOfLines={2}>
            {option.description}
          </ThemedText>
        ) : null}
      </View>
      {multi ? (
        <View
          style={[
            styles.check,
            { borderColor: selected ? theme.text : theme.borderStrong, backgroundColor: selected ? theme.text : 'transparent' },
          ]}>
          {selected ? <Icon name="check" size={13} color={theme.background} /> : null}
        </View>
      ) : selected ? (
        <Icon name="check" size={18} />
      ) : null}
    </Pressable>
  );
}

type OptionSheetProps<T> = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  options: SheetOption<T>[];
  value?: T | null;
  onSelect: (value: T) => void;
  footer?: ReactNode;
};

/** Pick one value. Closes on selection. */
export function OptionSheet<T>({ visible, onClose, title, subtitle, options, value, onSelect, footer }: OptionSheetProps<T>) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={subtitle} footer={footer}>
      {options.map((option, index) => (
        <SheetRow
          key={String(option.value ?? index)}
          option={option}
          selected={value !== undefined && option.value === value}
          onPress={() => {
            onSelect(option.value);
            onClose();
          }}
        />
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  grabber: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  head: { paddingHorizontal: Gutter, paddingTop: Spacing.three, paddingBottom: Spacing.two, gap: 4 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { fontWeight: '400' },
  scroll: { flexGrow: 0 },
  body: { paddingVertical: Spacing.two },
  footer: { paddingHorizontal: Gutter, paddingTop: Spacing.two, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: Gutter, paddingVertical: 10 },
  rowIcon: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  rowDescription: { fontWeight: '400' },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
