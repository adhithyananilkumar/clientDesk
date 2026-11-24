import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon, ThemedText } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useIsOnline } from '@/hooks/use-network';
import { useTheme } from '@/hooks/use-theme';
import { kv } from '@/services/local-db';
import { toast } from '@/stores/toast-store';
import { errorMessage } from '@/utils/format';

import { useAddComment, type PickedFile } from '../api';
import { PendingFiles, useAttachmentPicker } from './attachments';

type Props = { workspaceId: string | null; ticketId: string; allowInternal: boolean };

/**
 * Reply box pinned under the discussion. Drafts survive leaving the screen;
 * replies written offline are queued and sent when the connection returns.
 */
export function Composer({ workspaceId, ticketId, allowInternal }: Props) {
  const theme = useTheme();
  const online = useIsOnline();
  const draftKey = `draft:comment:${ticketId}`;
  const [body, setBody] = useState(() => kv.get<string>(draftKey) ?? '');
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const add = useAddComment(workspaceId, ticketId);
  const picker = useAttachmentPicker(files.length, (picked) => setFiles((f) => [...f, ...picked]));

  useEffect(() => {
    const t = setTimeout(() => (body ? kv.set(draftKey, body) : kv.remove(draftKey)), 400);
    return () => clearTimeout(t);
  }, [body, draftKey]);

  const send = () => {
    const text = body.trim();
    if (!text || add.isPending) return;
    if (!online && files.length) return toast.error('Attachments need a connection. Remove them or try again online.');
    add.mutate(
      { body: text, isInternal: internal, files },
      {
        onSuccess: (result) => {
          setBody('');
          setFiles([]);
          kv.remove(draftKey);
          if (result.queued) toast.show('You’re offline. Your reply will be sent automatically.');
          else if (result.failures.length) toast.error(result.failures[0]);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const canSend = !!body.trim() && !add.isPending;

  return (
    <View style={styles.root}>
      {allowInternal ? (
        <View style={[styles.mode, { backgroundColor: theme.backgroundElement }]} accessibilityRole="tablist">
          {(
            [
              { value: false, label: 'Reply', icon: 'comment' },
              { value: true, label: 'Internal note', icon: 'lock' },
            ] as const
          ).map((m) => {
            const active = internal === m.value;
            return (
              <Pressable
                key={m.label}
                onPress={() => setInternal(m.value)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.modeItem, active && { backgroundColor: m.value ? theme.warningSoft : theme.surface }]}>
                <Icon name={m.icon} size={12} color={active ? (m.value ? theme.warning : theme.text) : theme.textSecondary} />
                <ThemedText style={[styles.modeText, { color: active ? (m.value ? theme.warning : theme.text) : theme.textSecondary }]}>
                  {m.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <PendingFiles files={files} onRemove={(i) => setFiles((f) => f.filter((_, index) => index !== i))} />
      <View
        style={[
          styles.box,
          { backgroundColor: internal ? theme.warningSoft : theme.backgroundElement, borderColor: internal ? theme.warning + '66' : 'transparent' },
        ]}>
        <Pressable onPress={picker.open} hitSlop={8} accessibilityLabel="Attach files" style={styles.attach}>
          <Icon name="paperclip" size={18} tone="textSecondary" />
        </Pressable>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={internal ? 'Note for admins only…' : 'Write a reply…'}
          placeholderTextColor={theme.textTertiary}
          selectionColor={theme.text}
          multiline
          maxLength={5000}
          accessibilityLabel={internal ? 'Internal note' : 'Reply'}
          style={[styles.input, { color: theme.text }]}
        />
        <Pressable
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={internal ? 'Add internal note' : 'Send reply'}
          style={[styles.send, { backgroundColor: canSend ? theme.text : theme.backgroundSelected }]}>
          <Icon name={add.isPending ? 'sync' : 'arrow-up'} size={16} color={canSend ? theme.background : theme.textTertiary} />
        </Pressable>
      </View>
      {picker.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  mode: { flexDirection: 'row', alignSelf: 'flex-start', borderRadius: Radius.pill, padding: 3 },
  modeItem: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 28, borderRadius: Radius.pill },
  modeText: { fontSize: 12, fontWeight: '700' },
  box: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 24, borderWidth: 1.5, paddingLeft: 6, paddingRight: 6, paddingVertical: 6, gap: 4 },
  attach: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontSize: 16, maxHeight: 140, paddingTop: 8, paddingBottom: 8 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
