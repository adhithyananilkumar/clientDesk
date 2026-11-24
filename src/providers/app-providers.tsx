import type { ReactNode } from 'react';

import { AppThemeProvider } from './theme-provider';

/**
 * Single place where global providers are composed. Add new ones here
 * (query client, auth session, workspace context, ...) so the root layout stays thin.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return <AppThemeProvider>{children}</AppThemeProvider>;
}
