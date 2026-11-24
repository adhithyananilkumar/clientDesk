import type { ReactNode } from 'react';

import { AuthProvider } from '@/features/auth';

import { AppThemeProvider } from './theme-provider';

/**
 * Single place where global providers are composed. Add new ones here
 * (query client, workspace context, ...) so the root layout stays thin.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </AppThemeProvider>
  );
}
