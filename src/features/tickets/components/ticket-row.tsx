import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Icon, ThemedText } from '@/components/ui';
import { Gutter, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Ticket } from '@/types/models';
import { displayName, dueLabel, isOverdue, ticketKey, timeAgo } from '@/utils/format';

import { CategoryTag, PriorityBars, StatusIcon } from './ticket-badges';

type Props = { ticket: Ticket; prefix?: string; compact?: boolean; inset?: boolean };

/** One ticket in a list: status glyph, key, title, then meta. Whole row is the tap target. */
export const TicketRow = memo(function TicketRow({ ticket, prefix, compact, inset = true }: Props) {
  const theme = useTheme();
  const overdue = isOverdue(ticket.due_at, ticket.status);
  const key = ticketKey(prefix, ticket.ticket_number);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/ticket/[id]', params: { id: ticket.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${key}, ${ticket.title}, ${ticket.status.replace('_', ' ')}, ${ticket.priority} priority`}
      style={({ pressed }) => [
        styles.row,
        inset && styles.inset,
        { backgroundColor: pressed ? theme.backgroundElement : 'transparent', borderBottomColor: theme.border },
      ]}>
      <View style={styles.status}>
        <StatusIcon status={ticket.status} />
      </View>
      <View style={styles.body}>
        <View style={styles.top}>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.key}>
            {key}
          </ThemedText>
          <ThemedText type="caption" themeColor="textTertiary">
            {timeAgo(ticket.updated_at)}
          </ThemedText>
        </View>
        <ThemedText style={styles.title} numberOfLines={compact ? 1 : 2}>
          {ticket.title}
        </ThemedText>
        {compact ? null : (
          <View style={styles.meta}>
            <PriorityBars priority={ticket.priority} />
            {ticket.category ? <CategoryTag name={ticket.category.name} color={ticket.category.color} /> : null}
            {ticket.due_at ? (
              <View style={styles.due}>
                <Icon name="clock" size={11} color={overdue ? theme.danger : theme.textSecondary} />
                <ThemedText style={[styles.dueText, { color: overdue ? theme.danger : theme.textSecondary }]}>
                  {dueLabel(ticket.due_at)}
                </ThemedText>
              </View>
            ) : null}
            <View style={styles.spacer} />
            {ticket.assignee ? (
              <Avatar size={22} name={displayName(ticket.assignee)} uri={ticket.assignee.avatar_url} />
            ) : (
              <View style={[styles.unassigned, { borderColor: theme.borderStrong }]} accessibilityLabel="Unassigned">
                <Icon name="person" size={11} tone="textTertiary" />
              </View>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  inset: { paddingHorizontal: Gutter },
  status: { paddingTop: 2 },
  body: { flex: 1, gap: 4 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  key: { fontVariant: ['tabular-nums'], fontWeight: '600' },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2, marginTop: 4 },
  due: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dueText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  spacer: { flex: 1 },
  unassigned: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
