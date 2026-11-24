import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState, Page } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useMyInvitations } from '@/features/workspace';
import { InvitationCard } from '@/features/workspace/components/invitation-card';

export default function Invitations() {
  const invitations = useMyInvitations();
  const list = invitations.data ?? [];
  return (
    <Page
      back
      title="Invitations"
      subtitle="Workspaces you’ve been invited to join."
      refreshing={invitations.isRefetching}
      onRefresh={() => invitations.refetch()}>
      {list.length ? (
        <View style={styles.list}>
          {list.map((invitation) => (
            <InvitationCard key={invitation.id} invitation={invitation} onJoined={() => router.replace('/')} />
          ))}
        </View>
      ) : (
        <EmptyState icon="mail" title="No pending invitations" message="When someone invites you to a workspace, it shows up here." />
      )}
    </Page>
  );
}

const styles = StyleSheet.create({ list: { gap: Spacing.three } });
