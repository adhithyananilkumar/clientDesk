import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Avatar, Button, FormField, ListGroup, ListRow, Page, SectionHeader, ThemedText } from '@/components/ui';
import { ROLE } from '@/constants/tickets';
import { Spacing } from '@/constants/theme';
import { authRedirectUrl, useAuth } from '@/features/auth/auth-provider';
import { useWorkspace } from '@/features/workspace';
import { supabase } from '@/services/supabase';
import { toast } from '@/stores/toast-store';
import { errorMessage } from '@/utils/format';
import { emailChangeSchema } from '@/validation';

/** Settings that follow the person across every workspace. */
export default function AccountSettings() {
  const { user } = useAuth();
  const { memberships, workspace, switchTo } = useWorkspace();
  const [email, setEmail] = useState(user?.email ?? '');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const pendingEmail = user?.new_email;

  const changeEmail = async () => {
    const parsed = emailChangeSchema.safeParse({ email });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    if (parsed.data.email.toLowerCase() === user?.email?.toLowerCase()) return setError('That’s already your email');
    setError(undefined);
    setBusy(true);
    const { error: e } = await supabase.auth.updateUser({ email: parsed.data.email }, { emailRedirectTo: authRedirectUrl() });
    setBusy(false);
    if (e) toast.error(errorMessage(e));
    else toast.success('Check both inboxes to confirm the change');
  };

  return (
    <Page back title="Account settings" subtitle="These apply to you in every workspace.">
      <SectionHeader title="Email address" />
      <FormField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={error}
        hint={pendingEmail ? `Waiting for confirmation of ${pendingEmail}` : 'We’ll send a confirmation link before switching.'}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <Button title="Update email" variant="secondary" onPress={changeEmail} loading={busy} style={styles.gap} />

      <SectionHeader title="Your workspaces" action="+ New" onAction={() => router.push('/workspace/new')} />
      <ListGroup>
        {memberships.map((m, i) => (
          <ListRow
            key={m.workspace.id}
            left={<Avatar size={32} name={m.workspace.name} uri={m.workspace.logo_url} square />}
            title={m.workspace.name}
            subtitle={ROLE[m.role].label}
            value={m.workspace.id === workspace?.id ? 'Current' : undefined}
            onPress={() => {
              switchTo(m.workspace.id);
              router.replace('/');
            }}
            last={i === memberships.length - 1}
          />
        ))}
      </ListGroup>
      <ThemedText type="caption" themeColor="textTertiary" style={styles.note}>
        To leave a workspace, open it and go to Workspace settings.
      </ThemedText>
    </Page>
  );
}

const styles = StyleSheet.create({
  gap: { marginTop: Spacing.three },
  note: { marginTop: Spacing.two },
});
