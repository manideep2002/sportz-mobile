import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ThemeMode } from '@/design/tokens';

export type AccentColor = 'orange' | 'green' | 'blue' | 'pink';
export type SupportedLocale = 'en-IN' | 'hi-IN';

export const normalizeLocale = (value: unknown): SupportedLocale =>
  value === 'hi-IN' || value === 'Hindi' ? 'hi-IN' : 'en-IN';

interface UiState {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  language: SupportedLocale;
  createSheetOpen: boolean;
  notificationUnreadCount: number;
  onlineUserIds: Set<string>;
  setThemeMode: (mode: ThemeMode) => void;
  setAccentColor: (color: AccentColor) => void;
  setLanguage: (language: SupportedLocale) => void;
  setNotificationUnreadCount: (count: number) => void;
  incrementNotificationUnreadCount: (delta?: number) => void;
  setOnlineUserIds: (userIds: string[]) => void;
  openCreateSheet: () => void;
  closeCreateSheet: () => void;
  resetForSession: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      themeMode: 'dark',
      accentColor: 'orange',
      language: 'en-IN',
      createSheetOpen: false,
      notificationUnreadCount: 0,
      onlineUserIds: new Set(),
      setThemeMode: (themeMode) => set({ themeMode }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setLanguage: (language) => set({ language }),
      setNotificationUnreadCount: (notificationUnreadCount) =>
        set({ notificationUnreadCount: Math.max(0, notificationUnreadCount) }),
      incrementNotificationUnreadCount: (delta = 1) =>
        set((state) => ({
          notificationUnreadCount: Math.max(0, state.notificationUnreadCount + delta)
        })),
      setOnlineUserIds: (userIds) => set({ onlineUserIds: new Set(userIds) }),
      openCreateSheet: () => set({ createSheetOpen: true }),
      closeCreateSheet: () => set({ createSheetOpen: false }),
      resetForSession: () =>
        set({
          createSheetOpen: false,
          notificationUnreadCount: 0,
          onlineUserIds: new Set()
        })
    }),
    {
      name: 'sportz.ui',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        accentColor: state.accentColor,
        language: state.language
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<UiState>;
        return {
          ...current,
          ...saved,
          language: normalizeLocale(saved.language),
          createSheetOpen: false,
          onlineUserIds: new Set()
        };
      }
    }
  )
);
