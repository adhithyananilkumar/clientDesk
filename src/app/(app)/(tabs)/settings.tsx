import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  Avatar,
  Button,
  Chip,
  FieldShell,
  FormField,
  Icon,
  ListGroup,
  ListRow,
  OptionSheet,
  Page,
  SectionHeader,
  ThemedText,
} from '@/components/ui';
import { PRIORITIES, PRIORITY } from '@/constants/tickets';
import { Radius, Spacing } from '@/constants/theme';
import { MemberSheet } from '@/features/tickets/components/pickers';
import {
  uploadPublicImage,
  useCategories,
  useDeleteWorkspace,
  useLeaveWorkspace,
  useMembers,
  useUpdateWorkspace,
  useWorkspace,
  type WorkspacePatch,
} from '@/features/workspace';
import { can } from '@/features/workspace/permissions';
import { useTheme } from '@/hooks/use-theme';
import { toast } from '@/stores/toast-store';
import type { TicketPriority, Workspace } from '@/types/models';
import { displayName, errorMessage, ticketKey } from '@/utils/format';
import { workspaceSchema } from '@/validation';

const TIMEZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Africa/Lagos',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

type SheetName = 'timezone' | 'priority' | 'assignee' | 'visibility' | null;

export default function WorkspaceSettings() {
  const { workspace, role } = useWorkspace();
  if (!workspace || !can.editWorkspace(role)) {
    return <MemberView />;
  }
  return <Settings key={workspace.id} workspace={workspace} />;
}

/** Members only get the option to leave. */
function MemberView() {
  const { workspace, role } = useWorkspace();
  const leave = useLeaveWorkspace();
  return (
    <Page title="Workspace" subtitle={workspace?.name}>
      <ThemedText themeColor="textSecondary" style={styles.regular}>
        Only owners and admins can change workspace settings.
      </ThemedText>
      {can.leaveWorkspace(role) && workspace ? (
        <Button
          title="Leave workspace"
          variant="danger"
          style={styles.mtLg}
          loading={leave.isPending}
          onPress={() =>
            Alert.alert(`Leave ${workspace.name}?`, 'You’ll need a new invitation to come back.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Leave', style: 'destructive', onPress: () => leave.mutate(workspace.id, { onSuccess: () => router.replace('/'), onError: (e) => toast.error(errorMessage(e)) }) },
            ])
          }
        />
      ) : null}
    </Page>
  );
}

function Settings({ workspace }: { workspace: Workspace }) {
  const theme = useTheme();
  const { role, workspaceId } = useWorkspace();
  const update = useUpdateWorkspace(workspaceId);
  const remove = useDeleteWorkspace();
  const leave = useLeaveWorkspace();
  const members = useMembers(workspaceId).data ?? [];
  const categories = useCategories(workspaceId).data ?? [];
  const owner = can.editTicketConfig(role);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description);
  const [prefix, setPrefix] = useState(workspace.ticket_prefix);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  const save = (patch: WorkspacePatch, message = 'Saved') =>
    update.mutate(patch, { onSuccess: () => toast.success(message), onError: (e) => toast.error(errorMessage(e)) });

  const dirtyGeneral = name !== workspace.name || description !== workspace.description;
  const saveGeneral = () => {
    const parsed = workspaceSchema.safeParse({ name, description });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return setErrors({ [String(issue.path[0])]: issue.message });
    }
    setErrors({});
    save({ name: parsed.data.name, description: parsed.data.description });
  };

  const savePrefix = () => {
    const clean = prefix.trim().toUpperCase();
    if (!/^[A-Z]{2,5}$/.test(clean)) return setErrors({ prefix: 'Use 2–5 letters, e.g. CD' });
    setErrors({});
    if (clean !== workspace.ticket_prefix) save({ ticket_prefix: clean }, `Tickets now look like ${ticketKey(clean, 1)}`);
  };

  const togglePriority = (p: TicketPriority) => {
    const next = workspace.enabled_priorities.includes(p) ? workspace.enabled_priorities.filter((x) => x !== p) : [...workspace.enabled_priorities, p];
    if (!next.length) return toast.error('Keep at least one priority');
    if (!next.includes(workspace.default_priority)) return toast.error('Change the default priority first');
    save({ enabled_priorities: PRIORITIES.filter((x) => next.includes(x)) });
  };

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled) return;
    setUploading(true);
    try {
      const url = await uploadPublicImage(`workspaces/${workspace.id}`, result.assets[0].uri, result.assets[0].mimeType ?? 'image/jpeg');
      await update.mutateAsync({ logo_url: url });
      toast.success('Logo updated');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      `Delete ${workspace.name}?`,
      'Every ticket, comment, attachment and member will be permanently deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: () =>
            remove.mutate(workspace.id, {
              onSuccess: () => {
                toast.success('Workspace deleted');
                router.replace('/');
              },
              onError: (e) => toast.error(errorMessage(e)),
            }),
        },
      ],
    );
  };

  const defaultAssignee = members.find((m) => m.user_id === workspace.default_assignee_id);
  const lockNote = owner ? undefined : 'Only the owner can change this';

  return (
    <Page title="Workspace settings" subtitle={workspace.name}>
      {/* General */}
      <SectionHeader title="General" />
      <View style={styles.logoRow}>
        <Pressable onPress={pickLogo} accessibilityRole="button" accessibilityLabel="Change workspace logo">
          <Avatar size={64} name={workspace.name} uri={workspace.logo_url} square />
          <View style={[styles.logoEdit, { backgroundColor: theme.text, borderColor: theme.background }]}>
            <Icon name={uploading ? 'sync' : 'pencil'} size={11} color={theme.background} />
          </View>
        </Pressable>
        <View style={styles.flex}>
          <ThemedText style={styles.bold}>Logo</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.regular}>
            Shown in the workspace switcher.
          </ThemedText>
        </View>
      </View>
      <View style={styles.form}>
        <FormField label="Name" value={name} onChangeText={setName} error={errors.name} maxLength={60} />
        <FormField label="Description" optional value={description} onChangeText={setDescription} error={errors.description} multiline style={styles.desc} maxLength={280} />
        {dirtyGeneral ? <Button title="Save changes" size="md" onPress={saveGeneral} loading={update.isPending} /> : null}
      </View>
      <ListGroup style={styles.mt}>
        <ListRow icon="globe" title="Default timezone" value={workspace.timezone} onPress={() => setSheet('timezone')} />
        <ListRow icon={PRIORITY[workspace.default_priority].icon} title="Default ticket priority" value={PRIORITY[workspace.default_priority].label} onPress={() => setSheet('priority')} last />
      </ListGroup>

      {/* Tickets */}
      <SectionHeader title="Tickets" />
      <ListGroup>
        <ListRow icon="tag" title="Categories" value={`${categories.length}`} onPress={() => router.push('/workspace/categories')} last />
      </ListGroup>

      <View style={styles.form}>
        <FieldShell label="Ticket ID prefix" hint={errors.prefix ? undefined : lockNote ?? `New tickets look like ${ticketKey(prefix || 'CD', 1)}`} error={errors.prefix}>
          <View style={styles.prefixRow}>
            <TextInput
              value={prefix}
              onChangeText={(t) => setPrefix(t.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5))}
              editable={owner}
              autoCapitalize="characters"
              accessibilityLabel="Ticket ID prefix"
              style={[styles.prefix, { color: theme.text, backgroundColor: theme.backgroundElement, opacity: owner ? 1 : 0.6 }]}
            />
            {owner && prefix !== workspace.ticket_prefix ? <Button title="Save" size="md" onPress={savePrefix} /> : null}
          </View>
        </FieldShell>

        <FieldShell label="Available priorities" hint={lockNote}>
          <View style={styles.chips}>
            {PRIORITIES.map((p) => (
              <Chip key={p} label={PRIORITY[p].label} icon={PRIORITY[p].icon} selected={workspace.enabled_priorities.includes(p)} onPress={() => (owner ? togglePriority(p) : toast.show('Only the owner can change this'))} />
            ))}
          </View>
        </FieldShell>
      </View>

      <ListGroup style={styles.mt}>
        <ListRow
          icon="person"
          title="Default assignment"
          subtitle={lockNote}
          value={defaultAssignee ? displayName(defaultAssignee.profile) : 'Leave unassigned'}
          onPress={owner ? () => setSheet('assignee') : undefined}
          disabled={!owner}
        />
        <ListRow
          icon="eye"
          title="Member ticket visibility"
          subtitle={lockNote}
          value={workspace.member_visibility === 'all' ? 'All tickets' : 'Own tickets'}
          onPress={owner ? () => setSheet('visibility') : undefined}
          disabled={!owner}
          last
        />
      </ListGroup>

      {/* Danger zone */}
      <SectionHeader title="Danger zone" />
      <ListGroup style={{ borderColor: theme.danger + '55' }}>
        {can.leaveWorkspace(role) ? (
          <ListRow
            icon="sign-out"
            title="Leave workspace"
            destructive
            chevron={false}
            last={!can.deleteWorkspace(role)}
            onPress={() =>
              Alert.alert(`Leave ${workspace.name}?`, 'You’ll need a new invitation to come back.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Leave', style: 'destructive', onPress: () => leave.mutate(workspace.id, { onSuccess: () => router.replace('/'), onError: (e) => toast.error(errorMessage(e)) }) },
              ])
            }
          />
        ) : null}
        {can.transferOwnership(role) ? (
          <ListRow icon="arrow-switch" title="Transfer ownership" subtitle="Pick a member from the Members screen" onPress={() => router.push('/members')} />
        ) : null}
        {can.deleteWorkspace(role) ? (
          <ListRow icon="trash" title="Delete workspace" subtitle="Permanently delete all data" destructive chevron={false} onPress={confirmDelete} last />
        ) : null}
      </ListGroup>
      {role === 'owner' ? (
        <ThemedText type="caption" themeColor="textTertiary" style={styles.note}>
          Owners can’t leave. Transfer ownership first, then leave as an admin.
        </ThemedText>
      ) : null}

      <OptionSheet
        visible={sheet === 'timezone'}
        onClose={() => setSheet(null)}
        title="Default timezone"
        options={TIMEZONES.map((tz) => ({ value: tz, label: tz.replace(/_/g, ' ') }))}
        value={workspace.timezone}
        onSelect={(timezone) => save({ timezone })}
      />
      <OptionSheet
        visible={sheet === 'priority'}
        onClose={() => setSheet(null)}
        title="Default priority"
        subtitle="Pre-selected on new tickets"
        options={workspace.enabled_priorities.map((p) => ({ value: p, label: PRIORITY[p].label, icon: PRIORITY[p].icon, iconTone: PRIORITY[p].tone }))}
        value={workspace.default_priority}
        onSelect={(default_priority) => save({ default_priority })}
      />
      <MemberSheet
        visible={sheet === 'assignee'}
        onClose={() => setSheet(null)}
        title="Assign new tickets to"
        noneLabel="Leave unassigned"
        value={workspace.default_assignee_id}
        members={members}
        onSelect={(default_assignee_id) => save({ default_assignee_id })}
      />
      <OptionSheet
        visible={sheet === 'visibility'}
        onClose={() => setSheet(null)}
        title="Members can see"
        options={[
          { value: 'own' as const, label: 'Only their own tickets', description: 'Tickets they created or are assigned to', icon: 'lock' },
          { value: 'all' as const, label: 'All tickets', description: 'Every ticket in the workspace (internal notes stay hidden)', icon: 'eye' },
        ]}
        value={workspace.member_visibility}
        onSelect={(member_visibility) => save({ member_visibility })}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  bold: { fontWeight: '700' },
  regular: { fontWeight: '400' },
  mt: { marginTop: Spacing.three },
  mtLg: { marginTop: Spacing.five },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.four },
  logoEdit: { position: 'absolute', right: -4, bottom: -4, width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  form: { gap: Spacing.three + 4 },
  desc: { minHeight: 90 },
  prefixRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  prefix: { flex: 1, height: 52, borderRadius: Radius.md, paddingHorizontal: 14, fontSize: 18, fontWeight: '700', letterSpacing: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  note: { marginTop: Spacing.two },
});
