import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar, Button, Icon, OptionSheet, Pill, ThemedText } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toast } from '@/stores/toast-store';
import type { Activity, Attachment, Category, Comment, Member } from '@/types/models';
import { displayName, errorMessage, longDateTime, timeAgo } from '@/utils/format';

import { describeActivity } from '../activity-text';
import { useDeleteComment, useEditComment } from '../api';
import { AttachmentGrid } from './attachments';

type CommentProps = {
  comment: Comment;
  attachments: Attachment[];
  mine: boolean;
  workspaceId: string | null;
  canDeleteAttachment: (a: Attachment) => boolean;
  onDeleteAttachment: (a: Attachment) => void;
};

export function CommentItem({ comment, attachments, mine, workspaceId, canDeleteAttachment, onDeleteAttachment }: CommentProps) {
  const theme = useTheme();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const edit = useEditComment(workspaceId, comment.ticket_id);
  const remove = useDeleteComment(workspaceId, comment.ticket_id);
  const name = displayName(comment.author);
  const internal = comment.is_internal;

  const save = () => {
    const body = draft.trim();
    if (!body) return;
    edit.mutate(
      { id: comment.id, body },
      { onSuccess: () => setEditing(false), onError: (e) => toast.error(errorMessage(e)) },
    );
  };

  return (
    <View style={[styles.comment, { opacity: comment.pending ? 0.6 : 1 }]}>
      <Avatar size={32} name={name} uri={comment.author?.avatar_url} />
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: internal ? theme.warningSoft : theme.surface,
            borderColor: internal ? theme.warning + '55' : theme.border,
          },
        ]}>
        <View style={styles.commentHead}>
          <ThemedText style={styles.author} numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText type="caption" themeColor="textTertiary" accessibilityLabel={longDateTime(comment.created_at)}>
            {comment.pending ? 'Waiting to send' : timeAgo(comment.created_at)}
            {comment.edited_at ? ' · edited' : ''}
          </ThemedText>
          <View style={styles.flex} />
          {internal ? <Pill label="Internal" icon="lock" tone="warning" small /> : null}
          {mine && !comment.pending ? (
            <Pressable onPress={() => setMenu(true)} hitSlop={10} accessibilityLabel="Comment options">
              <Icon name="kebab-horizontal" size={16} tone="textSecondary" />
            </Pressable>
          ) : null}
        </View>
        {editing ? (
          <View style={styles.editBox}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              autoFocus
              style={[styles.editInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.borderStrong }]}
              accessibilityLabel="Edit comment"
            />
            <View style={styles.editActions}>
              <Button title="Cancel" variant="secondary" size="sm" onPress={() => { setDraft(comment.body); setEditing(false); }} />
              <Button title="Save" size="sm" onPress={save} loading={edit.isPending} />
            </View>
          </View>
        ) : (
          <ThemedText style={styles.body} selectable>
            {comment.body}
          </ThemedText>
        )}
        {attachments.length ? (
          <View style={styles.commentFiles}>
            <AttachmentGrid attachments={attachments} canDelete={canDeleteAttachment} onDelete={onDeleteAttachment} />
          </View>
        ) : null}
      </View>
      <OptionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={internal ? 'Internal note' : 'Comment'}
        options={[
          { value: 'edit', label: 'Edit', icon: 'pencil' },
          { value: 'delete', label: 'Delete', icon: 'trash', destructive: true },
        ]}
        onSelect={(choice) => {
          if (choice === 'edit') return setEditing(true);
          Alert.alert('Delete this comment?', 'This can’t be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(comment.id, { onError: (e) => toast.error(errorMessage(e)) }) },
          ]);
        }}
      />
    </View>
  );
}

export function ActivityItem({
  activity,
  members,
  categories,
  last,
}: {
  activity: Activity;
  members: Map<string, Member>;
  categories: Category[];
  last?: boolean;
}) {
  const theme = useTheme();
  const { text, icon, tone } = describeActivity(activity, members, categories);
  return (
    <View style={styles.activity}>
      <View style={styles.rail}>
        <View style={[styles.node, { backgroundColor: theme[`${tone}Soft` as 'neutralSoft'] ?? theme.backgroundElement }]}>
          <Icon name={icon} size={12} color={theme[tone]} />
        </View>
        {last ? null : <View style={[styles.line, { backgroundColor: theme.border }]} />}
      </View>
      <View style={styles.activityText}>
        <ThemedText type="small" style={styles.activityLine}>
          <ThemedText type="small" style={styles.actor}>
            {activity.actor ? displayName(activity.actor) : 'System'}
          </ThemedText>{' '}
          <ThemedText type="small" themeColor="textSecondary" style={styles.regular}>
            {text}
          </ThemedText>
        </ThemedText>
        <ThemedText type="caption" themeColor="textTertiary">
          {longDateTime(activity.created_at)}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  comment: { flexDirection: 'row', gap: 10, marginBottom: Spacing.three },
  bubble: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, padding: 12, gap: 6 },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  author: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  body: { fontSize: 15, lineHeight: 22 },
  commentFiles: { marginTop: 4 },
  editBox: { gap: Spacing.two },
  editInput: { minHeight: 80, borderWidth: 1, borderRadius: Radius.md, padding: 10, fontSize: 15, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  activity: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 26 },
  node: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, minHeight: 14, marginVertical: 2 },
  activityText: { flex: 1, paddingBottom: Spacing.three, gap: 2, paddingTop: 3 },
  activityLine: { lineHeight: 20 },
  actor: { fontWeight: '700' },
  regular: { fontWeight: '400' },
});
