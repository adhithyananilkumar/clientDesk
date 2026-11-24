import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { LogoMark, Wordmark } from '@/components/brand';
import { Screen, ThemedText } from '@/components/ui';
import { Spacing } from '@/constants/theme';

type AuthLayoutProps = { title: string; subtitle: string; children: ReactNode };

/** Shared frame for the sign-in and sign-up screens. */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <LogoMark size={56} />
            <Wordmark size={26} />
          </View>
          <View style={styles.heading}>
            <ThemedText type="title">{title}</ThemedText>
            <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
          </View>
          <View style={styles.form}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', gap: Spacing.five, paddingVertical: Spacing.five },
  brand: { alignItems: 'center', gap: Spacing.two },
  heading: { gap: Spacing.two },
  form: { gap: Spacing.three },
});
