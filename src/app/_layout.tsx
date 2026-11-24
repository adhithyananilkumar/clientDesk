import '@/global.css';

import { Stack } from 'expo-router';

import { AppLauncher } from '@/components/launch';
import { AppProviders } from '@/providers';

export default function RootLayout() {
  return (
    <AppProviders>
      <AppLauncher>
        <Stack screenOptions={{ headerShown: false }} />
      </AppLauncher>
    </AppProviders>
  );
}
