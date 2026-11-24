import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemeStore } from '@/stores/theme-store';

const noop = () => () => {};

/**
 * To support static rendering, the server (and the first client render) use
 * 'light'; the real scheme is used once hydrated.
 */
export function useColorScheme() {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const system = useRNColorScheme();
  const mode = useThemeStore((s) => s.mode);
  if (!hydrated) return 'light';
  return mode === 'system' ? system : mode;
}
