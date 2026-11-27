import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, FormField, Icon, ListGroup, ListRow, Page, SectionHeader, ThemedText } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { friendlyError } from '@/features/auth/auth-provider';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/services/supabase';
import { toast } from '@/stores/toast-store';
import { fieldErrors } from '@/utils/form';
import { passwordSchema } from '@/validation';

export default function Security() {
  const theme = useTheme();
  const { recovery } = useLocalSearchParams<{ recovery?: string }>();
  const { user, signOut, deleteAccount } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [values, setValues] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const isRecovery = recovery === '1';
  const provider = user?.app_metadata?.provider;

  const save = async () => {
    const parsed = passwordSchema.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setBusy(false);
    if (error) return toast.error(friendlyError(error.message));
    setValues({ password: '', confirm: '' });
    toast.success('Password updated');
    if (isRecovery) router.replace('/');
  };

  return (
    <Page
      back={!isRecovery}
      title={isRecovery ? 'Choose a new password' : 'Security'}
      subtitle={isRecovery ? 'You’re signed in from your reset link. Set a new password to finish.' : undefined}>
      {provider === 'google' && !isRecovery ? (
        <View style={[styles.notice, { backgroundColor: theme.infoSoft }]}>
          <Icon name="info" size={14} tone="info" />
          <ThemedText type="small" style={{ color: theme.info, flex: 1 }}>
            You sign in with Google. Setting a password lets you also sign in with email.
          </ThemedText>
        </View>
      ) : null}

      <SectionHeader title={isRecovery ? 'New password' : 'Change password'} />
      <View style={styles.form}>
        <FormField
          label="New password"
          value={values.password}
          onChangeText={(password) => setValues((v) => ({ ...v, password }))}
          error={errors.password}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          hint="At least 8 characters"
        />
        <FormField
          label="Confirm new password"
          value={values.confirm}
          onChangeText={(confirm) => setValues((v) => ({ ...v, confirm }))}
          error={errors.confirm}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={save}
        />
        <Button title="Update password" onPress={save} loading={busy} />
      </View>

      {isRecovery ? null : (
        <>
          <SectionHeader title="Sessions" />
          <ListGroup>
            <ListRow
              icon="device-mobile"
              title="Sign out of all devices"
              subtitle="Ends every session, including this one"
              destructive
              chevron={false}
              onPress={() =>
                Alert.alert('Sign out everywhere?', 'You’ll need to sign in again on every device.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign out everywhere', style: 'destructive', onPress: () => signOut({ everywhere: true }) },
                ])
              }
              last
            />
          </ListGroup>
          <ThemedText type="caption" themeColor="textTertiary" style={styles.note}>
            Signed in as {user?.email}. Last sign-in {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'unknown'}.
          </ThemedText>

          <SectionHeader title="Delete account" />
          {confirming ? (
            <View style={[styles.danger, { borderColor: theme.danger }]}>
              <ThemedText type="small">
                This permanently deletes your profile, your comments and files, and any workspace where you’re the only member. Tickets you
                created stay with your team without your name. This can’t be undone.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                If you own a workspace with other people in it, transfer ownership first.
              </ThemedText>
              <FormField
                label="Type DELETE to confirm"
                value={confirmText}
                onChangeText={setConfirmText}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <View style={styles.dangerActions}>
                <Button title="Cancel" variant="secondary" onPress={() => {
                  setConfirming(false);
                  setConfirmText('');
                }} />
                <Button
                  title="Delete my account"
                  variant="danger"
                  disabled={confirmText.trim().toUpperCase() !== 'DELETE'}
                  loading={deleting}
                  onPress={async () => {
                    setDeleting(true);
                    const { error } = await deleteAccount();
                    setDeleting(false);
                    if (error) return toast.error(error);
                    toast.success('Your account has been deleted');
                  }}
                />
              </View>
            </View>
          ) : (
            <ListGroup>
              <ListRow
                icon="trash"
                title="Delete account"
                subtitle="Permanently remove your account and data"
                destructive
                chevron={false}
                onPress={() => setConfirming(true)}
                last
              />
            </ListGroup>
          )}
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.md },
  form: { gap: Spacing.four - 4 },
  note: { marginTop: Spacing.two },
  danger: { gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.md, borderWidth: 1 },
  dangerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
});
