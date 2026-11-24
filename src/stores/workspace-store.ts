import { create } from 'zustand';

import { kv } from '@/services/local-db';

const KEY = 'current-workspace';

type WorkspaceState = {
  currentId: string | null;
  setCurrent: (id: string | null) => void;
};

/** The workspace the user is looking at. Remembered across launches. */
export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  currentId: kv.get<string>(KEY),
  setCurrent: (id) => {
    if (id) kv.set(KEY, id);
    else kv.remove(KEY);
    set({ currentId: id });
  },
}));

type UiState = {
  sidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),
}));
