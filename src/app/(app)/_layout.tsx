import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Signed-in area. Navigation (tabs / stacks) for the main product lives here. */
export default function AppLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: Platform.OS === 'android' ? 'fade_from_bottom' : 'default',
        fullScreenGestureEnabled: true,
      }}
    />
  );
}
