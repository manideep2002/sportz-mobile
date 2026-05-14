import { create } from 'zustand';

import type { ThemeMode } from '@/design/tokens';

interface UiState {
  themeMode: ThemeMode;
  createSheetOpen: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  openCreateSheet: () => void;
  closeCreateSheet: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  themeMode: 'dark',
  createSheetOpen: false,
  setThemeMode: (themeMode) => set({ themeMode }),
  openCreateSheet: () => set({ createSheetOpen: true }),
  closeCreateSheet: () => set({ createSheetOpen: false })
}));
