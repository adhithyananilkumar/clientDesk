import { StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/brand';
import { Button, Page, SectionHeader, ThemedText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { useMyInvitations } from '@/features/workspace';
import { CreateWorkspaceForm } from '@/features/workspace/components/create-workspace-form';
import { InvitationCard } from '@/features/workspace/components/invitation-card';
import { firstName } from '@/utils/format';

/** First run: join a workspace you were invited to, or create your own. */
export default function Onboarding() {
  const { user, signOut } = useAuth();
  const invitations = useMyInvitations();
  const name = (user?.user_metadata?.full_name as string | undefined) ?? '';
  const pending = invitations.data ?? [];

  return (
    <Page refreshing={invitations.isRefetching} onRefresh={() => invitations.refetch()}>
      <View style={styles.hero}>
        <LogoMark size={44} />
        <ThemedText style={styles.title}>{name ? `Welcome, ${firstName(name)}` : 'Welcome to ClientDesk'}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.lead}>
          Tickets live in a workspace: one per team or company. Join one you were invited to, or start your own in seconds.
        </ThemedText>
      </View>

      {pending.length ? (
        <>
          <SectionHeader title="Your invitations" />
          <View style={styles.list}>
            {pending.map((invitation) => (
              <InvitationCard key={invitation.id} invitation={invitation} />
            ))}
          </View>
          <SectionHeader title="Or create a workspace" />
        </>
      ) : (
        <SectionHeader title="Create your workspace" />
      )}

      <CreateWorkspaceForm />

      <View style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Waiting for an invite? Ask your admin to invite {user?.email}.
        </ThemedText>
        <Button title="Log out" variant="ghost" size="md" onPress={() => signOut()} />
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { gap: Spacing.three, paddingTop: Spacing.four, paddingBottom: Spacing.two },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.8 },
  lead: { fontSize: 16, lineHeight: 23 },
  list: { gap: Spacing.three },
  footer: { marginTop: Spacing.five, gap: Spacing.three },
  center: { textAlign: 'center', fontWeight: '400' },
});
