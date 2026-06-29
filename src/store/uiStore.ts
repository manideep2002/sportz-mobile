import { create } from 'zustand';

import type { ThemeMode } from '@/design/tokens';

type AccentColor = 'orange' | 'green' | 'blue' | 'pink';

interface UiState {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  language: string;
  createSheetOpen: boolean;
  onlineUserIds: Set<string>;
  setThemeMode: (mode: ThemeMode) => void;
  setAccentColor: (color: AccentColor) => void;
  setLanguage: (language: string) => void;
  setOnlineUserIds: (userIds: string[]) => void;
  openCreateSheet: () => void;
  closeCreateSheet: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  themeMode: 'dark',
  accentColor: 'orange',
  language: 'English',
  createSheetOpen: false,
  onlineUserIds: new Set(),
  setThemeMode: (themeMode) => set({ themeMode }),
  setAccentColor: (accentColor) => set({ accentColor }),
  setLanguage: (language) => set({ language }),
  setOnlineUserIds: (userIds) => set({ onlineUserIds: new Set(userIds) }),
  openCreateSheet: () => set({ createSheetOpen: true }),
  closeCreateSheet: () => set({ createSheetOpen: false })
}));
