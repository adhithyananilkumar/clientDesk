import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useThemeStore } from '@/stores/theme-store';

/** The chosen appearance: the user's override, else the phone's setting. */
export function useColorScheme() {
  const system = useSystemColorScheme();
  const mode = useThemeStore((s) => s.mode);
  return mode === 'system' ? system : mode;
}
