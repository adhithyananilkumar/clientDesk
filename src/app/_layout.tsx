import '@/global.css';

import { Stack } from 'expo-router';

import { AppLauncher } from '@/components/launch';
import { useAuth } from '@/features/auth';
import { useTheme } from '@/hooks/use-theme';
import { AppProviders } from '@/providers';

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const signedIn = !!session;
  const theme = useTheme();

  return (
    // The launcher (spinning mark) stays up until the stored session has been read.
    // The navigator only mounts after that, so it never resolves a route for the wrong auth state.
    <AppLauncher ready={!isLoading}>
      {isLoading ? null : (
        // Moving between signed-out and signed-in areas is a state change, not a push,
        // so it cross-fades instead of sliding.
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            animationDuration: 280,
            contentStyle: { backgroundColor: theme.background },
          }}>
          {/* "/" only exists inside (app). Signed-out users are sent to the welcome screen instead of an unmatched route. */}
          <Stack.Protected guard={signedIn} redirectTo="/welcome">
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn} redirectTo="/">
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Screen name="+not-found" />
        </Stack>
      )}
    </AppLauncher>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
