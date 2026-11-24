import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { LogoMark } from '@/components/brand';
import { Screen, ThemedText } from '@/components/ui';
import { riseIn } from '@/constants/motion-presets';
import { Spacing } from '@/constants/theme';

import { useShouldPlayEntrance } from './auth-swap';

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned to the bottom of the screen, e.g. "Already have an account?" */
  footer?: ReactNode;
};

/**
 * Shared frame for sign in and create account.
 *
 * The mark sits left-aligned a little way down, the heading and form follow,
 * and the footer is pushed to the bottom edge. The mark is deliberately static
 * (no entrance, no idle gestures) and drawn at the identical spot on both
 * screens, so the sign in <-> create account cross-fade leaves it perfectly
 * still. Only the first screen shown after welcome plays the content entrance.
 * There is no back button: the system back gesture (Android) and edge swipe
 * (iOS) return to welcome. On short screens or with the keyboard open
 * everything scrolls as one column.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const playEntrance = useShouldPlayEntrance();
  const enter = (index: number) => (playEntrance ? riseIn(index) : undefined);

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>
          <View style={styles.markRow}>
            <LogoMark size={64} />
          </View>

          <Animated.View entering={enter(0)} style={styles.heading}>
            <ThemedText style={styles.title}>{title}</ThemedText>
            {subtitle ? (
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                {subtitle}
              </ThemedText>
            ) : null}
          </Animated.View>

          <Animated.View entering={enter(1)} style={styles.form}>
            {children}
          </Animated.View>

          {footer ? (
            <Animated.View entering={enter(2)} style={styles.footer}>
              {footer}
            </Animated.View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingTop: Spacing.six + Spacing.four,
    paddingBottom: Spacing.four,
  },
  markRow: { alignItems: 'flex-start', marginBottom: Spacing.four },
  heading: { gap: Spacing.two, marginBottom: Spacing.five },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { fontSize: 16, lineHeight: 22 },
  form: { gap: Spacing.four - Spacing.one },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: 'auto',
    paddingTop: Spacing.five,
  },
});
