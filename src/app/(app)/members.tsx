import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Avatar, Button, EmptyState, IconButton, ListGroup, ListRow, Page, Pill, SearchField, SegmentedControl, ThemedText } from '@/components/ui';
import { ROLE } from '@/constants/tickets';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { useInvitations, useMembers, useRevokeInvitation, useWorkspace } from '@/features/workspace';
import { can } from '@/features/workspace/permissions';
import { toast } from '@/stores/toast-store';
import type { Role } from '@/types/models';
import { displayName, errorMessage, shortDate } from '@/utils/format';

const ORDER: Record<Role, number> = { owner: 0, admin: 1, member: 2 };

export default function Members() {
  const { user } = useAuth();
  const { workspace, workspaceId, role } = useWorkspace();
  const members = useMembers(workspaceId);
  const manage = can.inviteMembers(role);
  const invitations = useInvitations(workspaceId, manage);
  const revoke = useRevokeInvitation(workspaceId);
  const [tab, setTab] = useState<'members' | 'invites'>('members');
  const [q, setQ] = useState('');
  const [now] = useState(() => Date.now());

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (members.data ?? [])
      .filter((m) => !needle || displayName(m.profile).toLowerCase().includes(needle) || (m.profile?.email ?? '').toLowerCase().includes(needle))
      .sort((a, b) => ORDER[a.role] - ORDER[b.role] || displayName(a.profile).localeCompare(displayName(b.profile)));
  }, [members.data, q]);

  const invites = invitations.data ?? [];

  return (
    <Page
      back
      title="Members"
      subtitle={`${members.data?.length ?? 0} people in ${workspace?.name ?? 'this workspace'}`}
      actions={manage ? <IconButton icon="person-add" label="Invite member" onPress={() => router.push('/members/invite')} filled /> : null}
      refreshing={members.isRefetching}
      onRefresh={() => {
        members.refetch();
        invitations.refetch();
      }}>
      {manage ? (
        <View style={styles.tabs}>
          <SegmentedControl
            segments={[
              { value: 'members', label: 'Members', count: members.data?.length },
              { value: 'invites', label: 'Invitations', count: invites.length },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>
      ) : null}

      {tab === 'members' ? (
        <>
          <View style={styles.search}>
            <SearchField value={q} onChangeText={setQ} placeholder="Search by name or email" />
          </View>
          <ListGroup>
            {list.map((m, i) => (
              <ListRow
                key={m.user_id}
                left={<Avatar size={40} name={displayName(m.profile)} uri={m.profile?.avatar_url} />}
                title={`${displayName(m.profile)}${m.user_id === user?.id ? ' (you)' : ''}`}
                subtitle={`${m.profile?.email ?? ''} · joined ${shortDate(m.created_at)}`}
                right={<Pill label={ROLE[m.role].label} tone={ROLE[m.role].tone} small />}
                onPress={() => router.push({ pathname: '/members/[userId]', params: { userId: m.user_id } })}
                last={i === list.length - 1}
              />
            ))}
          </ListGroup>
          {!list.length && !members.isLoading ? <EmptyState icon="search" title="No one matches" /> : null}
        </>
      ) : invites.length ? (
        <ListGroup>
          {invites.map((inv, i) => {
            const expired = new Date(inv.expires_at).getTime() < now;
            return (
              <ListRow
                key={inv.id}
                icon="mail"
                title={inv.email}
                subtitle={`${ROLE[inv.role].label} · ${expired ? 'expired' : `expires ${shortDate(inv.expires_at)}`}`}
                right={<Pill label={expired ? 'Expired' : 'Pending'} tone={expired ? 'neutral' : 'warning'} small />}
                chevron={false}
                onPress={() =>
                  Alert.alert(inv.email, expired ? 'This invitation expired.' : 'This invitation is waiting to be accepted.', [
                    { text: 'Close', style: 'cancel' },
                    {
                      text: 'Revoke',
                      style: 'destructive',
                      onPress: () =>
                        revoke.mutate(inv.id, {
                          onSuccess: () => toast.success('Invitation revoked'),
                          onError: (e) => toast.error(errorMessage(e)),
                        }),
                    },
                  ])
                }
                last={i === invites.length - 1}
              />
            );
          })}
        </ListGroup>
      ) : (
        <EmptyState
          icon="mail"
          title="No pending invitations"
          message="Invite teammates by email. They’ll join as soon as they accept."
          action={<Button title="Invite member" icon="person-add" onPress={() => router.push('/members/invite')} />}
        />
      )}

      {!manage ? (
        <ThemedText type="caption" themeColor="textTertiary" style={styles.note}>
          Only owners and admins can invite or remove members.
        </ThemedText>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  tabs: { marginBottom: Spacing.three },
  search: { marginBottom: Spacing.three },
  note: { textAlign: 'center', marginTop: Spacing.four },
});
