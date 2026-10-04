import { create } from 'zustand';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}
interface UIState {
  toasts: Toast[];
  menuOpen: boolean;
  searchOpen: boolean;
  toast: (kind: Toast['kind'], text: string) => void;
  dismiss: (id: number) => void;
  setMenu: (v: boolean) => void;
  setSearch: (v: boolean) => void;
}
let seq = 1;
export const useUI = create<UIState>((set, get) => ({
  toasts: [],
  menuOpen: false,
  searchOpen: false,
  toast: (kind, text) => {
    const id = seq++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] }));
    setTimeout(() => get().dismiss(id), 3800);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setMenu: (menuOpen) => set({ menuOpen }),
  setSearch: (searchOpen) => set({ searchOpen }),
}));
