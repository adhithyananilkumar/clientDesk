import { StyleSheet, View } from 'react-native';

import { Icon, Pill, ThemedText } from '@/components/ui';
import { PRIORITY, STATUS } from '@/constants/tickets';
import { useTheme } from '@/hooks/use-theme';
import type { TicketPriority, TicketStatus } from '@/types/models';

export function StatusPill({ status, small }: { status: TicketStatus; small?: boolean }) {
  const meta = STATUS[status];
  return <Pill label={meta.label} tone={meta.tone} icon={meta.icon} small={small} />;
}

export function PriorityPill({ priority, small }: { priority: TicketPriority; small?: boolean }) {
  const meta = PRIORITY[priority];
  return <Pill label={meta.label} tone={meta.tone} icon={meta.icon} small={small} />;
}

/** Status as a bare coloured glyph, like GitHub's issue list. */
export function StatusIcon({ status, size = 16 }: { status: TicketStatus; size?: number }) {
  const theme = useTheme();
  return <Icon name={STATUS[status].icon} size={size} color={theme[STATUS[status].tone]} />;
}

/** Four little bars that fill up with priority. */
export function PriorityBars({ priority }: { priority: TicketPriority }) {
  const theme = useTheme();
  const meta = PRIORITY[priority];
  return (
    <View style={styles.bars} accessibilityLabel={`${meta.label} priority`}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            styles.bar,
            { height: 5 + i * 2.5, backgroundColor: i <= meta.rank ? theme[meta.tone] : theme.backgroundSelected },
          ]}
        />
      ))}
    </View>
  );
}

export function CategoryTag({ name, color }: { name: string; color: string }) {
  return (
    <View style={[styles.tag, { borderColor: color + '66', backgroundColor: color + '1A' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText style={[styles.tagText, { color }]} numberOfLines={1}>
        {name}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 13 },
  bar: { width: 3, borderRadius: 1 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    maxWidth: 160,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  tagText: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
});
