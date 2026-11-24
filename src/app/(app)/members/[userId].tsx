import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Avatar, EmptyState, ListGroup, ListRow, OptionSheet, Page, Pill, SectionHeader, ThemedText } from '@/components/ui';
import { ROLE } from '@/constants/tickets';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { useChangeRole, useMembers, useRemoveMember, useTransferOwnership, useWorkspace } from '@/features/workspace';
import { can } from '@/features/workspace/permissions';
import { toast } from '@/stores/toast-store';
import { displayName, errorMessage, longDateTime } from '@/utils/format';

export default function MemberProfile() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const { workspace, workspaceId, role } = useWorkspace();
  const members = useMembers(workspaceId);
  const changeRole = useChangeRole(workspaceId);
  const remove = useRemoveMember(workspaceId);
  const transfer = useTransferOwnership(workspaceId);
  const [roleSheet, setRoleSheet] = useState(false);

  const member = members.data?.find((m) => m.user_id === userId);
  if (!member) {
    return (
      <Page back>
        <EmptyState icon="person" title={members.isLoading ? 'Loading…' : 'Not a member'} message={members.isLoading ? undefined : 'This person is no longer in the workspace.'} />
      </Page>
    );
  }

  const name = displayName(member.profile);
  const self = member.user_id === user?.id;
  const canChange = can.changeRoleOf(role, member.role) && !self;
  const canRemove = can.removeMember(role, member.role, self);
  const canTransfer = can.transferOwnership(role) && !self;

  const confirmRemove = () =>
    Alert.alert(`Remove ${name}?`, `They lose access to ${workspace?.name}. Tickets assigned to them become unassigned.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          remove.mutate(member.user_id, {
            onSuccess: () => {
              toast.success(`${name} was removed`);
              router.back();
            },
            onError: (e) => toast.error(errorMessage(e)),
          }),
      },
    ]);

  const confirmTransfer = () =>
    Alert.alert(`Make ${name} the owner?`, 'You’ll become an admin. Only the new owner can undo this.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Transfer ownership',
        style: 'destructive',
        onPress: () =>
          transfer.mutate(member.user_id, {
            onSuccess: () => toast.success(`${name} is now the owner`),
            onError: (e) => toast.error(errorMessage(e)),
          }),
      },
    ]);

  return (
    <Page back>
      <View style={styles.hero}>
        <Avatar size={88} name={name} uri={member.profile?.avatar_url} />
        <ThemedText style={styles.name}>{name}</ThemedText>
        <ThemedText themeColor="textSecondary" selectable>
          {member.profile?.email}
        </ThemedText>
        <Pill label={ROLE[member.role].label} tone={ROLE[member.role].tone} />
        <ThemedText type="caption" themeColor="textTertiary">
          Joined {longDateTime(member.created_at)}
        </ThemedText>
      </View>

      <SectionHeader title="Tickets" />
      <ListGroup>
        <ListRow
          icon="person"
          title="Assigned to them"
          onPress={() => router.push({ pathname: '/tickets', params: { assignee: member.user_id, status: 'all' } })}
        />
        <ListRow
          icon="issue-opened"
          title="Created by them"
          onPress={() => router.push({ pathname: '/tickets', params: { creator: member.user_id, status: 'all' } })}
          last
        />
      </ListGroup>

      {canChange || canRemove || canTransfer ? (
        <>
          <SectionHeader title="Manage" />
          <ListGroup>
            {canChange ? <ListRow icon="shield" title="Change role" value={ROLE[member.role].label} onPress={() => setRoleSheet(true)} last={!canTransfer && !canRemove} /> : null}
            {canTransfer ? <ListRow icon="arrow-switch" title="Transfer ownership" onPress={confirmTransfer} last={!canRemove} /> : null}
            {canRemove ? <ListRow icon="trash" title="Remove from workspace" destructive chevron={false} onPress={confirmRemove} last /> : null}
          </ListGroup>
        </>
      ) : null}

      <OptionSheet
        visible={roleSheet}
        onClose={() => setRoleSheet(false)}
        title={`${name}’s role`}
        options={(['admin', 'member'] as const).map((r) => ({ value: r, label: ROLE[r].label, description: ROLE[r].description, icon: r === 'admin' ? 'shield' : 'person' }))}
        value={member.role}
        onSelect={(r) =>
          r !== member.role &&
          changeRole.mutate(
            { userId: member.user_id, role: r },
            { onSuccess: () => toast.success(`${name} is now ${ROLE[r].label.toLowerCase()}`), onError: (e) => toast.error(errorMessage(e)) },
          )
        }
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  name: { fontSize: 26, lineHeight: 32, fontWeight: '700', marginTop: Spacing.two, textAlign: 'center' },
});
