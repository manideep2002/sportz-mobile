import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';

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

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: 'sportz.ui',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        accentColor: state.accentColor,
        language: state.language
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<UiState>),
        createSheetOpen: false,
        onlineUserIds: new Set()
      })
    }
  )
);
