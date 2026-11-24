import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useUnreadCount } from '@/features/notifications/api';

import { useWorkspace } from '../api';
import { ProfileButton } from './profile-drawer';
import { WorkspaceSwitcher } from './workspace-switcher';

/** Right-hand cluster shared by every tab: optional extras, bell, profile. */
export function TopBarActions({ extra }: { extra?: ReactNode }) {
  const { workspaceId } = useWorkspace();
  const unread = useUnreadCount(workspaceId).data ?? 0;
  return (
    <View style={styles.actions}>
      {extra}
      <IconButton icon="bell" label="Notifications" badge={unread} onPress={() => router.push('/notifications')} filled />
      <ProfileButton />
    </View>
  );
}

/** Workspace switcher on the left, actions on the right. Same on all tabs. */
export function TopBar({ extra }: { extra?: ReactNode }) {
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <WorkspaceSwitcher />
      </View>
      <TopBarActions extra={extra} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, paddingTop: Spacing.two },
  left: { flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
