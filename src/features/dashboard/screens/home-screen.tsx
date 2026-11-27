import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button, Card, Icon, ListGroup, ListRow, Page, SectionHeader, Skeleton, ThemedText } from '@/components/ui';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { describeActivity } from '@/features/tickets/activity-text';
import { useActivityFeed, useRecentTickets, useTicketStats } from '@/features/tickets/api';
import { TicketRow } from '@/features/tickets/components/ticket-row';
import { useCategories, useMemberMap, useMyProfile, useWorkspace } from '@/features/workspace';
import { TopBar } from '@/features/workspace/components/top-bar';
import { isAdmin } from '@/features/workspace/permissions';
import { useIsOnline } from '@/hooks/use-network';
import { useTheme } from '@/hooks/use-theme';
import { useSyncStore } from '@/sync/outbox';
import { displayName, firstName, greeting, ticketKey, timeAgo } from '@/utils/format';

/** Home: what needs attention right now, adapted to the user's role. */
export function HomeScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { workspace, workspaceId, role, memberships } = useWorkspace();
  const profile = useMyProfile().data;
  const stats = useTicketStats(workspaceId);
  const updated = useRecentTickets(workspaceId, 'updated_at', 5);
  const created = useRecentTickets(workspaceId, 'created_at', 5);
  const feed = useActivityFeed(workspaceId, 8);
  const memberMap = useMemberMap(workspaceId);
  const categories = useCategories(workspaceId).data ?? [];
  const online = useIsOnline();
  const pending = useSyncStore((s) => s.pending);
  const admin = isAdmin(role);
  const s = stats.data;

  const name = displayName(profile ?? { full_name: user?.user_metadata?.full_name as string, email: user?.email }, 'there');

  const refresh = () => {
    stats.refetch();
    updated.refetch();
    created.refetch();
    feed.refetch();
  };

  const total = s?.total ?? 0;
  const parts: { label: string; value: number; status: string }[] = [
    { label: 'Open', value: s?.open ?? 0, status: 'open' },
    { label: 'In progress', value: s?.in_progress ?? 0, status: 'in_progress' },
    { label: 'Resolved', value: s?.resolved ?? 0, status: 'resolved,closed' },
  ];
  const attention = [
    { icon: 'alert' as const, tone: 'danger' as ThemeColor, title: 'Overdue', value: s?.overdue, params: { due: 'overdue' } },
    { icon: 'person' as const, tone: 'info' as ThemeColor, title: 'Assigned to me', value: s?.assigned_to_me, params: { scope: 'assigned' } },
    admin
      ? { icon: 'inbox' as const, tone: 'attention' as ThemeColor, title: 'Unassigned', value: s?.unassigned, params: { scope: 'unassigned' } }
      : { icon: 'pencil' as const, tone: 'neutral' as ThemeColor, title: 'Created by me', value: s?.created_by_me, params: { scope: 'created', status: 'all' } },
  ].filter((x) => !!x.value);

  return (
    <Page
      bare
      refreshing={stats.isRefetching}
      onRefresh={refresh}>
      <TopBar />

      {!online || pending ? (
        <View style={[styles.banner, { backgroundColor: online ? theme.infoSoft : theme.warningSoft }]}>
          <Icon name={online ? 'sync' : 'cloud-offline'} size={14} tone={online ? 'info' : 'warning'} />
          <ThemedText type="small" style={{ color: online ? theme.info : theme.warning, flex: 1 }}>
            {online ? `Syncing ${pending} offline change${pending === 1 ? '' : 's'}…` : 'You’re offline. Showing saved data; changes will sync later.'}
          </ThemedText>
        </View>
      ) : null}

      <Animated.View entering={FadeInDown.duration(400)} style={styles.hero}>
        <ThemedText themeColor="textSecondary" style={styles.greeting}>
          {greeting()},
        </ThemedText>
        <ThemedText style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
          {firstName(name)}
        </ThemedText>
      </Animated.View>

      {role === 'member' ? (
        <Pressable
          onPress={() => (memberships.length > 1 ? router.push('/workspaces') : undefined)}
          disabled={memberships.length <= 1}
          accessibilityRole={memberships.length > 1 ? 'button' : 'text'}
          style={[styles.roleNote, { backgroundColor: theme.neutralSoft }]}>
          <Icon name="eye" size={14} tone="neutral" />
          <ThemedText type="small" style={[styles.roleNoteText, { color: theme.neutral }]}>
            You’re a member here, so you see tickets you created or are assigned to.
            {memberships.length > 1 ? ' Tap to see all your workspaces.' : ''}
          </ThemedText>
        </Pressable>
      ) : null}

      {/* Big primary action */}
      <Pressable
        onPress={() => router.push('/ticket/new')}
        accessibilityRole="button"
        accessibilityLabel="Create ticket"
        style={({ pressed }) => [styles.cta, { backgroundColor: theme.text, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
        <View style={[styles.ctaIcon, { backgroundColor: theme.background }]}>
          <Icon name="plus" size={18} />
        </View>
        <View style={styles.flex}>
          <ThemedText style={[styles.ctaTitle, { color: theme.background }]}>Create ticket</ThemedText>
          <ThemedText type="small" style={{ color: theme.background, opacity: 0.7, fontWeight: '400' }}>
            Report an issue or request in seconds
          </ThemedText>
        </View>
        <Icon name="arrow-right" size={18} color={theme.background} />
      </Pressable>

      {/* Overview */}
      <SectionHeader title="Overview" action="All tickets" onAction={() => router.push('/tickets')} />
      <Card style={styles.overview}>
        <View style={styles.totalRow}>
          {s ? <ThemedText style={styles.total}>{total}</ThemedText> : <Skeleton width={64} height={40} />}
          <ThemedText themeColor="textSecondary" style={styles.totalLabel}>
            {admin ? 'tickets in total' : 'tickets for you'}
          </ThemedText>
        </View>
        <View style={[styles.legend, { borderTopColor: theme.border }]}>
          {parts.map((p, i) => (
            <Pressable
              key={p.label}
              onPress={() => router.push({ pathname: '/tickets', params: { status: p.status } })}
              accessibilityRole="button"
              accessibilityLabel={`${p.label}: ${p.value}`}
              style={[styles.legendItem, i > 0 && { borderLeftColor: theme.border, borderLeftWidth: StyleSheet.hairlineWidth }]}>
              <ThemedText style={styles.legendValue}>{s ? p.value : '–'}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {p.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </Card>

      {attention.length ? (
        <ListGroup style={styles.attention}>
          {attention.map((x, i) => (
            <ListRow
              key={x.title}
              icon={x.icon}
              iconTone={x.tone}
              title={x.title}
              value={String(x.value)}
              onPress={() => router.push({ pathname: '/tickets', params: x.params })}
              last={i === attention.length - 1}
            />
          ))}
        </ListGroup>
      ) : null}

      {/* Recently updated */}
      <SectionHeader title="Recently updated" action="See all" onAction={() => router.push({ pathname: '/tickets', params: { status: 'all' } })} />
      <Card padded={false} style={styles.listCard}>
        {updated.isLoading ? (
          <View style={styles.pad}>
            <Skeleton height={44} />
          </View>
        ) : updated.data?.length ? (
          updated.data.map((t) => <TicketRow key={t.id} ticket={t} prefix={workspace?.ticket_prefix} inset={false} compact />)
        ) : (
          <ThemedText type="small" themeColor="textTertiary" style={styles.placeholder}>
            Nothing here yet
          </ThemedText>
        )}
      </Card>

      {/* Recently created (admins see the intake) */}
      {admin && created.data?.length ? (
        <>
          <SectionHeader title="Recently created" />
          <Card padded={false} style={styles.listCard}>
            {created.data.map((t) => (
              <TicketRow key={t.id} ticket={t} prefix={workspace?.ticket_prefix} inset={false} compact />
            ))}
          </Card>
        </>
      ) : null}

      {/* Activity */}
      <SectionHeader title={admin ? 'Ticket activity' : 'Recent activity'} />
      {feed.data?.length ? (
        <Card>
          {feed.data.map((a, i) => {
            const { text, icon, tone } = describeActivity(a, memberMap, categories);
            return (
              <Pressable
                key={a.id}
                onPress={() => a.ticket && router.push({ pathname: '/ticket/[id]', params: { id: a.ticket.id } })}
                accessibilityRole="button"
                accessibilityHint="Opens the ticket"
                style={[styles.feedRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <View style={[styles.feedIcon, { backgroundColor: theme[`${tone}Soft` as ThemeColor] ?? theme.backgroundElement }]}>
                  <Icon name={icon} size={12} color={theme[tone]} />
                </View>
                <View style={styles.flex}>
                  <ThemedText type="small" numberOfLines={2} style={styles.feedText}>
                    <ThemedText type="small" style={styles.bold}>
                      {a.actor ? firstName(displayName(a.actor)) : 'System'}
                    </ThemedText>{' '}
                    {text}
                  </ThemedText>
                  {a.ticket ? (
                    <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                      {ticketKey(workspace?.ticket_prefix, a.ticket.ticket_number)} · {a.ticket.title}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText type="caption" themeColor="textTertiary">
                  {timeAgo(a.created_at)}
                </ThemedText>
              </Pressable>
            );
          })}
        </Card>
      ) : (
        <ThemedText type="small" themeColor="textTertiary" style={styles.regular}>
          Nothing here yet
        </ThemedText>
      )}

      {admin && s && s.total === 0 ? (
        <Card style={styles.invite}>
          <ThemedText style={styles.bold}>Bring your team</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.regular}>
            Invite teammates so tickets can be assigned and discussed together.
          </ThemedText>
          <Button title="Invite members" icon="person-add" variant="secondary" size="md" onPress={() => router.push('/members/invite')} />
        </Card>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  roleNote: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.md, marginBottom: Spacing.three },
  roleNoteText: { flex: 1, fontWeight: '500' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.md, marginTop: Spacing.three },
  hero: { marginTop: Spacing.three, marginBottom: Spacing.three },
  greeting: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  name: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.5 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: Radius.xl },
  ctaIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { fontSize: 17, fontWeight: '700' },
  overview: { gap: Spacing.three },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  total: { fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  totalLabel: { fontSize: 14, fontWeight: '400' },
  legend: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.three },
  legendItem: { flex: 1, alignItems: 'center', gap: 2 },
  legendValue: { fontSize: 18, lineHeight: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  attention: { marginTop: Spacing.three },
  placeholder: { fontWeight: '400', padding: Spacing.three },
  listCard: { paddingHorizontal: Spacing.three, overflow: 'hidden' },
  pad: { paddingVertical: Spacing.three },
  feedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  feedIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  feedText: { fontWeight: '400', lineHeight: 20 },
  bold: { fontWeight: '700' },
  regular: { fontWeight: '400' },
  invite: { gap: Spacing.two, marginTop: Spacing.four },
});
