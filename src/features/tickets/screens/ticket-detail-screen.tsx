import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';

import {
  Avatar,
  Button,
  EmptyState,
  Icon,
  IconButton,
  OptionSheet,
  Page,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  ThemedText,
  type IconName,
} from '@/components/ui';
import { PRIORITY, STATUS } from '@/constants/tickets';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { useCategories, useMemberMap, useMembers, useWorkspace } from '@/features/workspace';
import { can } from '@/features/workspace/permissions';
import { useIsOnline } from '@/hooks/use-network';
import { useTheme } from '@/hooks/use-theme';
import { toast } from '@/stores/toast-store';
import { pendingComments } from '@/sync/outbox';
import type { Attachment, Comment, Ticket } from '@/types/models';
import { displayName, dueLabel, errorMessage, isOverdue, longDateTime, ticketKey, timeAgo } from '@/utils/format';

import {
  useActivity,
  useAttachments,
  useComments,
  useDeleteAttachment,
  useDeleteTicket,
  useTicket,
  useUpdateTicket,
  useUploadAttachments,
  type TicketPatch,
} from '../api';
import { AttachmentGrid, useAttachmentPicker } from '../components/attachments';
import { Composer } from '../components/composer';
import { ActivityItem, CommentItem } from '../components/discussion';
import { CategorySheet, DueDateSheet, MemberSheet, PrioritySheet, StatusSheet } from '../components/pickers';
import { CategoryTag, PriorityPill, StatusPill } from '../components/ticket-badges';

type SheetName = 'status' | 'priority' | 'assignee' | 'category' | 'due' | 'menu' | null;

export function TicketDetailScreen({ id }: { id: string }) {
  const { workspaceId, workspace, role } = useWorkspace();
  const ticket = useTicket(workspaceId, id);

  if (ticket.isLoading && !ticket.data) {
    return (
      <Page back>
        <View style={styles.loading}>
          <Skeleton width="30%" height={12} />
          <Skeleton width="90%" height={26} />
          <Skeleton width="70%" height={26} />
          <Skeleton height={120} style={styles.mtLg} />
        </View>
      </Page>
    );
  }
  if (!ticket.data) {
    return (
      <Page back>
        <EmptyState
          icon="lock"
          title="Ticket not available"
          message="It may have been deleted, or you don’t have access to it."
          action={<Button title="Back to tickets" variant="secondary" onPress={() => router.replace('/tickets')} />}
        />
      </Page>
    );
  }
  return <TicketDetail ticket={ticket.data} prefix={workspace?.ticket_prefix} role={role} workspaceId={workspaceId} refetch={ticket.refetch} refreshing={ticket.isRefetching} />;
}

function TicketDetail({
  ticket,
  prefix,
  role,
  workspaceId,
  refetch,
  refreshing,
}: {
  ticket: Ticket;
  prefix?: string;
  role: ReturnType<typeof useWorkspace>['role'];
  workspaceId: string | null;
  refetch: () => void;
  refreshing: boolean;
}) {
  const theme = useTheme();
  const online = useIsOnline();
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const members = useMembers(workspaceId).data ?? [];
  const memberMap = useMemberMap(workspaceId);
  const categories = useCategories(workspaceId).data ?? [];
  const comments = useComments(workspaceId, ticket.id);
  const attachments = useAttachments(workspaceId, ticket.id);
  const activity = useActivity(workspaceId, ticket.id);
  const update = useUpdateTicket(workspaceId);
  const remove = useDeleteTicket(workspaceId);
  const upload = useUploadAttachments(workspaceId, ticket.id);
  const deleteAttachment = useDeleteAttachment(workspaceId, ticket.id);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [tab, setTab] = useState<'discussion' | 'activity'>('discussion');
  const [expanded, setExpanded] = useState(false);

  const key = ticketKey(prefix, ticket.ticket_number);
  const manage = can.manageTicket(role, ticket, user?.id);
  const assign = can.assign(role);
  const admin = can.deleteTicket(role);
  const overdue = isOverdue(ticket.due_at, ticket.status);

  const picker = useAttachmentPicker(0, (files) =>
    upload.mutate(files, {
      onSuccess: (failures) => (failures.length ? toast.error(failures[0]) : toast.success(files.length > 1 ? `${files.length} files attached` : 'File attached')),
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  const change = (patch: TicketPatch, message?: string) => {
    Haptics.selectionAsync().catch(() => undefined);
    update.mutate(
      { ticket, patch },
      {
        onSuccess: (r) => (r.queued ? toast.show('Saved offline. It will sync when you’re back online.') : message ? toast.success(message) : undefined),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  // Comments: server list + anything queued offline, chronological.
  const thread = useMemo<Comment[]>(() => {
    const server = comments.data ?? [];
    const queued = pendingComments(ticket.id)
      .filter((op) => !server.some((c) => c.id === op.payload.id))
      .map<Comment>((op) => ({
        ...op.payload,
        workspace_id: op.workspaceId,
        author_id: user?.id ?? '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        edited_at: null,
        author: memberMap.get(user?.id ?? '')?.profile ?? null,
        pending: true,
      }));
    const optimistic = server.filter((c) => c.pending && !queued.some((q) => q.id === c.id));
    return [...server.filter((c) => !c.pending), ...optimistic, ...queued];
  }, [comments.data, ticket.id, user?.id, memberMap]);

  const allFiles = useMemo(() => attachments.data ?? [], [attachments.data]);
  const ticketFiles = allFiles.filter((a) => !a.comment_id);
  const filesByComment = useMemo(() => {
    const map = new Map<string, Attachment[]>();
    for (const a of allFiles) if (a.comment_id) map.set(a.comment_id, [...(map.get(a.comment_id) ?? []), a]);
    return map;
  }, [allFiles]);

  const canDeleteAttachment = (a: Attachment) => a.uploaded_by === user?.id || admin;
  const onDeleteAttachment = (a: Attachment) =>
    deleteAttachment.mutate(a.id, { onSuccess: () => toast.success('Attachment deleted'), onError: (e) => toast.error(errorMessage(e)) });

  const confirmDelete = () =>
    Alert.alert(`Delete ${key}?`, 'The ticket disappears for everyone. Its history is kept for the audit trail.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete ticket',
        style: 'destructive',
        onPress: () =>
          remove.mutate(ticket.id, {
            onSuccess: () => {
              toast.success(`${key} deleted`);
              router.back();
            },
            onError: (e) => toast.error(errorMessage(e)),
          }),
      },
    ]);

  // Next step in the workflow, as one big obvious button.
  const nextStep: { label: string; patch: TicketPatch; icon: IconName } | null =
    !manage
      ? null
      : ticket.status === 'open'
        ? { label: 'Start progress', patch: { status: 'in_progress' }, icon: 'play' }
        : ticket.status === 'in_progress'
          ? { label: 'Mark resolved', patch: { status: 'resolved' }, icon: 'check' }
          : ticket.status === 'resolved'
            ? { label: 'Close ticket', patch: { status: 'closed' }, icon: 'skip' }
            : { label: 'Reopen', patch: { status: 'open' }, icon: 'issue-reopened' };

  const longDescription = ticket.description.length > 320;

  return (
    <Page
      back
      refreshing={refreshing}
      onRefresh={() => {
        refetch();
        comments.refetch();
        attachments.refetch();
        activity.refetch();
      }}
      actions={
        <>
          {online ? null : <Icon name="cloud-offline" size={18} tone="textSecondary" />}
          <IconButton icon="kebab-horizontal" label="Ticket actions" onPress={() => setSheet('menu')} filled />
        </>
      }
      footer={<Composer workspaceId={workspaceId} ticketId={ticket.id} allowInternal={can.internalNotes(role)} />}>
      {/* Heading */}
      <View style={styles.heading}>
        <View style={styles.keyRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.key} selectable>
            {key}
          </ThemedText>
          <StatusPill status={ticket.status} />
        </View>
        <ThemedText style={styles.title} selectable accessibilityRole="header">
          {ticket.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.byline}>
          {displayName(ticket.creator)} opened {timeAgo(ticket.created_at)} ago · updated {timeAgo(ticket.updated_at)}
        </ThemedText>
      </View>

      {nextStep ? (
        <View style={styles.primaryAction}>
          <Button title={nextStep.label} icon={nextStep.icon} onPress={() => change(nextStep.patch, `${key} · ${STATUS[nextStep.patch.status!].label}`)} />
        </View>
      ) : null}

      {/* Description */}
      <View style={[styles.description, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={styles.descriptionText} selectable numberOfLines={expanded || !longDescription ? undefined : 8}>
          {ticket.description || 'No description.'}
        </ThemedText>
        {longDescription ? (
          <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={8}>
            <ThemedText type="small" style={styles.more}>
              {expanded ? 'Show less' : 'Show more'}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {/* Properties */}
      <View style={[styles.props, { borderColor: theme.border }]}>
        <Prop label="Status" onPress={manage ? () => setSheet('status') : undefined}>
          <StatusPill status={ticket.status} small />
        </Prop>
        <Prop label="Priority" onPress={manage ? () => setSheet('priority') : undefined}>
          <PriorityPill priority={ticket.priority} small />
        </Prop>
        <Prop label="Assignee" onPress={assign ? () => setSheet('assignee') : undefined}>
          {ticket.assignee ? (
            <View style={styles.person}>
              <Avatar size={22} name={displayName(ticket.assignee)} uri={ticket.assignee.avatar_url} />
              <ThemedText style={styles.propValue} numberOfLines={1}>
                {displayName(ticket.assignee)}
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.propValue} themeColor="textTertiary">
              {assign ? 'Assign someone' : 'Unassigned'}
            </ThemedText>
          )}
        </Prop>
        <Prop label="Category" onPress={manage ? () => setSheet('category') : undefined}>
          {ticket.category ? (
            <CategoryTag name={ticket.category.name} color={ticket.category.color} />
          ) : (
            <ThemedText style={styles.propValue} themeColor="textTertiary">
              None
            </ThemedText>
          )}
        </Prop>
        <Prop label="Due" onPress={manage ? () => setSheet('due') : undefined}>
          <ThemedText style={[styles.propValue, overdue && { color: theme.danger }]} themeColor={ticket.due_at ? 'text' : 'textTertiary'}>
            {ticket.due_at ? dueLabel(ticket.due_at) : 'No due date'}
          </ThemedText>
        </Prop>
        <Prop label="Created by">
          <View style={styles.person}>
            <Avatar size={22} name={displayName(ticket.creator)} uri={ticket.creator?.avatar_url} />
            <ThemedText style={styles.propValue} numberOfLines={1}>
              {displayName(ticket.creator)}
            </ThemedText>
          </View>
        </Prop>
        <Prop label="Created">
          <ThemedText style={styles.propValue}>{longDateTime(ticket.created_at)}</ThemedText>
        </Prop>
        <Prop label="Last updated" last>
          <ThemedText style={styles.propValue}>{longDateTime(ticket.updated_at)}</ThemedText>
        </Prop>
      </View>

      {/* Attachments */}
      <SectionHeader title={`Attachments${ticketFiles.length ? ` · ${ticketFiles.length}` : ''}`} action={online ? '+ Add' : undefined} onAction={picker.open} />
      {upload.isPending ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.uploading}>
          Uploading…
        </ThemedText>
      ) : null}
      {ticketFiles.length ? (
        <AttachmentGrid attachments={ticketFiles} canDelete={canDeleteAttachment} onDelete={onDeleteAttachment} />
      ) : (
        <ThemedText type="small" themeColor="textTertiary" style={styles.regular}>
          No files yet. Screenshots and documents help others understand the issue.
        </ThemedText>
      )}

      {/* Discussion / activity */}
      <View style={styles.tabs}>
        <SegmentedControl
          segments={[
            { value: 'discussion', label: 'Discussion', count: thread.length },
            { value: 'activity', label: 'Activity', count: activity.data?.length },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === 'discussion' ? (
        thread.length ? (
          thread.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              attachments={filesByComment.get(comment.id) ?? []}
              mine={comment.author_id === user?.id}
              workspaceId={workspaceId}
              canDeleteAttachment={canDeleteAttachment}
              onDeleteAttachment={onDeleteAttachment}
            />
          ))
        ) : (
          <EmptyState icon="comment-discussion" title="No replies yet" message="Ask a question or post an update below." />
        )
      ) : (
        <View>
          {(activity.data ?? []).map((a, i, list) => (
            <ActivityItem key={a.id} activity={a} members={memberMap} categories={categories} last={i === list.length - 1} />
          ))}
        </View>
      )}

      {/* Sheets */}
      <StatusSheet visible={sheet === 'status'} onClose={() => setSheet(null)} value={ticket.status} onSelect={(status) => status !== ticket.status && change({ status }, `Status: ${STATUS[status].label}`)} />
      <PrioritySheet
        visible={sheet === 'priority'}
        onClose={() => setSheet(null)}
        value={ticket.priority}
        enabled={workspace?.enabled_priorities}
        onSelect={(priority) => priority !== ticket.priority && change({ priority }, `Priority: ${PRIORITY[priority].label}`)}
      />
      <MemberSheet
        visible={sheet === 'assignee'}
        onClose={() => setSheet(null)}
        value={ticket.assigned_to}
        members={members}
        onSelect={(assigned_to) =>
          assigned_to !== ticket.assigned_to &&
          change({ assigned_to }, assigned_to ? `Assigned to ${displayName(memberMap.get(assigned_to)?.profile)}` : 'Unassigned')
        }
      />
      <CategorySheet visible={sheet === 'category'} onClose={() => setSheet(null)} value={ticket.category_id} categories={categories} onSelect={(category_id) => change({ category_id })} />
      <DueDateSheet visible={sheet === 'due'} onClose={() => setSheet(null)} value={ticket.due_at} onSelect={(due_at) => change({ due_at }, due_at ? dueLabel(due_at) : 'Due date removed')} />
      <OptionSheet
        visible={sheet === 'menu'}
        onClose={() => setSheet(null)}
        title={key}
        options={[
          ...(manage ? [{ value: 'edit', label: 'Edit ticket', icon: 'pencil' as const }] : []),
          ...(assign && ticket.assigned_to !== user?.id ? [{ value: 'me', label: 'Assign to me', icon: 'person' as const }] : []),
          { value: 'share', label: 'Share ticket', icon: 'share' },
          ...(admin ? [{ value: 'delete', label: 'Delete ticket', icon: 'trash' as const, destructive: true }] : []),
        ]}
        onSelect={(choice) => {
          if (choice === 'edit') router.push({ pathname: '/ticket/edit/[id]', params: { id: ticket.id } });
          if (choice === 'me' && user) change({ assigned_to: user.id }, 'Assigned to you');
          if (choice === 'share') Share.share({ message: `${key} · ${ticket.title}\nclientdesk://ticket/${ticket.id}` });
          if (choice === 'delete') setTimeout(confirmDelete, 250);
        }}
      />
      {picker.sheet}
    </Page>
  );
}

function Prop({ label, children, onPress, last }: { label: string; children: React.ReactNode; onPress?: () => void; last?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Change ${label.toLowerCase()}` : label}
      style={({ pressed }) => [
        styles.prop,
        !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.propLabel}>
        {label}
      </ThemedText>
      <View style={styles.propRight}>{children}</View>
      {onPress ? <Icon name="chevron-right" size={14} tone="textTertiary" /> : <View style={styles.chevronSpace} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { gap: 12, paddingTop: Spacing.three },
  mtLg: { marginTop: Spacing.four },
  heading: { gap: Spacing.two, marginBottom: Spacing.four },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  key: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.5 },
  byline: { fontWeight: '400' },
  primaryAction: { marginBottom: Spacing.four },
  description: { borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two },
  descriptionText: { fontSize: 16, lineHeight: 24 },
  more: { fontWeight: '700' },
  props: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, marginTop: Spacing.four, overflow: 'hidden' },
  prop: { flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingHorizontal: Spacing.three, gap: Spacing.two },
  propLabel: { width: 104, fontWeight: '500' },
  propRight: { flex: 1, alignItems: 'flex-start' },
  propValue: { fontSize: 15, fontWeight: '500' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  chevronSpace: { width: 14 },
  uploading: { marginBottom: Spacing.two },
  regular: { fontWeight: '400' },
  tabs: { marginTop: Spacing.five, marginBottom: Spacing.four },
});
