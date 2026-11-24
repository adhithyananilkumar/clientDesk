import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Button, FormField, Icon, Page, ThemedText } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useAuth } from '../auth-provider';

const emailSchema = z.string().trim().pipe(z.email('Enter a valid email address'));

export function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { sendPasswordReset } = useAuth();
  const theme = useTheme();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | undefined>();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    setBusy(true);
    const result = await sendPasswordReset(parsed.data);
    setBusy(false);
    if (result.error) setError(result.error);
    else setSentTo(parsed.data);
  }

  if (sentTo) {
    return (
      <Page back title="Check your inbox" subtitle={`We sent a reset link to ${sentTo}. Open it on this device to choose a new password.`}>
        <View style={[styles.notice, { backgroundColor: theme.successSoft }]}>
          <Icon name="mail" size={18} tone="success" />
          <ThemedText type="small" style={{ color: theme.success, flex: 1 }}>
            The link expires in one hour. Check spam if it doesn’t arrive.
          </ThemedText>
        </View>
        <Button title="Send again" variant="secondary" onPress={submit} loading={busy} style={styles.gap} />
      </Page>
    );
  }

  return (
    <Page
      back
      title="Reset password"
      subtitle="Enter the email you use for ClientDesk and we’ll send you a link to set a new password."
      footer={<Button title="Send reset link" onPress={submit} loading={busy} />}>
      <FormField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={error}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
        autoFocus
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md, alignItems: 'center' },
  gap: { marginTop: Spacing.four },
});
