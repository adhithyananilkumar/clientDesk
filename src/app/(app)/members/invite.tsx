import { zodResolver } from '@hookform/resolvers/zod';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Share, StyleSheet, View } from 'react-native';

import { Button, EmptyState, FieldShell, FormField, Icon, ListGroup, Page, SheetRow, ThemedText } from '@/components/ui';
import { ROLE } from '@/constants/tickets';
import { Radius, Spacing } from '@/constants/theme';
import { useCreateInvitation, useWorkspace } from '@/features/workspace';
import { can } from '@/features/workspace/permissions';
import { useTheme } from '@/hooks/use-theme';
import { toast } from '@/stores/toast-store';
import { errorMessage } from '@/utils/format';
import { inviteSchema, type InviteValues } from '@/validation';

export default function Invite() {
  const theme = useTheme();
  const { workspace, workspaceId, role } = useWorkspace();
  const create = useCreateInvitation(workspaceId);
  const [sent, setSent] = useState<{ email: string; link: string; emailed: boolean } | null>(null);
  const { control, handleSubmit, formState, setValue, reset } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'member' },
  });
  const selectedRole = useWatch({ control, name: 'role' });

  if (!can.inviteMembers(role)) {
    return (
      <Page back="close" title="Invite member">
        <EmptyState icon="lock" title="Only owners and admins can invite" />
      </Page>
    );
  }

  const submit = handleSubmit(async (values) => {
    try {
      const result = await create.mutateAsync({ email: values.email.trim().toLowerCase(), role: values.role });
      setSent({ email: values.email, emailed: result.emailed, link: Linking.createURL('/invite', { queryParams: { token: result.token } }) });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  if (sent) {
    return (
      <Page back="close" title="Invitation created" subtitle={sent.emailed ? `We emailed ${sent.email} a link to join ${workspace?.name}.` : `Share this link with ${sent.email}. It works once and expires in 7 days.`}>
        <View style={[styles.done, { backgroundColor: theme.successSoft }]}>
          <Icon name="check-circle" size={18} tone="success" />
          <ThemedText type="small" style={{ color: theme.success, flex: 1 }}>
            If they already have a ClientDesk account, the invitation also appears in their notifications.
          </ThemedText>
        </View>
        <View style={styles.actions}>
          <Button
            title="Share invite link"
            icon="share"
            variant={sent.emailed ? 'secondary' : 'primary'}
            onPress={() => Share.share({ message: `Join ${workspace?.name} on ClientDesk: ${sent.link}` })}
          />
          <Button
            title="Invite someone else"
            variant="secondary"
            onPress={() => {
              reset({ email: '', role: selectedRole });
              setSent(null);
            }}
          />
          <Button title="Done" variant="ghost" onPress={() => router.back()} />
        </View>
      </Page>
    );
  }

  return (
    <Page back="close" title="Invite member" subtitle={`Add a teammate to ${workspace?.name}.`} footer={<Button title="Send invitation" onPress={submit} loading={create.isPending} />}>
      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <FormField
              label="Email address"
              placeholder="name@company.com"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={formState.errors.email?.message}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              autoFocus
              returnKeyType="send"
              onSubmitEditing={() => submit()}
            />
          )}
        />
        <FieldShell label="Role">
          <ListGroup>
            {(['member', 'admin'] as const).map((r) => (
              <SheetRow
                key={r}
                option={{ value: r, label: ROLE[r].label, description: ROLE[r].description, icon: r === 'admin' ? 'shield' : 'person' }}
                selected={selectedRole === r}
                onPress={() => setValue('role', r)}
              />
            ))}
          </ListGroup>
        </FieldShell>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.four },
  done: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.three, borderRadius: Radius.md },
  actions: { gap: Spacing.two, marginTop: Spacing.four },
});
