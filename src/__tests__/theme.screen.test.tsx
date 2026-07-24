import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { VerifiedName } from '@/components/ui/VerifiedName';
import { ThemeProvider, useAppTheme } from '@/design/ThemeProvider';
import { colors } from '@/design/tokens';
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
      <AppText testID="legacy-primary-text" style={{ color: colors.text.primary }}>Primary text</AppText>
      <AppText testID="muted-text" variant="bodyMuted">Muted text</AppText>
      <Chip>All Sports</Chip>
      <VerifiedName profile={{ displayName: 'Asha Singh', skillLevel: 'Pro' }} />
    </Screen>
  );
}

describe('core screen theme smoke states', () => {
  it.each(['dark', 'light'] as const)('renders a readable %s screen state', async (mode) => {
    useUiStore.setState({ themeMode: mode });
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
    expect(screen.getByRole('button', { name: 'All Sports' })).toHaveStyle({
      alignSelf: 'flex-start',
      flexShrink: 0
    });
    expect(screen.getByTestId('legacy-primary-text')).toHaveStyle({
      color: mode === 'dark' ? '#F4EFE9' : '#17130F'
    });
    expect(screen.getByTestId('muted-text')).toHaveStyle({
      color: mode === 'dark' ? '#B6ADA4' : '#5F574F'
    });
    expect(screen.getByLabelText('Verified pro player')).toHaveStyle({
      backgroundColor: mode === 'dark' ? 'rgba(245,158,11,0.15)' : '#FEF3C7',
      borderColor: mode === 'dark' ? 'rgba(245,158,11,0.46)' : '#D97706'
    });
  });
});

const createExpectedTheme = (mode: 'dark' | 'light') =>
  mode === 'dark'
    ? { surface: '#1E1A17', border: '#2A2420' }
    : { surface: '#FFFFFF', border: '#D8D0C7' };
