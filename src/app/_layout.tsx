import '@/global.css';

import { Stack } from 'expo-router';

import { AppLauncher } from '@/components/launch';
import { useAuth } from '@/features/auth';
import { AppProviders } from '@/providers';

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const signedIn = !!session;

  return (
    // The intro stays up until the stored session has been read, so there is no flash of the wrong screen.
    <AppLauncher ready={!isLoading}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
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
