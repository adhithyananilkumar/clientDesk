import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { AuthProvider } from '@/features/auth';
import { queryClient, restoreQueryCache, startPersistingQueryCache } from '@/services/query-client';

import { AppThemeProvider } from './theme-provider';

// Cached screens are available on the very first frame, even offline.
restoreQueryCache();
startPersistingQueryCache();

/**
 * Single place where global providers are composed so the root layout stays thin.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}
