import { fireEvent, render, screen } from '@testing-library/react-native';

import { SettingsScreen } from '@/screens/settings/SettingsScreen';
import { useUiStore } from '@/store/uiStore';

const mockNavigate = jest.fn();
jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate })
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      profile: {
        sports: ['Cricket', 'Running'],
        isAdmin: false
      },
      signOut: jest.fn(),
      deleteAccount: jest.fn()
    })
}));

describe('AppearanceScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useUiStore.setState({ themeMode: 'dark' });
  });

  it('offers only dark and light mode without accent color choices', async () => {
    await render(<SettingsScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Appearance, Dark' }));
    expect(screen.getByRole('button', { name: 'Dark' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Light' })).toBeTruthy();
    expect(screen.queryByText('Accent color')).toBeNull();
    expect(screen.queryByText('Blue')).toBeNull();
    expect(screen.queryByText('Green')).toBeNull();
    expect(screen.queryByText('Pink')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Light' }));
    expect(useUiStore.getState().themeMode).toBe('light');
  });

  it('expands appearance choices in Settings without navigating to another page', async () => {
    await render(<SettingsScreen />);

    expect(screen.queryByRole('button', { name: 'Light' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Appearance, Dark' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Light' }));
    expect(useUiStore.getState().themeMode).toBe('light');
    expect(mockNavigate).not.toHaveBeenCalledWith('Appearance');
  });
});
