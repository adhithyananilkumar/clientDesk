import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Avatar, Button, Card, EmptyState, Icon, IconButton, Page, SectionHeader, Skeleton, ThemedText, type IconName } from '@/components/ui';
import { ROLE } from '@/constants/tickets';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { useUnreadCount } from '@/features/notifications/api';
import { describeActivity } from '@/features/tickets/activity-text';
import { useActivityFeed, useRecentTickets, useTicketStats } from '@/features/tickets/api';
import { TicketRow } from '@/features/tickets/components/ticket-row';
import { useCategories, useMemberMap, useMyProfile, useWorkspace } from '@/features/workspace';
import { isAdmin } from '@/features/workspace/permissions';
import { useIsOnline } from '@/hooks/use-network';
import { useTheme } from '@/hooks/use-theme';
import { useUiStore } from '@/stores/workspace-store';
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
  const unread = useUnreadCount(workspaceId).data ?? 0;
  const openSidebar = useUiStore((s) => s.openSidebar);
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

  const tiles: { label: string; value?: number; tone: ThemeColor; icon: IconName; href: Href }[] = [
    { label: admin ? 'Total tickets' : 'My tickets', value: s?.total, tone: 'text' as ThemeColor, icon: 'issue-opened', href: { pathname: '/tickets', params: { status: 'all' } } },
    { label: 'Open', value: s?.open, tone: 'success', icon: 'issue-opened', href: { pathname: '/tickets', params: { status: 'open' } } },
    { label: 'In progress', value: s?.in_progress, tone: 'warning', icon: 'sync', href: { pathname: '/tickets', params: { status: 'in_progress' } } },
    { label: 'Resolved', value: s?.resolved, tone: 'done', icon: 'issue-closed', href: { pathname: '/tickets', params: { status: 'resolved,closed' } } },
  ];

  return (
    <Page
      bare
      refreshing={stats.isRefetching}
      onRefresh={refresh}>
      {/* Top bar: workspace switcher + bell */}
      <View style={styles.topBar}>
        <Pressable
          onPress={openSidebar}
          accessibilityRole="button"
          accessibilityLabel={`Workspace ${workspace?.name}. Open workspace menu`}
          style={({ pressed }) => [styles.switcher, { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }]}>
          <Avatar name={workspace?.name} uri={workspace?.logo_url} size={28} square />
          <View style={styles.wsText}>
            <ThemedText style={styles.wsName} numberOfLines={1}>
              {workspace?.name}
            </ThemedText>
            {role ? (
              <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                {ROLE[role].label}
                {memberships.length > 1 ? ` · ${memberships.length} workspaces` : ''}
              </ThemedText>
            ) : null}
          </View>
          <Icon name="chevron-down" size={14} tone="textSecondary" />
        </Pressable>
        <IconButton icon="bell" label="Notifications" badge={unread} onPress={() => router.push('/notifications')} filled />
      </View>

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

      {/* Stats */}
      <SectionHeader title="Overview" action="All tickets" onAction={() => router.push('/tickets')} />
      <View style={styles.grid}>
        {tiles.map((t, i) => (
          <Animated.View key={t.label} entering={FadeInDown.delay(60 * i).duration(350)} style={styles.tileWrap}>
            <Pressable
              onPress={() => router.push(t.href)}
              accessibilityRole="button"
              accessibilityLabel={`${t.label}: ${t.value ?? 0}`}
              style={({ pressed }) => [styles.tile, { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }]}>
              <View style={styles.tileHead}>
                <View style={[styles.dot, { backgroundColor: theme[t.tone] }]} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.tileLabel}>
                  {t.label}
                </ThemedText>
              </View>
              {t.value == null ? (
                <Skeleton width={56} height={34} />
              ) : (
                <ThemedText style={styles.tileValue}>{t.value}</ThemedText>
              )}
            </Pressable>
          </Animated.View>
        ))}
      </View>

      {/* Attention chips */}
      <View style={styles.attention}>
        <Attention
          icon="alert"
          tone="danger"
          label="Overdue"
          value={s?.overdue}
          onPress={() => router.push({ pathname: '/tickets', params: { due: 'overdue' } })}
        />
        <Attention
          icon="person"
          tone="info"
          label="Assigned to me"
          value={s?.assigned_to_me}
          onPress={() => router.push({ pathname: '/tickets', params: { scope: 'assigned' } })}
        />
        {admin ? (
          <Attention
            icon="inbox"
            tone="attention"
            label="Unassigned"
            value={s?.unassigned}
            onPress={() => router.push({ pathname: '/tickets', params: { scope: 'unassigned' } })}
          />
        ) : (
          <Attention
            icon="pencil"
            tone="neutral"
            label="Created by me"
            value={s?.created_by_me}
            onPress={() => router.push({ pathname: '/tickets', params: { scope: 'created', status: 'all' } })}
          />
        )}
      </View>

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
          <EmptyState icon="issue-opened" title="No tickets yet" message="Tickets you can see will show up here." />
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
          Changes to tickets will appear here.
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

function Attention({ icon, tone, label, value, onPress }: { icon: IconName; tone: ThemeColor; label: string; value?: number; onPress: () => void }) {
  const theme = useTheme();
  const hot = !!value && tone === 'danger';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ?? 0}`}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: hot ? theme.dangerSoft : theme.surface, borderColor: hot ? theme.danger + '55' : theme.border, opacity: pressed ? 0.8 : 1 },
      ]}>
      <Icon name={icon} size={14} color={theme[tone]} />
      <ThemedText style={[styles.chipValue, hot && { color: theme.danger }]}>{value ?? '–'}</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1} style={styles.chipLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.two, gap: Spacing.three },
  switcher: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 6, paddingRight: 14, height: 44, borderRadius: Radius.pill, flexShrink: 1 },
  wsText: { flexShrink: 1 },
  wsName: { fontSize: 15, lineHeight: 19, fontWeight: '700' },
  roleNote: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.md, marginBottom: Spacing.three },
  roleNoteText: { flex: 1, fontWeight: '500' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.md, marginTop: Spacing.three },
  hero: { marginTop: Spacing.four, marginBottom: Spacing.four },
  greeting: { fontSize: 20, lineHeight: 26, fontWeight: '500' },
  name: { fontSize: 40, lineHeight: 46, fontWeight: '700', letterSpacing: -1.2 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: Radius.xl },
  ctaIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { fontSize: 17, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  tileWrap: { width: '50%', padding: 5 },
  tile: { borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two, minHeight: 104, justifyContent: 'space-between' },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tileLabel: { fontWeight: '600' },
  tileValue: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  attention: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two + 2 },
  chip: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, padding: 12, gap: 4 },
  chipValue: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  chipLabel: { fontWeight: '600' },
  listCard: { paddingHorizontal: Spacing.three, overflow: 'hidden' },
  pad: { paddingVertical: Spacing.three },
  feedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  feedIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  feedText: { fontWeight: '400', lineHeight: 20 },
  bold: { fontWeight: '700' },
  regular: { fontWeight: '400' },
  invite: { gap: Spacing.two, marginTop: Spacing.four },
});
