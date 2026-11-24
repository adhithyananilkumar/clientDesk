import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { LoadingScreen } from '@/components/feedback';
import { useAuth } from '@/features/auth';
import { usePushNotifications } from '@/features/notifications/push';
import { useWorkspaceRealtime } from '@/features/realtime/use-workspace-realtime';
import { useAcceptInviteToken, useWorkspace } from '@/features/workspace';
import { PENDING_INVITE_KEY } from '@/features/workspace/invite-token';
import { useTheme } from '@/hooks/use-theme';
import { kv } from '@/services/local-db';
import { toast } from '@/stores/toast-store';
import { startOutboxSync } from '@/sync/outbox';
import { errorMessage } from '@/utils/format';

/**
 * Signed-in area. Until the user belongs to a workspace only onboarding is
 * reachable; afterwards the tabs and every workspace screen are.
 */
export default function AppLayout() {
  const theme = useTheme();
  const { user } = useAuth();
  const { workspaceId, memberships, isLoading } = useWorkspace();
  const hasWorkspace = memberships.length > 0;

  useWorkspaceRealtime(workspaceId, user?.id);
  usePushNotifications(hasWorkspace);
  useEffect(() => startOutboxSync(), []);
  usePendingInvite();

  if (isLoading && !memberships.length) return <LoadingScreen message="Loading your workspaces" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: Platform.OS === 'android' ? 'fade_from_bottom' : 'default',
        fullScreenGestureEnabled: true,
      }}>
      <Stack.Protected guard={hasWorkspace}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="ticket/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="ticket/[id]" />
        <Stack.Screen name="ticket/edit/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="members/[userId]" />
        <Stack.Screen name="members/invite" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="workspace/categories" />
        <Stack.Screen name="workspaces" />
      </Stack.Protected>
      <Stack.Protected guard={!hasWorkspace}>
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Screen name="workspace/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="invitations" />
      <Stack.Screen name="account/profile" />
      <Stack.Screen name="account/settings" />
      <Stack.Screen name="account/notifications" />
      <Stack.Screen name="account/security" />
      <Stack.Screen name="account/help" />
    </Stack>
  );
}

/** An invite link opened while signed out is accepted right after sign-in. */
function usePendingInvite() {
  const accept = useAcceptInviteToken();
  const { mutate } = accept;
  useEffect(() => {
    const token = kv.get<string>(PENDING_INVITE_KEY);
    if (!token) return;
    kv.remove(PENDING_INVITE_KEY);
    mutate(token, {
      onSuccess: () => toast.success('You joined the workspace'),
      onError: (e) => toast.error(errorMessage(e)),
    });
  }, [mutate]);
}
