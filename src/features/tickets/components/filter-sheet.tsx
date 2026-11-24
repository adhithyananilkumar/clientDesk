import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Chip, Sheet, ThemedText } from '@/components/ui';
import { PRIORITIES, PRIORITY, STATUS, STATUSES } from '@/constants/tickets';
import { Gutter, Spacing } from '@/constants/theme';
import type { Category, Member } from '@/types/models';
import { displayName, firstName } from '@/utils/format';

import { DEFAULT_FILTERS, type CreatedRange, type DueFilter, type TicketFilters } from '../api';

type Props = {
  visible: boolean;
  onClose: () => void;
  filters: TicketFilters;
  onApply: (filters: TicketFilters) => void;
  members: Member[];
  categories: Category[];
};

function toggle<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

const CREATED: { value: CreatedRange; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

const DUE: { value: DueFilter; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'week', label: 'Next 7 days' },
  { value: 'none', label: 'No due date' },
];

/** All filters at once; nothing applies until "Show results". */
export function FilterSheet({ visible, onClose, filters, onApply, members, categories }: Props) {
  const [draft, setDraft] = useState(filters);
  // Start from the live filters every time the sheet opens.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(filters);
  }

  const set = <K extends keyof TicketFilters>(key: K, value: TicketFilters[K]) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filter tickets"
      footer={
        <View style={styles.footer}>
          <Button
            title="Reset"
            variant="secondary"
            style={styles.flex}
            onPress={() => setDraft({ ...DEFAULT_FILTERS, scope: draft.scope, q: draft.q, sort: draft.sort, status: [] })}
          />
          <Button
            title="Show results"
            style={styles.flex2}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          />
        </View>
      }>
      <Group title="Status">
        {STATUSES.map((s) => (
          <Chip key={s} label={STATUS[s].label} icon={STATUS[s].icon} selected={draft.status.includes(s)} onPress={() => set('status', toggle(draft.status, s))} />
        ))}
      </Group>
      <Group title="Priority">
        {PRIORITIES.map((p) => (
          <Chip key={p} label={PRIORITY[p].label} icon={PRIORITY[p].icon} selected={draft.priority.includes(p)} onPress={() => set('priority', toggle(draft.priority, p))} />
        ))}
      </Group>
      <Group title="Assignee" scroll>
        <Chip label="Unassigned" icon="person" selected={draft.assignee.includes('none')} onPress={() => set('assignee', toggle(draft.assignee, 'none'))} />
        {members.map((m) => (
          <PersonChip key={m.user_id} member={m} selected={draft.assignee.includes(m.user_id)} onPress={() => set('assignee', toggle(draft.assignee, m.user_id))} />
        ))}
      </Group>
      <Group title="Created by" scroll>
        {members.map((m) => (
          <PersonChip key={m.user_id} member={m} selected={draft.creator.includes(m.user_id)} onPress={() => set('creator', toggle(draft.creator, m.user_id))} />
        ))}
      </Group>
      {categories.length ? (
        <Group title="Category">
          {categories.map((c) => (
            <Chip key={c.id} label={c.name} selected={draft.category.includes(c.id)} onPress={() => set('category', toggle(draft.category, c.id))} />
          ))}
        </Group>
      ) : null}
      <Group title="Created">
        {CREATED.map((o) => (
          <Chip key={o.value} label={o.label} selected={draft.created === o.value} onPress={() => set('created', o.value)} />
        ))}
      </Group>
      <Group title="Due date">
        {DUE.map((o) => (
          <Chip key={o.value} label={o.label} selected={draft.due === o.value} onPress={() => set('due', o.value)} />
        ))}
      </Group>
    </Sheet>
  );
}

function PersonChip({ member, selected, onPress }: { member: Member; selected: boolean; onPress: () => void }) {
  return <Chip label={firstName(displayName(member.profile))} icon="person" selected={selected} onPress={onPress} />;
}

function Group({ title, children, scroll }: { title: string; children: React.ReactNode; scroll?: boolean }) {
  return (
    <View style={styles.group}>
      <ThemedText style={styles.groupTitle}>{title}</ThemedText>
      {scroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.chips, styles.padded]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  flex2: { flex: 2 },
  group: { gap: Spacing.two + 2, marginBottom: Spacing.four },
  groupTitle: { fontSize: 15, fontWeight: '700', paddingHorizontal: Gutter },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  padded: { paddingHorizontal: Gutter },
  chipsRow: { gap: Spacing.two, paddingHorizontal: Gutter },
});
