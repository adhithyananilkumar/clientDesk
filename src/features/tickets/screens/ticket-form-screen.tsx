import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, EmptyState, FieldShell, FormField, Icon, Page, SelectField, ThemedText } from '@/components/ui';
import { PRIORITIES, PRIORITY } from '@/constants/tickets';
import { Radius, Spacing } from '@/constants/theme';
import { useCategories, useMembers, useWorkspace } from '@/features/workspace';
import { can, isAdmin } from '@/features/workspace/permissions';
import { useAuth } from '@/features/auth';
import { useTheme } from '@/hooks/use-theme';
import { kv } from '@/services/local-db';
import { toast } from '@/stores/toast-store';
import type { Ticket } from '@/types/models';
import { displayName, dueLabel, errorMessage, ticketKey } from '@/utils/format';
import { ticketSchema, type TicketValues } from '@/validation';

import { useCreateTicket, useTicket, useUpdateTicket, type PickedFile } from '../api';
import { PendingFiles, useAttachmentPicker } from '../components/attachments';
import { CategorySheet, DueDateSheet, MemberSheet } from '../components/pickers';

type Sheet = 'category' | 'assignee' | 'due' | null;

export function TicketFormScreen({ ticketId }: { ticketId?: string }) {
  const { workspaceId } = useWorkspace();
  const existing = useTicket(workspaceId, ticketId ?? '');
  if (ticketId && existing.isLoading) return <Page back="close" title="Edit ticket">{null}</Page>;
  if (ticketId && !existing.data) {
    return (
      <Page back="close" title="Edit ticket">
        <EmptyState icon="lock" title="Ticket not available" message="It may have been deleted, or you no longer have access." />
      </Page>
    );
  }
  return <TicketForm ticket={existing.data ?? undefined} />;
}

function TicketForm({ ticket }: { ticket?: Ticket }) {
  const theme = useTheme();
  const { user } = useAuth();
  const { workspace, workspaceId, role } = useWorkspace();
  const members = useMembers(workspaceId).data ?? [];
  const categories = useCategories(workspaceId).data ?? [];
  const create = useCreateTicket(workspaceId);
  const update = useUpdateTicket(workspaceId);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const picker = useAttachmentPicker(files.length, (picked) => setFiles((f) => [...f, ...picked]));

  const editing = !!ticket;
  const draftKey = `draft:ticket:${workspaceId}`;
  const enabled = workspace?.enabled_priorities ?? PRIORITIES;
  const canAssign = can.assign(role);
  const canEdit = !ticket || can.manageTicket(role, ticket, user?.id);

  const defaults = useMemo<TicketValues>(() => {
    if (ticket) {
      return {
        title: ticket.title,
        description: ticket.description,
        priority: ticket.priority,
        category_id: ticket.category_id,
        assigned_to: ticket.assigned_to,
        due_at: ticket.due_at,
      };
    }
    const draft = kv.get<TicketValues>(draftKey);
    return draft ?? {
      title: '',
      description: '',
      priority: workspace?.default_priority ?? 'medium',
      category_id: null,
      assigned_to: null,
      due_at: null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id]);

  const { control, handleSubmit, formState, setValue } = useForm<TicketValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: defaults,
  });
  const values = useWatch({ control });
  const [restoredDraft] = useState(() => !ticket && !!kv.get(draftKey));

  // Autosave new-ticket drafts so nothing is lost when leaving or going offline.
  useEffect(() => {
    if (editing) return;
    const t = setTimeout(() => {
      if (values.title || values.description) kv.set(draftKey, values);
    }, 500);
    return () => clearTimeout(t);
  }, [values, editing, draftKey]);

  const submit = handleSubmit(async (v) => {
    const payload = {
      title: v.title.trim(),
      description: v.description.trim(),
      priority: v.priority,
      category_id: v.category_id,
      assigned_to: canAssign ? v.assigned_to : (ticket?.assigned_to ?? null),
      due_at: v.due_at,
    };
    // Shown on the optimistic row until the server's copy arrives.
    const display = {
      assignee: members.find((m) => m.user_id === payload.assigned_to)?.profile ?? null,
      category: categories.find((c) => c.id === payload.category_id) ?? null,
    };
    try {
      if (ticket) {
        const patch = Object.fromEntries(
          Object.entries(payload).filter(([k, val]) => ticket[k as keyof Ticket] !== val),
        );
        if (!canAssign) delete (patch as Record<string, unknown>).assigned_to;
        const result = Object.keys(patch).length ? await update.mutateAsync({ ticket, patch, display }) : null;
        if (result?.queued) toast.show('Saved offline. It will sync when you’re back online.');
        else toast.success('Ticket updated');
        router.back();
      } else {
        const { ticket: created, failures, queued } = await create.mutateAsync({ values: payload, files, display });
        kv.remove(draftKey);
        if (queued) toast.show('You’re offline. The ticket is saved and will sync automatically.');
        else if (failures.length) toast.error(failures[0]);
        else toast.success(`${ticketKey(workspace?.ticket_prefix, created.ticket_number)} created`);
        router.replace({ pathname: '/ticket/[id]', params: { id: created.id } });
      }
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  const assignee = members.find((m) => m.user_id === values.assigned_to);
  const category = categories.find((c) => c.id === values.category_id);

  if (!canEdit) {
    return (
      <Page back="close" title="Edit ticket">
        <EmptyState icon="lock" title="You can’t edit this ticket" message="Members can edit tickets they created or are assigned to." />
      </Page>
    );
  }

  return (
    <Page
      back="close"
      title={editing ? 'Edit ticket' : 'New ticket'}
      subtitle={editing ? ticketKey(workspace?.ticket_prefix, ticket!.ticket_number) : `in ${workspace?.name}`}
      actions={
        !editing && (values.title || values.description) ? (
          <Button
            title="Discard"
            variant="ghost"
            size="sm"
            onPress={() => {
              kv.remove(draftKey);
              router.back();
            }}
          />
        ) : null
      }
      footer={
        <Button
          title={editing ? 'Save changes' : files.length ? `Create ticket · ${files.length} file${files.length > 1 ? 's' : ''}` : 'Create ticket'}
          onPress={submit}
          loading={create.isPending || update.isPending}
        />
      }>
      {restoredDraft ? (
        <View style={[styles.notice, { backgroundColor: theme.infoSoft }]}>
          <Icon name="history" size={14} tone="info" />
          <ThemedText type="small" style={{ color: theme.info, flex: 1 }}>
            Restored your unsent draft.
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.form}>
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <FormField
              label="Title"
              placeholder="Short summary, e.g. Can’t log in on Android"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={formState.errors.title?.message}
              autoFocus={!editing}
              returnKeyType="next"
              maxLength={200}
            />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <FormField
              label="Description"
              placeholder="What happened? Steps to reproduce, who’s affected, anything you’ve tried."
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={formState.errors.description?.message}
              multiline
              style={styles.description}
            />
          )}
        />

        <FieldShell label="Priority">
          <View style={styles.priorities}>
            {PRIORITIES.filter((p) => enabled.includes(p)).map((p) => {
              const active = values.priority === p;
              const tone = theme[PRIORITY[p].tone];
              return (
                <Pressable
                  key={p}
                  onPress={() => setValue('priority', p, { shouldDirty: true })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.priority,
                    { borderColor: active ? tone : theme.border, backgroundColor: active ? theme[`${PRIORITY[p].tone}Soft` as 'infoSoft'] : theme.surface },
                  ]}>
                  <Icon name={PRIORITY[p].icon} size={14} color={tone} />
                  <ThemedText style={[styles.priorityText, active && { color: tone }]}>{PRIORITY[p].label}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </FieldShell>

        <SelectField
          label="Category"
          optional
          placeholder="Choose a category"
          value={category?.name}
          leading={category ? <View style={[styles.swatch, { backgroundColor: category.color }]} /> : <Icon name="tag" size={16} tone="textSecondary" />}
          onPress={() => setSheet('category')}
        />

        {canAssign ? (
          <SelectField
            label="Assignee"
            optional
            placeholder={workspace?.default_assignee_id && !editing ? 'Default assignee' : 'Unassigned'}
            value={assignee ? displayName(assignee.profile) : null}
            leading={assignee ? <Avatar size={24} name={displayName(assignee.profile)} uri={assignee.profile?.avatar_url} /> : <Icon name="person" size={16} tone="textSecondary" />}
            onPress={() => setSheet('assignee')}
          />
        ) : null}

        <SelectField
          label="Due date"
          optional
          placeholder="No due date"
          value={values.due_at ? `${new Date(values.due_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${dueLabel(values.due_at)}` : null}
          leading={<Icon name="calendar" size={16} tone="textSecondary" />}
          onPress={() => setSheet('due')}
        />

        {!editing ? (
          <FieldShell label="Attachments" optional hint="Images, PDF, Word, Excel or text · up to 5 files, 10 MB each">
            <PendingFiles files={files} onRemove={(i) => setFiles((f) => f.filter((_, index) => index !== i))} />
            <Button title="Add files" icon="paperclip" variant="secondary" size="md" onPress={picker.open} />
          </FieldShell>
        ) : null}
      </View>

      <CategorySheet visible={sheet === 'category'} onClose={() => setSheet(null)} value={values.category_id ?? null} onSelect={(v) => setValue('category_id', v)} categories={categories} />
      <MemberSheet visible={sheet === 'assignee'} onClose={() => setSheet(null)} value={values.assigned_to ?? null} onSelect={(v) => setValue('assigned_to', v)} members={members} />
      <DueDateSheet visible={sheet === 'due'} onClose={() => setSheet(null)} value={values.due_at ?? null} onSelect={(v) => setValue('due_at', v)} />
      {picker.sheet}
      {isAdmin(role) || editing ? null : (
        <ThemedText type="caption" themeColor="textTertiary" style={styles.footnote}>
          An admin will assign this ticket. You’ll be notified about updates.
        </ThemedText>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.four - 4 },
  description: { minHeight: 140 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: 12, borderRadius: Radius.md, marginBottom: Spacing.three },
  priorities: { flexDirection: 'row', gap: Spacing.two },
  priority: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  priorityText: { fontSize: 14, fontWeight: '600' },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  footnote: { textAlign: 'center', marginTop: Spacing.four },
});
