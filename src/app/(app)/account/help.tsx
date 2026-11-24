import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Icon, ListGroup, Page, SectionHeader, ThemedText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const FAQ = [
  {
    q: 'Who can see my tickets?',
    a: 'Owners and admins see every ticket in the workspace. Members see tickets they created or are assigned to, unless the owner lets members see all tickets.',
  },
  {
    q: 'What is an internal note?',
    a: 'A comment only owners and admins can read. Use it for context the requester shouldn’t see. Internal notes have a yellow background and a lock.',
  },
  {
    q: 'How do statuses work?',
    a: 'Open → In progress → Resolved → Closed. The big button on a ticket always moves it to the next step. Reopen a ticket at any time.',
  },
  {
    q: 'Can I use ClientDesk offline?',
    a: 'Yes. Tickets you’ve opened stay readable, drafts are saved on the device, and replies or status changes made offline are sent when you reconnect.',
  },
  {
    q: 'How do I invite my team?',
    a: 'Owners and admins: open the workspace menu → Members → Invite. Invitations are single-use and expire after 7 days.',
  },
  {
    q: 'How do I leave or delete a workspace?',
    a: 'Workspace menu → Workspace settings. Owners must transfer ownership before leaving; only the owner can delete a workspace.',
  },
];

export default function Help() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Page back title="Help & support" subtitle="Answers to common questions.">
      <ListGroup>
        {FAQ.map((item, i) => (
          <FaqItem key={item.q} q={item.q} a={item.a} open={open === i} onToggle={() => setOpen(open === i ? null : i)} last={i === FAQ.length - 1} />
        ))}
      </ListGroup>

      <SectionHeader title="Still need help?" />
      <Button
        title="Email support"
        icon="mail"
        variant="secondary"
        onPress={() => Linking.openURL('mailto:support@clientdesk.app?subject=ClientDesk%20support')}
      />
    </Page>
  );
}

function FaqItem({ q, a, open, onToggle, last }: { q: string; a: string; open: boolean; onToggle: () => void; last?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={[styles.item, !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.row}>
        <ThemedText style={styles.q}>{q}</ThemedText>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} tone="textSecondary" />
      </View>
      {open ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.a}>
          {a}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  q: { flex: 1, fontSize: 16, fontWeight: '600' },
  a: { fontWeight: '400', lineHeight: 21 },
});
