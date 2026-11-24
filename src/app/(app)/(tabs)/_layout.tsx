import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';

import { Avatar, Icon } from '@/components/ui';
import { WorkspaceSidebar } from '@/features/workspace/components/workspace-sidebar';
import { useUnreadCount } from '@/features/notifications/api';
import { useMyProfile, useWorkspace } from '@/features/workspace';
import { useTheme } from '@/hooks/use-theme';
import { displayName } from '@/utils/format';

/** Bottom navigation: Home · Tickets · Notifications · Profile. */
export default function TabsLayout() {
  const theme = useTheme();
  const { workspaceId } = useWorkspace();
  const unread = useUnreadCount(workspaceId).data ?? 0;
  const profile = useMyProfile().data;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.text,
          tabBarInactiveTintColor: theme.textTertiary,
          tabBarStyle: {
            backgroundColor: theme.background,
            borderTopColor: theme.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: Platform.OS === 'ios' ? 86 : 66,
            paddingTop: 6,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
          tabBarBadgeStyle: { backgroundColor: theme.danger, color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
          sceneStyle: { backgroundColor: theme.background },
          animation: 'fade',
        }}>
        <Tabs.Screen
          name="index"
          options={{ title: 'Home', tabBarIcon: ({ color }) => <Icon name="home" size={22} color={color as string} /> }}
        />
        <Tabs.Screen
          name="tickets"
          options={{ title: 'Tickets', tabBarIcon: ({ color }) => <Icon name="issue-opened" size={22} color={color as string} /> }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Notifications',
            tabBarBadge: unread ? (unread > 99 ? '99+' : unread) : undefined,
            tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'bell-fill' : 'bell'} size={22} color={color as string} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) => (
              <Avatar
                size={focused ? 26 : 24}
                name={displayName(profile, '?')}
                uri={profile?.avatar_url}
              />
            ),
          }}
        />
      </Tabs>
      <WorkspaceSidebar />
    </>
  );
}
