import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppearanceScreen } from '@/screens/settings/AppearanceScreen';
import { useUiStore } from '@/store/uiStore';

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() })
}));

describe('AppearanceScreen', () => {
  beforeEach(() => {
    useUiStore.setState({ themeMode: 'dark' });
  });

  it('offers only dark and light mode without accent color choices', async () => {
    await render(<AppearanceScreen />);

    expect(screen.getByRole('button', { name: 'Dark' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Light' })).toBeTruthy();
    expect(screen.queryByText('Accent color')).toBeNull();
    expect(screen.queryByText('Blue')).toBeNull();
    expect(screen.queryByText('Green')).toBeNull();
    expect(screen.queryByText('Pink')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Light' }));
    expect(useUiStore.getState().themeMode).toBe('light');
  });
});
