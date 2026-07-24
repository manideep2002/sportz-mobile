import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { ThemeProvider, useAppTheme } from '@/design/ThemeProvider';
import { useUiStore } from '@/store/uiStore';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 })
}));

function CoreScreenProbe() {
  const theme = useAppTheme();
  return (
    <Screen scroll={false}>
      <View
        testID="theme-probe"
        style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}
      />
    </Screen>
  );
}

describe('core screen theme smoke states', () => {
  it.each(['dark', 'light'] as const)('renders a readable %s screen state', async (mode) => {
    useUiStore.setState({ themeMode: mode, accentColor: 'green' });
    await render(
      <ThemeProvider>
        <CoreScreenProbe />
      </ThemeProvider>
    );

    const theme = createExpectedTheme(mode);
    expect(screen.getByTestId('theme-probe')).toHaveStyle({
      backgroundColor: theme.surface,
      borderColor: theme.border
    });
  });
});

const createExpectedTheme = (mode: 'dark' | 'light') =>
  mode === 'dark'
    ? { surface: '#1E1A17', border: '#2A2420' }
    : { surface: '#FFFFFF', border: '#D8D0C7' };
