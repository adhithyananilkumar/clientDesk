import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Chip,
  EmptyState,
  IconButton,
  OptionSheet,
  SearchField,
  SegmentedControl,
  Skeleton,
  ThemedText,
} from '@/components/ui';
import { STATUS } from '@/constants/tickets';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useCategories, useMembers, useWorkspace } from '@/features/workspace';
import { isAdmin } from '@/features/workspace/permissions';
import { useTheme } from '@/hooks/use-theme';
import { useUiStore } from '@/stores/workspace-store';
import type { Ticket } from '@/types/models';

import { activeFilterCount, DEFAULT_FILTERS, useTickets, type TicketFilters, type TicketScope, type TicketSort } from '../api';
import { FilterSheet } from '../components/filter-sheet';
import { TicketRow } from '../components/ticket-row';

const SORTS: { value: TicketSort; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'created', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'priority', label: 'Highest priority' },
  { value: 'due', label: 'Due soonest' },
];

function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

type Params = { scope?: TicketScope; assignee?: string; creator?: string; due?: TicketFilters['due']; status?: string };

export function TicketsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Params>();
  const { workspace, workspaceId, role } = useWorkspace();
  const members = useMembers(workspaceId).data ?? [];
  const categories = useCategories(workspaceId).data ?? [];
  const openSidebar = useUiStore((s) => s.openSidebar);

  const [filters, setFilters] = useState<TicketFilters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const q = useDebounced(search);

  // Deep links from the dashboard / member profiles preset the filters
  // (applied once per distinct set of params, during render).
  const paramsKey = [params.scope, params.assignee, params.creator, params.due, params.status].join('|');
  const [appliedKey, setAppliedKey] = useState('||||');
  if (paramsKey !== appliedKey) {
    setAppliedKey(paramsKey);
    if (paramsKey !== '||||') setFilters({
      ...DEFAULT_FILTERS,
      scope: params.scope ?? 'all',
      assignee: params.assignee ? [params.assignee] : [],
      creator: params.creator ? [params.creator] : [],
      due: params.due ?? 'any',
      status: params.status === 'all' ? [] : params.status ? (params.status.split(',') as TicketFilters['status']) : params.due === 'overdue' ? [] : DEFAULT_FILTERS.status,
    });
  }

  const effective = useMemo(() => ({ ...filters, q }), [filters, q]);
  const tickets = useTickets(workspaceId, effective, members);
  const rows = useMemo(() => tickets.data?.pages.flat() ?? [], [tickets.data]);
  const count = activeFilterCount(filters);
  const admin = isAdmin(role);

  const scopes: { value: TicketScope; label: string }[] = [
    { value: 'all', label: admin ? 'All' : 'Visible' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'created', label: 'Created' },
    ...(admin ? [{ value: 'unassigned' as const, label: 'Unassigned' }] : []),
  ];

  const statusQuick = (key: 'active' | 'resolved' | 'all') => {
    const status: TicketFilters['status'] = key === 'active' ? ['open', 'in_progress'] : key === 'resolved' ? ['resolved', 'closed'] : [];
    setFilters((f) => ({ ...f, status }));
  };
  const statusKey = filters.status.join(',');

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <IconButton icon="three-bars" label="Open workspace menu" onPress={openSidebar} filled />
        <View style={styles.flex}>
          <ThemedText style={styles.title} accessibilityRole="header">
            Tickets
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
            {workspace?.name}
          </ThemedText>
        </View>
        <IconButton icon="plus" label="Create ticket" onPress={() => router.push('/ticket/new')} filled />
      </View>

      <SearchField value={search} onChangeText={setSearch} placeholder="Search by number, title, person…" />
      <SegmentedControl segments={scopes} value={filters.scope} onChange={(scope) => setFilters((f) => ({ ...f, scope }))} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="Filters" icon="filter" count={count} selected={count > 0 && statusKey !== 'open,in_progress'} onPress={() => setFilterOpen(true)} />
        <Chip label={SORTS.find((s) => s.value === filters.sort)?.label ?? 'Sort'} icon="sort-desc" onPress={() => setSortOpen(true)} />
        <Chip label="Active" selected={statusKey === 'open,in_progress'} onPress={() => statusQuick('active')} />
        <Chip label="Done" icon={STATUS.resolved.icon} selected={statusKey === 'resolved,closed'} onPress={() => statusQuick('resolved')} />
        <Chip label="Any status" selected={statusKey === ''} onPress={() => statusQuick('all')} />
        <Chip label="Overdue" icon="clock" selected={filters.due === 'overdue'} onPress={() => setFilters((f) => ({ ...f, due: f.due === 'overdue' ? 'any' : 'overdue' }))} />
      </ScrollView>
    </View>
  );

  const empty = tickets.isLoading ? (
    <View style={styles.skeletons}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.skeleton}>
          <Skeleton width={16} height={16} radius={8} />
          <View style={styles.flex}>
            <Skeleton width="30%" height={10} />
            <Skeleton width="85%" height={14} style={styles.mt} />
            <Skeleton width="55%" height={10} style={styles.mt} />
          </View>
        </View>
      ))}
    </View>
  ) : (
    <EmptyState
      icon={q || count ? 'search' : 'issue-opened'}
      title={q || count ? 'No matching tickets' : 'No tickets yet'}
      message={q || count ? 'Try a different search or clear some filters.' : 'Create the first ticket for your team.'}
      action={
        q || count ? (
          <Button
            title="Clear search and filters"
            variant="secondary"
            onPress={() => {
              setSearch('');
              setFilters({ ...DEFAULT_FILTERS, scope: filters.scope, status: [] });
            }}
          />
        ) : (
          <Button title="Create ticket" icon="plus" onPress={() => router.push('/ticket/new')} />
        )
      }
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <FlatList<Ticket>
        style={styles.list}
        data={rows}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <TicketRow ticket={item} prefix={workspace?.ticket_prefix} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        onEndReached={() => tickets.hasNextPage && !tickets.isFetchingNextPage && tickets.fetchNextPage()}
        onEndReachedThreshold={0.4}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={tickets.isRefetching && !tickets.isFetchingNextPage} onRefresh={() => void tickets.refetch()} tintColor={theme.textSecondary} />}
        ListFooterComponent={
          tickets.isFetchingNextPage ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.more}>
              Loading more…
            </ThemedText>
          ) : (
            <View style={styles.bottom} />
          )
        }
      />
      <FilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} onApply={setFilters} members={members} categories={categories} />
      <OptionSheet
        visible={sortOpen}
        onClose={() => setSortOpen(false)}
        title="Sort by"
        options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
        value={filters.sort}
        onSelect={(sort) => setFilters((f) => ({ ...f, sort }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  list: { width: '100%', maxWidth: MaxContentWidth },
  header: { paddingHorizontal: Gutter, paddingTop: Spacing.two, paddingBottom: Spacing.two, gap: Spacing.three },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.6 },
  chips: { gap: Spacing.two, paddingRight: Gutter },
  skeletons: { paddingHorizontal: Gutter },
  skeleton: { flexDirection: 'row', gap: 12, paddingVertical: 16 },
  mt: { marginTop: 8 },
  more: { textAlign: 'center', padding: Spacing.four },
  bottom: { height: Spacing.five },
});
