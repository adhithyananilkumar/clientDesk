import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, Icon, OptionSheet, SearchField, Sheet, SheetRow, ThemedText, type SheetOption } from '@/components/ui';
import { PRIORITIES, PRIORITY, ROLE, STATUS, STATUSES } from '@/constants/tickets';
import { Gutter, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Category, Member, TicketPriority, TicketStatus } from '@/types/models';
import { displayName, startOfDay } from '@/utils/format';

type Base<T> = { visible: boolean; onClose: () => void; value: T; onSelect: (value: T) => void };

export function StatusSheet({ visible, onClose, value, onSelect }: Base<TicketStatus>) {
  const options: SheetOption<TicketStatus>[] = STATUSES.map((s) => ({
    value: s,
    label: STATUS[s].label,
    description: STATUS[s].description,
    icon: STATUS[s].icon,
    iconTone: STATUS[s].tone,
  }));
  return <OptionSheet visible={visible} onClose={onClose} title="Status" options={options} value={value} onSelect={onSelect} />;
}

export function PrioritySheet({ visible, onClose, value, onSelect, enabled = PRIORITIES }: Base<TicketPriority> & { enabled?: TicketPriority[] }) {
  const options: SheetOption<TicketPriority>[] = PRIORITIES.filter((p) => enabled.includes(p)).map((p) => ({
    value: p,
    label: PRIORITY[p].label,
    icon: PRIORITY[p].icon,
    iconTone: PRIORITY[p].tone,
  }));
  return <OptionSheet visible={visible} onClose={onClose} title="Priority" options={options} value={value} onSelect={onSelect} />;
}

export function CategorySheet({ visible, onClose, value, onSelect, categories }: Base<string | null> & { categories: Category[] }) {
  const options: SheetOption<string | null>[] = [
    { value: null, label: 'No category', icon: 'circle-slash' },
    ...categories.map((c) => ({
      value: c.id,
      label: c.name,
      leading: <View style={[styles.swatch, { backgroundColor: c.color }]} />,
    })),
  ];
  return <OptionSheet visible={visible} onClose={onClose} title="Category" options={options} value={value} onSelect={onSelect} />;
}

/** Searchable member list. */
export function MemberSheet({
  visible,
  onClose,
  value,
  onSelect,
  members,
  title = 'Assignee',
  allowNone = true,
  noneLabel = 'Unassigned',
}: Base<string | null> & { members: Member[]; title?: string; allowNone?: boolean; noneLabel?: string }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return members.filter(
      (m) => !needle || displayName(m.profile).toLowerCase().includes(needle) || (m.profile?.email ?? '').toLowerCase().includes(needle),
    );
  }, [members, q]);

  const close = () => {
    setQ('');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title={title}>
      {members.length > 6 ? (
        <View style={styles.search}>
          <SearchField value={q} onChangeText={setQ} placeholder="Search people" />
        </View>
      ) : null}
      {allowNone && !q ? (
        <SheetRow
          option={{ value: null, label: noneLabel, icon: 'person' }}
          selected={value === null}
          onPress={() => {
            onSelect(null);
            close();
          }}
        />
      ) : null}
      {filtered.map((m) => (
        <SheetRow
          key={m.user_id}
          option={{
            value: m.user_id,
            label: displayName(m.profile),
            description: `${ROLE[m.role].label} · ${m.profile?.email ?? ''}`,
            leading: <Avatar size={32} name={displayName(m.profile)} uri={m.profile?.avatar_url} />,
          }}
          selected={value === m.user_id}
          onPress={() => {
            onSelect(m.user_id);
            close();
          }}
        />
      ))}
    </Sheet>
  );
}

/* --------------------------------------------------------------- Due date */

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function endOfDayIso(date: Date) {
  const d = new Date(date);
  d.setHours(17, 0, 0, 0);
  return d.toISOString();
}

/** Quick picks plus a month calendar. Due time is 5 pm local on the chosen day. */
export function DueDateSheet({ visible, onClose, value, onSelect }: Base<string | null>) {
  const theme = useTheme();
  const today = startOfDay();
  const [month, setMonth] = useState(() => {
    const base = value ? new Date(value) : today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const selected = value ? startOfDay(new Date(value)).getTime() : null;

  const pick = (date: Date | null) => {
    onSelect(date ? endOfDayIso(date) : null);
    onClose();
  };

  const add = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d;
  };
  const nextMonday = () => {
    const d = new Date(today);
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    return d;
  };

  const first = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];

  const quick: { label: string; date: Date }[] = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: add(1) },
    { label: 'Next week', date: nextMonday() },
    { label: 'In 2 weeks', date: add(14) },
  ];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Due date"
      footer={value ? <Button title="Remove due date" variant="secondary" size="md" onPress={() => pick(null)} /> : undefined}>
      <View style={styles.quick}>
        {quick.map((q) => (
          <Pressable
            key={q.label}
            onPress={() => pick(q.date)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.quickChip, { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }]}>
            <ThemedText style={styles.quickLabel}>{q.label}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {q.date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.calendar}>
        <View style={styles.monthRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            hitSlop={12}
            onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <Icon name="chevron-left" size={20} />
          </Pressable>
          <ThemedText style={styles.monthLabel}>
            {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            hitSlop={12}
            onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <Icon name="chevron-right" size={20} />
          </Pressable>
        </View>
        <View style={styles.grid}>
          {WEEKDAYS.map((d, i) => (
            <ThemedText key={`w${i}`} type="caption" themeColor="textTertiary" style={styles.weekday}>
              {d}
            </ThemedText>
          ))}
          {cells.map((date, i) => {
            if (!date) return <View key={`e${i}`} style={styles.cell} />;
            const time = date.getTime();
            const isSelected = time === selected;
            const isToday = time === today.getTime();
            const past = time < today.getTime();
            return (
              <Pressable
                key={time}
                disabled={past}
                onPress={() => pick(date)}
                accessibilityRole="button"
                accessibilityLabel={date.toDateString()}
                accessibilityState={{ selected: isSelected, disabled: past }}
                style={styles.cell}>
                <View
                  style={[
                    styles.day,
                    isSelected && { backgroundColor: theme.text },
                    !isSelected && isToday && { borderWidth: 1.5, borderColor: theme.text },
                  ]}>
                  <ThemedText
                    style={[
                      styles.dayText,
                      { color: isSelected ? theme.background : past ? theme.textTertiary : theme.text },
                    ]}>
                    {date.getDate()}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  swatch: { width: 14, height: 14, borderRadius: 7, marginHorizontal: 9 },
  search: { paddingHorizontal: Gutter, paddingBottom: Spacing.two },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Gutter },
  quickChip: { flexGrow: 1, flexBasis: '45%', borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 14, gap: 2 },
  quickLabel: { fontSize: 15, fontWeight: '600' },
  calendar: { paddingHorizontal: Gutter, paddingTop: Spacing.four },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.three },
  monthLabel: { fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', marginBottom: Spacing.two },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 15, fontWeight: '600' },
});
