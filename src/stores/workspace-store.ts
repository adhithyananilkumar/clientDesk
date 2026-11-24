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
  profileOpen: boolean;
  openProfile: () => void;
  closeProfile: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  profileOpen: false,
  openProfile: () => set({ profileOpen: true }),
  closeProfile: () => set({ profileOpen: false }),
}));
