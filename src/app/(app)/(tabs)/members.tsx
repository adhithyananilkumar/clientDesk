import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Avatar, Button, Chip, EmptyState, IconButton, ListGroup, ListRow, Page, Pill, SearchField, SegmentedControl, ThemedText } from '@/components/ui';
import { ROLE } from '@/constants/tickets';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/features/auth';
import { useInvitations, useMembers, useRevokeInvitation, useWorkspace } from '@/features/workspace';
import { can } from '@/features/workspace/permissions';
import { TopBarActions } from '@/features/workspace/components/top-bar';
import { WorkspaceSwitcher } from '@/features/workspace/components/workspace-switcher';
import { toast } from '@/stores/toast-store';
import type { Role } from '@/types/models';
import { displayName, errorMessage, shortDate } from '@/utils/format';

const ORDER: Record<Role, number> = { owner: 0, admin: 1, member: 2 };

type RoleFilter = 'all' | Role;

export default function Members() {
  const theme = useTheme();
  const { user } = useAuth();
  const { workspaceId, role } = useWorkspace();
  const members = useMembers(workspaceId);
  const manage = can.inviteMembers(role);
  const invitations = useInvitations(workspaceId, manage);
  const revoke = useRevokeInvitation(workspaceId);
  const [tab, setTab] = useState<'members' | 'invites'>('members');
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [now] = useState(() => Date.now());

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (members.data ?? [])
      .filter((m) => roleFilter === 'all' || m.role === roleFilter)
      .filter((m) => !needle || displayName(m.profile).toLowerCase().includes(needle) || (m.profile?.email ?? '').toLowerCase().includes(needle))
      .sort((a, b) => ORDER[a.role] - ORDER[b.role] || displayName(a.profile).localeCompare(displayName(b.profile)));
  }, [members.data, q, roleFilter]);

  const invites = invitations.data ?? [];
  const all = members.data ?? [];
  const count = (r: Role) => all.filter((m) => m.role === r).length;
  const pending = invites.filter((i) => new Date(i.expires_at).getTime() >= now).length;
  const stats: { label: string; value: number }[] = [
    { label: 'People', value: all.length },
    { label: 'Admins', value: count('owner') + count('admin') },
    { label: 'Members', value: count('member') },
    ...(manage ? [{ label: 'Pending', value: pending }] : []),
  ];

  return (
    <Page
      leading={<WorkspaceSwitcher />}
      title="Members"
      actions={
        <TopBarActions
          extra={manage ? <IconButton icon="person-add" label="Invite member" onPress={() => router.push('/members/invite')} filled /> : null}
        />
      }
      refreshing={members.isRefetching}
      onRefresh={() => {
        members.refetch();
        invitations.refetch();
      }}>
      <View style={styles.stats}>
        {stats.map((st) => (
          <View key={st.label} style={[styles.stat, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.statValue}>{st.value}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {st.label}
            </ThemedText>
          </View>
        ))}
      </View>

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
          <View style={styles.chips}>
            {(['all', 'owner', 'admin', 'member'] as const).map((r) => (
              <Chip key={r} label={r === 'all' ? 'Everyone' : `${ROLE[r].label}s`} selected={roleFilter === r} onPress={() => setRoleFilter(r)} />
            ))}
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
          {manage ? <Button title="Invite member" icon="person-add" variant="secondary" onPress={() => router.push('/members/invite')} style={styles.invite} /> : null}
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
  stats: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  stat: { flex: 1, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 22, lineHeight: 26, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.three },
  invite: { marginTop: Spacing.four },
  tabs: { marginBottom: Spacing.three },
  search: { marginBottom: Spacing.three },
  note: { textAlign: 'center', marginTop: Spacing.four },
});
