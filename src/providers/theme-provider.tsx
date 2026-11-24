import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';

import { Colors } from '@/constants/theme';
import { useAppearance } from '@/hooks/use-theme';

function navigationTheme(base: Theme, palette: (typeof Colors)[keyof typeof Colors]): Theme {
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.text,
      background: palette.background,
      card: palette.background,
      text: palette.text,
      border: palette.border,
      notification: palette.text,
    },
  };
}

const LIGHT = navigationTheme(DefaultTheme, Colors.light);
const DARK = navigationTheme(DarkTheme, Colors.dark);

/** Applies brand colours to navigation and keeps the status bar legible in both appearances. */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const appearance = useAppearance();

  return (
    <ThemeProvider value={appearance === 'dark' ? DARK : LIGHT}>
      <StatusBar style="auto" />
      {children}
    </ThemeProvider>
  );
}
