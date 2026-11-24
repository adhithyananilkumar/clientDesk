import { StyleSheet } from 'react-native';

import { ListGroup, Page, SectionHeader, ThemedText, ToggleRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { registerForPush } from '@/features/notifications/push';
import { useMyProfile, useUpdateProfile, useWorkspace } from '@/features/workspace';
import { isAdmin } from '@/features/workspace/permissions';
import { toast } from '@/stores/toast-store';
import type { NotificationPrefs } from '@/types/models';
import { errorMessage } from '@/utils/format';

type Key = keyof NotificationPrefs;

const EVENTS: { key: Key; title: string; subtitle: string; adminOnly?: boolean }[] = [
  { key: 'ticket_assigned', title: 'Assigned to me', subtitle: 'When a ticket is assigned or reassigned to you' },
  { key: 'comment_added', title: 'New replies', subtitle: 'On tickets you created, are assigned to or replied on' },
  { key: 'status_changed', title: 'Status changes', subtitle: 'On tickets you created or are assigned to' },
  { key: 'priority_changed', title: 'Priority changes', subtitle: 'On tickets you created or are assigned to' },
  { key: 'due_soon', title: 'Due soon', subtitle: 'A day before your tickets are due' },
  { key: 'overdue', title: 'Overdue', subtitle: 'When a ticket passes its due date' },
  { key: 'ticket_created', title: 'New tickets', subtitle: 'Whenever someone opens a ticket', adminOnly: true },
  { key: 'invitation', title: 'Workspace invitations', subtitle: 'When you’re invited to a workspace' },
];

export default function NotificationPreferences() {
  const profile = useMyProfile().data;
  const update = useUpdateProfile();
  const { role } = useWorkspace();
  const prefs = profile?.notification_prefs ?? {};
  const on = (key: Key) => prefs[key] !== false;

  const set = async (key: Key, value: boolean) => {
    if (key === 'push' && value) {
      const result = await registerForPush();
      if (result === 'denied') toast.error('Allow notifications for ClientDesk in your device settings.');
    }
    update.mutate({ notification_prefs: { ...prefs, [key]: value } }, { onError: (e) => toast.error(errorMessage(e)) });
  };

  const events = EVENTS.filter((e) => !e.adminOnly || isAdmin(role));

  return (
    <Page back title="Notifications" subtitle="Choose what reaches you. In-app notifications always respect these settings.">
      <ListGroup>
        <ToggleRow title="Push notifications" subtitle="Alerts on this phone, even when ClientDesk is closed" value={on('push')} onChange={(v) => set('push', v)} last />
      </ListGroup>

      <SectionHeader title="Notify me about" />
      <ListGroup>
        {events.map((e, i) => (
          <ToggleRow key={e.key} title={e.title} subtitle={e.subtitle} value={on(e.key)} onChange={(v) => set(e.key, v)} last={i === events.length - 1} />
        ))}
      </ListGroup>
      <ThemedText type="caption" themeColor="textTertiary" style={styles.note}>
        You’re never notified about your own changes.
      </ThemedText>
    </Page>
  );
}

const styles = StyleSheet.create({ note: { marginTop: Spacing.two } });
