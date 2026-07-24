import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ThemeMode } from '@/design/tokens';

interface UiState {
  themeMode: ThemeMode;
  createSheetOpen: boolean;
  notificationUnreadCount: number;
  onlineUserIds: Set<string>;
  setThemeMode: (mode: ThemeMode) => void;
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
      createSheetOpen: false,
      notificationUnreadCount: 0,
      onlineUserIds: new Set(),
      setThemeMode: (themeMode) => set({ themeMode }),
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
        themeMode: state.themeMode
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<UiState>;
        return {
          ...current,
          themeMode: saved.themeMode === 'light' ? 'light' : 'dark',
          createSheetOpen: false,
          onlineUserIds: new Set()
        };
      }
    }
  )
);
