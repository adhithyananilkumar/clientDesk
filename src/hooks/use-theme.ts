import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Resolved colour tokens for the active appearance. */
export function useTheme() {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}

/** The active appearance, normalised to 'light' | 'dark'. */
export function useAppearance(): 'light' | 'dark' {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}
