import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

/**
 * Only reached by deep links to /sign-in or /sign-up. In normal use the whole
 * signed-out flow lives on the welcome screen (see `AuthFlow`) and never
 * navigates, so there are no page transitions to jerk.
 */
export default function AuthFormsLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: 'none',
      }}
    />
  );
}
