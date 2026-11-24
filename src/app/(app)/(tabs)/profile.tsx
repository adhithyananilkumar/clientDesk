import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Avatar, Button, ListGroup, ListRow, Page, Pill, SectionHeader, ThemedText } from '@/components/ui';
import { ROLE } from '@/constants/tickets';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { useMyProfile, useWorkspace } from '@/features/workspace';
import { displayName } from '@/utils/format';

/** Personal account options. Workspace settings live in the sidebar, not here. */
export default function ProfileTab() {
  const { user, signOut } = useAuth();
  const profile = useMyProfile().data;
  const { workspace, role, memberships } = useWorkspace();
  const [signingOut, setSigningOut] = useState(false);
  const name = displayName(profile ?? { full_name: user?.user_metadata?.full_name as string, email: user?.email }, 'You');

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'Offline drafts and cached tickets on this device will be cleared.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await signOut();
        },
      },
    ]);

  return (
    <Page title="Profile">
      <View style={styles.card}>
        <Avatar size={72} name={name} uri={profile?.avatar_url} />
        <View style={styles.text}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.regular}>
            {profile?.email ?? user?.email}
          </ThemedText>
          {role ? (
            <View style={styles.role}>
              <Pill label={`${ROLE[role].label} · ${workspace?.name ?? ''}`} tone={ROLE[role].tone} small />
            </View>
          ) : null}
        </View>
      </View>

      <SectionHeader title="Account" />
      <ListGroup>
        <ListRow icon="person" title="My profile" subtitle="Name and photo" onPress={() => router.push('/account/profile')} />
        <ListRow icon="mail" title="Account settings" subtitle="Email address and workspaces" onPress={() => router.push('/account/settings')} />
        <ListRow icon="bell" title="Notification preferences" subtitle="Choose what you hear about" onPress={() => router.push('/account/notifications')} />
        <ListRow icon="shield-lock" title="Security" subtitle="Password and sessions" onPress={() => router.push('/account/security')} last />
      </ListGroup>

      <SectionHeader title="Support" />
      <ListGroup>
        <ListRow icon="question" title="Help & support" onPress={() => router.push('/account/help')} last />
      </ListGroup>

      <Button title="Sign out" icon="sign-out" variant="danger" onPress={confirmSignOut} loading={signingOut} style={styles.signOut} />
      <ThemedText type="caption" themeColor="textTertiary" style={styles.footnote}>
        ClientDesk 1.0 · {memberships.length} workspace{memberships.length === 1 ? '' : 's'}
      </ThemedText>
    </Page>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  regular: { fontWeight: '400' },
  role: { marginTop: 6 },
  signOut: { marginTop: Spacing.five },
  footnote: { textAlign: 'center', marginTop: Spacing.three },
});
