import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/brand';
import { LoadingScreen } from '@/components/feedback';
import { Button, ThemedText } from '@/components/ui';
import { Gutter, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { useAcceptInviteToken } from '@/features/workspace';
import { PENDING_INVITE_KEY } from '@/features/workspace/invite-token';
import { kv } from '@/services/local-db';
import { errorMessage } from '@/utils/format';



/**
 * clientdesk://invite?token=… from the invitation email.
 * Signed out: remember the token, sign in, and it is accepted afterwards.
 */
export default function InviteRoute() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { session, isLoading } = useAuth();
  const accept = useAcceptInviteToken();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !token) return;
    if (!session) {
      kv.set(PENDING_INVITE_KEY, token);
      return;
    }
    accept.mutate(token, {
      onSuccess: () => {
        kv.remove(PENDING_INVITE_KEY);
        router.replace('/');
      },
      onError: (e) => {
        kv.remove(PENDING_INVITE_KEY);
        setError(errorMessage(e));
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, session, isLoading]);

  if (!token) {
    return <Message title="Invitation link is incomplete" body="Open the link from your invitation email again." />;
  }
  if (!session && !isLoading) {
    return (
      <Message
        title="You’re invited"
        body="Sign in or create an account with the email address the invitation was sent to. We’ll add you to the workspace right after."
        action="Continue"
        onAction={() => router.replace('/welcome')}
      />
    );
  }
  if (error) return <Message title="Couldn’t join the workspace" body={error} action="Go to ClientDesk" onAction={() => router.replace('/')} />;
  return <LoadingScreen message="Joining workspace" />;
}

function Message({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.root}>
      <LogoMark size={48} />
      <ThemedText style={styles.title}>{title}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.body}>
        {body}
      </ThemedText>
      {action && onAction ? <Button title={action} onPress={onAction} style={styles.button} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Gutter, gap: Spacing.two },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', marginTop: Spacing.four, textAlign: 'center' },
  body: { textAlign: 'center', maxWidth: 340 },
  button: { alignSelf: 'stretch', marginTop: Spacing.four },
});
