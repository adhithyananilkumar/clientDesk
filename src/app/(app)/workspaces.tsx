import { useQueries } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, Icon, Page, Pill, SectionHeader, ThemedText } from '@/components/ui';
import { ROLE } from '@/constants/tickets';
import { Radius, Spacing } from '@/constants/theme';
import { useMyInvitations, useWorkspace } from '@/features/workspace';
import { InvitationCard } from '@/features/workspace/components/invitation-card';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/services/supabase';
import { toast } from '@/stores/toast-store';
import type { Membership, TicketStats } from '@/types/models';
import { shortDate } from '@/utils/format';

/**
 * Every workspace you belong to, split into the ones you own and the ones
 * you were invited into, with what needs you in each.
 */
export default function Workspaces() {
  const { memberships, workspace: current, switchTo, refetch, isLoading } = useWorkspace();
  const invitations = useMyInvitations();
  const owned = memberships.filter((m) => m.role === 'owner');
  const joined = memberships.filter((m) => m.role !== 'owner');

  const stats = useQueries({
    queries: memberships.map((m) => ({
      queryKey: ['ws', m.workspace.id, 'stats'],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('ticket_stats', { ws: m.workspace.id });
        if (error) throw error;
        return data as TicketStats;
      },
    })),
  });
  const statsFor = (id: string) => stats[memberships.findIndex((m) => m.workspace.id === id)]?.data;

  const open = (m: Membership) => {
    if (m.workspace.id !== current?.id) {
      switchTo(m.workspace.id);
      toast.show(`Switched to ${m.workspace.name} · you’re ${m.role === 'owner' ? 'the owner' : `${ROLE[m.role].label.toLowerCase() === 'admin' ? 'an admin' : 'a member'}`}`);
    }
    router.replace('/');
  };

  return (
    <Page
      back
      title="Workspaces"
      subtitle={`You’re in ${memberships.length} workspace${memberships.length === 1 ? '' : 's'}.`}
      refreshing={isLoading}
      onRefresh={() => {
        refetch();
        invitations.refetch();
      }}
      footer={<Button title="Create workspace" icon="plus" variant="secondary" onPress={() => router.push('/workspace/new')} />}>
      {invitations.data?.length ? (
        <>
          <SectionHeader title="Invitations" />
          <View style={styles.list}>
            {invitations.data.map((inv) => (
              <InvitationCard key={inv.id} invitation={inv} />
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader title="Owned by you" />
      {owned.length ? (
        <View style={styles.list}>
          {owned.map((m) => (
            <WorkspaceCard key={m.workspace.id} membership={m} stats={statsFor(m.workspace.id)} current={m.workspace.id === current?.id} onPress={() => open(m)} />
          ))}
        </View>
      ) : (
        <ThemedText type="small" themeColor="textTertiary" style={styles.regular}>
          You don’t own a workspace yet. Create one for your own team.
        </ThemedText>
      )}

      <SectionHeader title="Member of" />
      {joined.length ? (
        <View style={styles.list}>
          {joined.map((m) => (
            <WorkspaceCard key={m.workspace.id} membership={m} stats={statsFor(m.workspace.id)} current={m.workspace.id === current?.id} onPress={() => open(m)} />
          ))}
        </View>
      ) : (
        <ThemedText type="small" themeColor="textTertiary" style={styles.regular}>
          Workspaces other people invite you to appear here.
        </ThemedText>
      )}
    </Page>
  );
}

function WorkspaceCard({ membership, stats, current, onPress }: { membership: Membership; stats?: TicketStats; current: boolean; onPress: () => void }) {
  const theme = useTheme();
  const { workspace, role } = membership;
  const admin = role !== 'member';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${workspace.name}, ${ROLE[role].label}${current ? ', current workspace' : ''}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? theme.backgroundElement : theme.surface, borderColor: current ? theme.text : theme.border, borderWidth: current ? 1.5 : StyleSheet.hairlineWidth },
      ]}>
      <View style={styles.head}>
        <Avatar size={44} name={workspace.name} uri={workspace.logo_url} square />
        <View style={styles.flex}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {workspace.name}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
            {workspace.description || `Joined ${shortDate(membership.created_at)}`}
          </ThemedText>
        </View>
        {current ? <Pill label="Current" tone="success" icon="check" small /> : <Icon name="chevron-right" size={16} tone="textTertiary" />}
      </View>
      <View style={[styles.stats, { borderTopColor: theme.border }]}>
        <Stat label="Open" value={stats?.open} />
        <Stat label="In progress" value={stats?.in_progress} />
        <Stat label="Mine" value={stats?.assigned_to_me} />
        <View style={styles.flex} />
        <Pill label={ROLE[role].label} tone={ROLE[role].tone} icon={role === 'owner' ? 'star' : role === 'admin' ? 'shield' : 'person'} small />
      </View>
      <ThemedText type="caption" themeColor="textTertiary">
        {role === 'owner'
          ? 'Full control, including members, settings and deletion.'
          : admin
            ? 'You manage members, tickets and most settings.'
            : 'You see tickets you created or are assigned to.'}
      </ThemedText>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <View>
      <ThemedText style={styles.statValue}>{value ?? '–'}</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three },
  regular: { fontWeight: '400' },
  card: { borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.three },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '700' },
  stats: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.three },
  statValue: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
