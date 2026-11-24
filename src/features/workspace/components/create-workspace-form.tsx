import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { Button, FormField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { toast } from '@/stores/toast-store';
import { errorMessage } from '@/utils/format';
import { workspaceSchema, type WorkspaceValues } from '@/validation';

import { useCreateWorkspace } from '../api';

/** Name + description. On success the new workspace becomes the current one. */
export function CreateWorkspaceForm({ onCreated }: { onCreated?: () => void }) {
  const create = useCreateWorkspace();
  const { control, handleSubmit, formState } = useForm<WorkspaceValues>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: '', description: '' },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({ name: values.name.trim(), description: values.description?.trim() });
      toast.success('Workspace created');
      onCreated?.();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <FormField
            label="Workspace name"
            placeholder="e.g. Acme Support"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.name?.message}
            returnKeyType="next"
            autoFocus
          />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <FormField
            label="Description"
            optional
            placeholder="What does this team handle?"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.description?.message}
            multiline
            style={styles.description}
          />
        )}
      />
      <Button title="Create workspace" onPress={submit} loading={create.isPending} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.four - 4 },
  description: { minHeight: 96 },
});
