import { create } from 'zustand';

import { kv } from '@/services/local-db';

export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'theme-mode';

type ThemeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

/** Appearance preference: follow the phone, or force light / dark. Remembered across launches. */
export const useThemeStore = create<ThemeState>((set) => ({
  mode: kv.get<ThemeMode>(KEY) ?? 'system',
  setMode: (mode) => {
    kv.set(KEY, mode);
    set({ mode });
  },
}));
