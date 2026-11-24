import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, EmptyState, Icon, IconButton, Skeleton, ThemedText, type IconName } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing, type ThemeColor } from '@/constants/theme';
import { useMyInvitations, useWorkspace } from '@/features/workspace';
import { InvitationCard } from '@/features/workspace/components/invitation-card';
import { useTheme } from '@/hooks/use-theme';
import { toast } from '@/stores/toast-store';
import type { AppNotification, NotificationKind } from '@/types/models';
import { displayName, errorMessage, timeAgo } from '@/utils/format';

import { useMarkAllRead, useMarkRead, useNotifications } from '../api';

const KIND: Record<NotificationKind, { icon: IconName; tone: ThemeColor }> = {
  ticket_created: { icon: 'issue-opened', tone: 'success' },
  ticket_assigned: { icon: 'person', tone: 'info' },
  ticket_reassigned: { icon: 'arrow-switch', tone: 'info' },
  comment_added: { icon: 'comment', tone: 'neutral' },
  status_changed: { icon: 'sync', tone: 'warning' },
  priority_changed: { icon: 'flame', tone: 'attention' },
  due_soon: { icon: 'clock', tone: 'attention' },
  overdue: { icon: 'alert', tone: 'danger' },
  invitation: { icon: 'mail', tone: 'done' },
};

function dayBucket(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000;
  if (diff <= 0) return 'Today';
  if (diff <= 1) return 'Yesterday';
  if (diff < 7) return 'This week';
  return 'Earlier';
}

type Row = { type: 'header'; label: string } | { type: 'item'; item: AppNotification };

export function NotificationsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { workspaceId } = useWorkspace();
  const list = useNotifications(workspaceId);
  const invitations = useMyInvitations();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead(workspaceId);

  const items = useMemo(() => list.data?.pages.flat() ?? [], [list.data]);
  const unread = items.filter((n) => !n.read_at).length;

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let last = '';
    for (const item of items) {
      const bucket = dayBucket(item.created_at);
      if (bucket !== last) {
        out.push({ type: 'header', label: bucket });
        last = bucket;
      }
      out.push({ type: 'item', item });
    }
    return out;
  }, [items]);

  const open = (n: AppNotification) => {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.ticket_id) router.push({ pathname: '/ticket/[id]', params: { id: n.ticket_id } });
    else if (n.kind === 'invitation') router.push('/invitations');
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <IconButton icon="arrow-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} filled />
        <View style={styles.flex}>
          <ThemedText style={styles.title} accessibilityRole="header">
            Notifications
          </ThemedText>
          {unread ? (
            <ThemedText type="caption" themeColor="textSecondary">
              {unread} unread
            </ThemedText>
          ) : null}
        </View>
        {unread ? (
          <Button
            title="Mark all read"
            size="sm"
            variant="secondary"
            icon="check"
            loading={markAll.isPending}
            onPress={() => markAll.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })}
          />
        ) : null}
      </View>
      {invitations.data?.length ? (
        <View style={styles.invites}>
          {invitations.data.map((inv) => (
            <InvitationCard key={inv.id} invitation={inv} onJoined={() => router.replace('/')} />
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <FlatList<Row>
        style={styles.list}
        contentContainerStyle={styles.grow}
        data={rows}
        keyExtractor={(row) => (row.type === 'header' ? `h-${row.label}` : row.item.id)}
        ListHeaderComponent={header}
        renderItem={({ item: row }) =>
          row.type === 'header' ? (
            <ThemedText type="caption" themeColor="textTertiary" style={styles.bucket}>
              {row.label}
            </ThemedText>
          ) : (
            <NotificationRow n={row.item} onPress={() => open(row.item)} />
          )
        }
        ListEmptyComponent={
          list.isLoading ? (
            <View style={styles.skeletons}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={56} style={styles.mb} />
              ))}
            </View>
          ) : (
            <View style={styles.center}>
              <EmptyState icon="bell" title="Nothing yet" />
            </View>
          )
        }
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={theme.textSecondary} />}
        ListFooterComponent={<View style={styles.bottom} />}
      />
    </View>
  );
}

function NotificationRow({ n, onPress }: { n: AppNotification; onPress: () => void }) {
  const theme = useTheme();
  const meta = KIND[n.kind];
  const unread = !n.read_at;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${n.title}. ${n.body}`}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.backgroundElement : unread ? theme.backgroundElement + '80' : 'transparent' }]}>
      <View>
        {n.actor ? (
          <Avatar size={40} name={displayName(n.actor)} uri={n.actor.avatar_url} />
        ) : (
          <View style={[styles.iconOnly, { backgroundColor: theme[`${meta.tone}Soft` as ThemeColor] }]}>
            <Icon name={meta.icon} size={16} color={theme[meta.tone]} />
          </View>
        )}
        {n.actor ? (
          <View style={[styles.kind, { backgroundColor: theme[meta.tone], borderColor: theme.background }]}>
            <Icon name={meta.icon} size={9} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      <View style={styles.flex}>
        <ThemedText style={[styles.rowTitle, { fontWeight: unread ? '700' : '500' }]} numberOfLines={2}>
          {n.title}
        </ThemedText>
        {n.body ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.rowBody}>
            {n.body}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.right}>
        <ThemedText type="caption" themeColor="textTertiary">
          {timeAgo(n.created_at)}
        </ThemedText>
        {unread ? <View style={[styles.unread, { backgroundColor: theme.info }]} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  list: { width: '100%', maxWidth: MaxContentWidth },
  header: { paddingHorizontal: Gutter, paddingTop: Spacing.two, gap: Spacing.three, paddingBottom: Spacing.two },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', paddingBottom: 96 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
  invites: { gap: Spacing.three },
  bucket: { paddingHorizontal: Gutter, paddingTop: Spacing.four, paddingBottom: Spacing.two, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: Gutter, paddingVertical: 12, alignItems: 'flex-start' },
  iconOnly: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  kind: { position: 'absolute', right: -3, bottom: -3, width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, lineHeight: 20 },
  rowBody: { fontWeight: '400', marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 8 },
  unread: { width: 8, height: 8, borderRadius: 4 },
  skeletons: { paddingHorizontal: Gutter },
  mb: { marginBottom: 10 },
  bottom: { height: Spacing.five },
});
