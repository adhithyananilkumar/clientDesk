import { router } from 'expo-router';

import { Page } from '@/components/ui';
import { CreateWorkspaceForm } from '@/features/workspace/components/create-workspace-form';

export default function NewWorkspace() {
  return (
    <Page back="close" title="New workspace" subtitle="You’ll be its owner. Invite your team once it’s ready.">
      <CreateWorkspaceForm onCreated={() => router.replace('/')} />
    </Page>
  );
}
