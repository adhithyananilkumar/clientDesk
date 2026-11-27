import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button, EmptyState, FormField, Icon, IconButton, ListGroup, ListRow, Page, Sheet, ThemedText } from '@/components/ui';
import { CATEGORY_COLORS } from '@/constants/tickets';
import { Gutter, Spacing } from '@/constants/theme';
import { useCategories, useDeleteCategory, useSaveCategory, useWorkspace } from '@/features/workspace';
import { can } from '@/features/workspace/permissions';
import { useTheme } from '@/hooks/use-theme';
import { toast } from '@/stores/toast-store';
import type { Category } from '@/types/models';
import { errorMessage } from '@/utils/format';

type Draft = { id?: string; name: string; color: string };

export default function Categories() {
  const theme = useTheme();
  const { workspaceId, role } = useWorkspace();
  const categories = useCategories(workspaceId);
  const saveCategory = useSaveCategory(workspaceId);
  const deleteCategory = useDeleteCategory(workspaceId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string>();
  const manage = can.manageCategories(role);
  const list = categories.data ?? [];

  const save = () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name || name.length > 40) return setError('Use 1–40 characters');
    setError(undefined);
    saveCategory.mutate(
      { ...draft, name },
      { onSuccess: () => { setDraft(null); toast.success('Category saved'); }, onError: (e) => toast.error(errorMessage(e)) },
    );
  };

  const confirmDelete = (c: Category) =>
    Alert.alert(`Delete “${c.name}”?`, 'Tickets in this category keep everything else; they just lose the label.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCategory.mutate(c.id, { onError: (e) => toast.error(errorMessage(e)) }) },
    ]);

  return (
    <Page
      back
      title="Categories"
      subtitle="Group tickets by topic, like Billing or Bug."
      actions={manage ? <IconButton icon="plus" label="Add category" filled onPress={() => setDraft({ name: '', color: CATEGORY_COLORS[list.length % CATEGORY_COLORS.length] })} /> : null}>
      {list.length ? (
        <ListGroup>
          {list.map((c, i) => (
            <ListRow
              key={c.id}
              left={<View style={[styles.swatch, { backgroundColor: c.color }]} />}
              title={c.name}
              onPress={manage ? () => setDraft({ id: c.id, name: c.name, color: c.color }) : undefined}
              right={
                manage ? (
                  <Pressable onPress={() => confirmDelete(c)} hitSlop={14} accessibilityRole="button" accessibilityLabel={`Delete ${c.name}`}>
                    <Icon name="trash" size={16} tone="textTertiary" />
                  </Pressable>
                ) : undefined
              }
              last={i === list.length - 1}
            />
          ))}
        </ListGroup>
      ) : (
        <EmptyState icon="tag" title="No categories" message={manage ? 'Add a few to make tickets easier to sort and filter.' : undefined} />
      )}

      <Sheet
        visible={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit category' : 'New category'}
        footer={<Button title="Save" onPress={save} loading={saveCategory.isPending} />}>
        <View style={styles.sheet}>
          <FormField label="Name" value={draft?.name ?? ''} onChangeText={(name) => setDraft((d) => (d ? { ...d, name } : d))} error={error} autoFocus maxLength={40} />
          <ThemedText style={styles.label}>Colour</ThemedText>
          <View style={styles.colors}>
            {CATEGORY_COLORS.map((color) => {
              const active = draft?.color === color;
              return (
                <Pressable
                  key={color}
                  onPress={() => setDraft((d) => (d ? { ...d, color } : d))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Colour ${color}`}
                  style={[styles.color, { backgroundColor: color, borderColor: active ? theme.text : 'transparent' }]}>
                  {active ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Sheet>
    </Page>
  );
}

const styles = StyleSheet.create({
  swatch: { width: 16, height: 16, borderRadius: 8, marginHorizontal: 8 },
  sheet: { paddingHorizontal: Gutter, gap: Spacing.three },
  label: { fontSize: 14, fontWeight: '600' },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  color: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
