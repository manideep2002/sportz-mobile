import AsyncStorage from '@react-native-async-storage/async-storage';

import { useUiStore } from '@/store/uiStore';

describe('appearance preference persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useUiStore.setState({ themeMode: 'dark' });
    await Promise.resolve();
    await AsyncStorage.clear();
  });

  it('stores and restores only the theme across hydration', async () => {
    useUiStore.getState().setThemeMode('light');
    await Promise.resolve();

    const persisted = await AsyncStorage.getItem('sportz.ui');
    expect(persisted).not.toBeNull();
    expect(JSON.parse(persisted ?? '{}').state).toEqual({
      themeMode: 'light'
    });

    useUiStore.setState({ themeMode: 'dark' });
    await Promise.resolve();
    await AsyncStorage.setItem('sportz.ui', persisted ?? '');
    await useUiStore.persist.rehydrate();

    expect(useUiStore.getState()).toMatchObject({
      themeMode: 'light'
    });
    expect(useUiStore.getState()).not.toHaveProperty('accentColor');
  });

  it('ignores obsolete persisted accent choices', async () => {
    await AsyncStorage.setItem('sportz.ui', JSON.stringify({
      state: { themeMode: 'light', accentColor: 'blue' },
      version: 0
    }));

    await useUiStore.persist.rehydrate();

    expect(useUiStore.getState().themeMode).toBe('light');
    expect(useUiStore.getState()).not.toHaveProperty('accentColor');
  });
});
