import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';
import { ThemedText } from './themed-text';

/* ------------------------------------------------------------------ Avatar */

const AVATAR_TONES: ThemeColor[] = ['info', 'success', 'done', 'attention', 'warning', 'danger'];

function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initialsOf(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase();
}

type AvatarProps = { name?: string | null; uri?: string | null; size?: number; square?: boolean };

/** Photo when there is one; otherwise initials on a soft tint derived from the name. */
export function Avatar({ name, uri, size = 36, square }: AvatarProps) {
  const theme = useTheme();
  const tone = AVATAR_TONES[hash(name ?? '') % AVATAR_TONES.length];
  const radius = square ? Math.round(size * 0.28) : size / 2;
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: theme.backgroundElement }}
        contentFit="cover"
        transition={150}
        accessibilityLabel={name ?? 'Avatar'}
      />
    );
  }
  return (
    <View
      accessibilityLabel={name ?? 'Avatar'}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme[`${tone}Soft` as ThemeColor],
      }}>
      <ThemedText style={{ color: theme[tone], fontSize: size * 0.38, fontWeight: '700', lineHeight: size * 0.5 }}>
        {initialsOf(name)}
      </ThemedText>
    </View>
  );
}

/* ------------------------------------------------------------------- Pill */

type PillProps = { label: string; tone?: ThemeColor; icon?: IconName; solid?: boolean; small?: boolean };

/** Rounded label: soft background, strong foreground in the same hue. */
export function Pill({ label, tone = 'neutral', icon, solid, small }: PillProps) {
  const theme = useTheme();
  const fg = solid ? theme.background : theme[tone];
  const bg = solid ? theme[tone] : theme[`${tone}Soft` as ThemeColor] ?? theme.backgroundElement;
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: bg, paddingVertical: small ? 2 : 4, paddingHorizontal: small ? 8 : 10 },
      ]}>
      {icon ? <Icon name={icon} size={small ? 11 : 12} color={fg} /> : null}
      <ThemedText style={{ color: fg, fontSize: small ? 11 : 12, lineHeight: 16, fontWeight: '600' }} numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

/* ------------------------------------------------------------------- Card */

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        padded && { padding: Spacing.three },
        style,
      ]}>
      {children}
    </View>
  );
}

/* ---------------------------------------------------------------- ListRow */

type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconTone?: ThemeColor;
  left?: ReactNode;
  right?: ReactNode;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  chevron?: boolean;
  disabled?: boolean;
  last?: boolean;
  accessibilityHint?: string;
};

/** Settings-style row. Big touch target, optional value and chevron. */
export function ListRow({
  title,
  subtitle,
  icon,
  iconTone,
  left,
  right,
  value,
  onPress,
  destructive,
  chevron = !!onPress,
  disabled,
  last,
  accessibilityHint,
}: ListRowProps) {
  const theme = useTheme();
  const color = destructive ? theme.danger : theme.text;
  return (
    <Pressable
      disabled={!onPress || disabled}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={value ? `${title}, ${value}` : title}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.row,
        { opacity: disabled ? 0.45 : 1, backgroundColor: pressed ? theme.backgroundElement : 'transparent' },
      ]}>
      {left ??
        (icon ? (
          <View style={[styles.rowIcon, { backgroundColor: theme.backgroundElement }]}>
            <Icon name={icon} size={16} color={destructive ? theme.danger : iconTone ? theme[iconTone] : theme.text} />
          </View>
        ) : null)}
      <View style={[styles.rowBody, !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <View style={styles.rowText}>
          <ThemedText style={[styles.rowTitle, { color }]} numberOfLines={1}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.rowSubtitle}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {value ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.rowValue}>
            {value}
          </ThemedText>
        ) : null}
        {right}
        {chevron ? <Icon name="chevron-right" size={16} tone="textTertiary" /> : null}
      </View>
    </Pressable>
  );
}

/** A rounded group of ListRows. */
export function ListGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>{children}</View>
  );
}

/* --------------------------------------------------------- SectionHeader */

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </ThemedText>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionAction}>
            {action}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------- IconButton */

type IconButtonProps = {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  filled?: boolean;
  tone?: ThemeColor;
  badge?: number;
  disabled?: boolean;
};

export function IconButton({ icon, onPress, label, size = 40, filled, tone, badge, disabled }: IconButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} new` : label}
      // At least a 44pt touch target, whatever the visual size.
      hitSlop={Math.max(6, Math.ceil((44 - size) / 2))}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: filled || pressed ? theme.backgroundElement : 'transparent',
          opacity: disabled ? 0.4 : 1,
        },
      ]}>
      <Icon name={icon} size={Math.round(size * 0.45)} tone={tone} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: theme.danger, borderColor: theme.background }]}>
          <ThemedText style={styles.badgeText}>{badge > 99 ? '99+' : badge}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

/* --------------------------------------------------------------- Chip */

type ChipProps = { label: string; selected?: boolean; onPress: () => void; icon?: IconName; count?: number };

export function Chip({ label, selected, onPress, icon, count }: ChipProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={count ? `${label}, ${count} active` : label}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.text : theme.backgroundElement,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      {icon ? <Icon name={icon} size={13} color={selected ? theme.background : theme.text} /> : null}
      <ThemedText style={[styles.chipText, { color: selected ? theme.background : theme.text }]} numberOfLines={1}>
        {label}
      </ThemedText>
      {count ? (
        <View style={[styles.chipCount, { backgroundColor: selected ? theme.background : theme.text }]}>
          <ThemedText style={[styles.chipCountText, { color: selected ? theme.text : theme.background }]}>{count}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

/* ------------------------------------------------------ SegmentedControl */

type Segment<T extends string> = { value: T; label: string; count?: number };

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]} accessibilityRole="tablist">
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={() => onChange(segment.value)}
            style={[styles.segment, active && { backgroundColor: theme.surface, ...styles.segmentActive }]}>
            <ThemedText
              style={[styles.segmentText, { color: active ? theme.text : theme.textSecondary }]}
              numberOfLines={1}>
              {segment.label}
              {segment.count != null ? ` ${segment.count}` : ''}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------- Toggle */

export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  disabled,
  last,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  const theme = useTheme();
  return (
    <ListRow
      title={title}
      subtitle={subtitle}
      last={last}
      chevron={false}
      disabled={disabled}
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          accessibilityLabel={title}
          trackColor={{ true: theme.success, false: theme.backgroundSelected }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={theme.backgroundSelected}
        />
      }
    />
  );
}

/* ----------------------------------------------------------- EmptyState */

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundElement }]}>
        <Icon name={icon} size={24} tone="textSecondary" />
      </View>
      <ThemedText style={styles.emptyTitle}>{title}</ThemedText>
      {message ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.emptyMessage}>
          {message}
        </ThemedText>
      ) : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

/* --------------------------------------------------------------- Misc */

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border }, style]} />;
}

export function Spinner() {
  const theme = useTheme();
  return <ActivityIndicator color={theme.textSecondary} />;
}

/** Grey placeholder block for loading layouts. */
export function Skeleton({ height = 16, width = '100%', radius = Radius.sm, style }: { height?: number; width?: ViewStyle['width']; radius?: number; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[{ height, width, borderRadius: radius, backgroundColor: theme.backgroundElement }, style]} />;
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.pill, alignSelf: 'flex-start' },
  card: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth },
  group: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: Spacing.three, minHeight: 56, gap: Spacing.three },
  rowIcon: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingRight: Spacing.three,
    paddingVertical: 12,
    minHeight: 56,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  rowSubtitle: { fontWeight: '400' },
  rowValue: { maxWidth: '45%', fontWeight: '400' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.four,
    marginBottom: Spacing.two + 4,
  },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.3 },
  sectionAction: { fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, lineHeight: 12, fontWeight: '800' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
  },
  chipText: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  chipCount: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  chipCountText: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
  segmented: { flexDirection: 'row', borderRadius: Radius.pill, padding: 4 },
  segment: { flex: 1, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segmentActive: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: Spacing.six, paddingHorizontal: Spacing.four, gap: Spacing.two },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  emptyMessage: { textAlign: 'center', fontWeight: '400', maxWidth: 300 },
  emptyAction: { marginTop: Spacing.three, alignSelf: 'stretch' },
});
