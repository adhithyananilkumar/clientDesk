import { router } from 'expo-router';
import type { ComponentRef, ReactNode, RefObject } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { IconButton } from './primitives';
import { ThemedText } from './themed-text';

type HeaderProps = {
  title?: string;
  subtitle?: string;
  /** Show a back (or close) button on the left. */
  back?: boolean | 'close';
  onBack?: () => void;
  /** Buttons on the right of the top bar. */
  actions?: ReactNode;
  /** Something before the title row, e.g. a workspace switcher. */
  leading?: ReactNode;
  large?: boolean;
};

/** Top bar + big bold title, like a native large-title header. */
export function PageHeader({ title, subtitle, back, onBack, actions, leading, large = true }: HeaderProps) {
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  const hasBar = back || actions || leading;
  return (
    <View style={styles.header}>
      {hasBar ? (
        <View style={styles.bar}>
          <View style={styles.barLeft}>
            {back ? (
              <IconButton
                icon={back === 'close' ? 'x' : 'arrow-left'}
                onPress={goBack}
                label={back === 'close' ? 'Close' : 'Back'}
                filled
              />
            ) : null}
            {leading}
          </View>
          <View style={styles.barRight}>{actions}</View>
        </View>
      ) : null}
      {title ? (
        <View style={styles.titleBlock}>
          <ThemedText
            accessibilityRole="header"
            style={large ? styles.titleLarge : styles.title}
            numberOfLines={2}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

type PageProps = HeaderProps & {
  children: ReactNode;
  /** Pinned under the scroll area (e.g. a save button or composer). */
  footer?: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  /** Render without the header (for screens that draw their own). */
  bare?: boolean;
  scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null>;
};

/** Standard app screen: safe area, header, scrollable content, optional footer. */
export function Page({
  children,
  footer,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
  bare,
  scrollRef,
  ...header
}: PageProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const body = (
    <>
      {bare ? null : <PageHeader {...header} />}
      {children}
    </>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.column, { paddingTop: insets.top }]}>
        {scroll ? (
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: footer ? Spacing.four : insets.bottom + Spacing.five },
              contentStyle,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.textSecondary} />
              ) : undefined
            }>
            {body}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.content, contentStyle]}>{body}</View>
        )}
        {footer ? (
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, Spacing.three), borderTopColor: theme.border, backgroundColor: theme.background },
            ]}>
            {footer}
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  flex: { flex: 1 },
  content: { paddingHorizontal: Gutter },
  header: { paddingTop: Spacing.two, paddingBottom: Spacing.three, gap: Spacing.three },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  barLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexShrink: 1 },
  barRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  titleBlock: { gap: Spacing.one },
  titleLarge: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.8 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { fontSize: 15, lineHeight: 21 },
  footer: { paddingHorizontal: Gutter, paddingTop: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.two },
});
