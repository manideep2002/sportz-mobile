import AsyncStorage from '@react-native-async-storage/async-storage';

import { useUiStore } from '@/store/uiStore';

describe('appearance preference persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useUiStore.setState({ themeMode: 'dark', accentColor: 'orange', language: 'en-IN' });
    await Promise.resolve();
    await AsyncStorage.clear();
  });

  it('stores and restores theme, accent, and locale across hydration', async () => {
    useUiStore.getState().setThemeMode('light');
    useUiStore.getState().setAccentColor('blue');
    useUiStore.getState().setLanguage('hi-IN');
    await Promise.resolve();

    const persisted = await AsyncStorage.getItem('sportz.ui');
    expect(persisted).not.toBeNull();
    expect(JSON.parse(persisted ?? '{}').state).toEqual({
      themeMode: 'light',
      accentColor: 'blue',
      language: 'hi-IN'
    });

    useUiStore.setState({ themeMode: 'dark', accentColor: 'orange', language: 'en-IN' });
    await Promise.resolve();
    await AsyncStorage.setItem('sportz.ui', persisted ?? '');
    await useUiStore.persist.rehydrate();

    expect(useUiStore.getState()).toMatchObject({
      themeMode: 'light',
      accentColor: 'blue',
      language: 'hi-IN'
    });
  });
});
