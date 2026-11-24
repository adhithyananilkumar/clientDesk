import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui';
import { ProfileDrawer } from '@/features/workspace/components/profile-drawer';
import { useTheme } from '@/hooks/use-theme';

/** Bottom navigation: Home · Tickets · Members · Settings (workspace). Notifications is a pushed screen. */
export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.text,
          tabBarInactiveTintColor: theme.textTertiary,
          // Floating "island": inset from the edges, rounded, lifted off the background.
          tabBarStyle: {
            backgroundColor: theme.surface,
            borderTopWidth: 0,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.border,
            borderRadius: 32,
            height: 64,
            paddingTop: 0,
            paddingBottom: 0,
            marginHorizontal: 20,
            marginBottom: Math.max(insets.bottom, 12),
            elevation: 10,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
          },
          tabBarItemStyle: { paddingVertical: 8 },
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
          name="members"
          options={{ title: 'Members', tabBarIcon: ({ color }) => <Icon name="people" size={22} color={color as string} /> }}
        />
        <Tabs.Screen
          name="settings"
          options={{ title: 'Settings', tabBarIcon: ({ color }) => <Icon name="gear" size={22} color={color as string} /> }}
        />
      </Tabs>
      <ProfileDrawer />
    </>
  );
}
