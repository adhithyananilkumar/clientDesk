import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export const unstable_settings = {
  initialRouteName: 'welcome',
};

/**
 * Signed-out area: welcome, sign in and create account.
 *
 * Transitions run on the native UI thread (react-native-screens), so they stay at
 * full frame rate even while JS is busy. iOS keeps its own push with the
 * edge-to-edge swipe back; Android gets a fade-up that matches Material motion.
 */
export default function AuthLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Paint the scene background so nothing white shows through mid-transition.
        contentStyle: { backgroundColor: theme.background },
        animation: Platform.OS === 'android' ? 'fade_from_bottom' : 'default',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        animationMatchesGesture: true,
      }}
    />
  );
}
