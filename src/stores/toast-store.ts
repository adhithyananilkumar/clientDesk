import { create } from 'zustand';

export type ToastTone = 'default' | 'success' | 'danger';

type Toast = { id: number; message: string; tone: ToastTone };

type ToastState = {
  toast: Toast | null;
  show: (message: string, tone?: ToastTone) => void;
  hide: () => void;
};

let counter = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show: (message, tone = 'default') => {
    clearTimeout(timer);
    set({ toast: { id: ++counter, message, tone } });
    timer = setTimeout(() => set({ toast: null }), 3200);
  },
  hide: () => set({ toast: null }),
}));

/** Fire-and-forget toast from anywhere (also outside React). */
export const toast = {
  show: (message: string) => useToastStore.getState().show(message),
  success: (message: string) => useToastStore.getState().show(message, 'success'),
  error: (message: string) => useToastStore.getState().show(message, 'danger'),
};
