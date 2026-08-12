import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';

import { ThemeProvider } from '@/design/ThemeProvider';
import { PrivacyScreen } from '@/screens/settings/PrivacyScreen';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';
import { profileService } from '@/services/profileService';
import { blockService } from '@/services/blockService';

const mockNavigate = jest.fn();
const mockSignOut = jest.fn();
const mockSetProfile = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 })
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate })
}));

jest.mock('expo-video', () => ({
  useVideoPlayer: () => ({ addListener: jest.fn(), play: jest.fn(), pause: jest.fn(), release: jest.fn() }),
  VideoView: 'VideoView'
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      profile: {
        id: 'user-1',
        isPrivate: false,
        sports: [],
        isAdmin: false,
        displayName: 'Athlete B',
        username: 'athlete_b',
        initials: 'AB'
      },
      setProfile: mockSetProfile,
      signOut: mockSignOut
    })
}));

jest.mock('@/services/profileService', () => ({ profileService: { updateProfile: jest.fn() } }));
jest.mock('@/services/blockService', () => ({ blockService: { listBlocked: jest.fn(), unblockUser: jest.fn() } }));

function renderWithTheme(children: ReactNode) {
  return render(<ThemeProvider>{children}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  (profileService.updateProfile as jest.Mock).mockReset();
  (blockService.listBlocked as jest.Mock).mockReset().mockResolvedValue([]);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

describe('privacy settings control semantics', () => {
  it('announces the private account row as a switch with checked state and hint', async () => {
    await renderWithTheme(<PrivacyScreen />);

    const toggle = screen.getByRole('switch', { name: 'Private account' });
    expect(toggle).toHaveProp('accessibilityRole', 'switch');
    expect(toggle).toHaveProp('accessibilityLabel', 'Private account');
    expect(toggle).toHaveProp('accessibilityHint', 'Only followers can see public posts.');
    expect(toggle).toHaveProp('accessibilityState', { checked: false, disabled: false, busy: false });
  });

  it('keeps a minimum touch target for the switch row', async () => {
    await renderWithTheme(<PrivacyScreen />);

    expect(screen.getByRole('switch', { name: 'Private account' })).toHaveStyle({ minHeight: 52 });
  });

  it('marks the switch disabled and busy while saving, then announces the result', async () => {
    let resolveUpdate!: () => void;
    (profileService.updateProfile as jest.Mock).mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveUpdate = resolve; })
    );
    await renderWithTheme(<PrivacyScreen />);

    const toggle = () => screen.getByRole('switch', { name: 'Private account' });
    fireEvent.press(toggle());
    expect(profileService.updateProfile).toHaveBeenCalledWith('user-1', { isPrivate: true });
    await waitFor(() => {
      expect(toggle()).toHaveProp('accessibilityState', { checked: true, disabled: true, busy: true });
    });

    await act(async () => { resolveUpdate(); });

    await waitFor(() => {
      expect(toggle()).toHaveProp('accessibilityState', { checked: true, disabled: false, busy: false });
    });
    expect(mockSetProfile).toHaveBeenCalledWith(expect.objectContaining({ isPrivate: true }));
  });

  it('reverts the switch and its enabled state when the update fails', async () => {
    (profileService.updateProfile as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await renderWithTheme(<PrivacyScreen />);

    const toggle = () => screen.getByRole('switch', { name: 'Private account' });
    fireEvent.press(toggle());

    await waitFor(() => {
      expect(toggle()).toHaveProp('accessibilityState', { checked: false, disabled: false, busy: false });
    });
    expect(mockSetProfile).not.toHaveBeenCalled();
  });
});

describe('settings row and sign-out semantics', () => {
  it('exposes navigation rows as buttons with an accessible name that includes the detail', async () => {
    await renderWithTheme(<SettingsScreen />);

    const row = screen.getByRole('button', { name: 'Privacy & Security. Account visibility, block list' });
    expect(row).toHaveProp('accessibilityRole', 'button');
    expect(row).toHaveStyle({ minHeight: 52 });
  });

  it('keeps sign out as a button with a hint and marks it busy while signing out', async () => {
    let resolveSignOut!: () => void;
    mockSignOut.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveSignOut = resolve; }));
    await renderWithTheme(<SettingsScreen />);

    const signOut = () => screen.getByRole('button', { name: 'Sign Out' });
    expect(signOut()).toHaveProp('accessibilityLabel', 'Sign Out');
    expect(signOut()).toHaveProp('accessibilityHint', 'Logs you out of SPORTZ on this device');
    expect(signOut()).toHaveProp('accessibilityState', { disabled: false, busy: false });
    expect(signOut()).toHaveStyle({ minHeight: 52 });

    fireEvent.press(signOut());
    await waitFor(() => {
      expect(signOut()).toHaveProp('accessibilityState', { disabled: true, busy: true });
    });

    await act(async () => { resolveSignOut(); });

    await waitFor(() => {
      expect(signOut()).toHaveProp('accessibilityState', { disabled: false, busy: false });
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('keeps the sign out action enabled after a failed sign out', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('offline'));
    await renderWithTheme(<SettingsScreen />);

    const signOut = () => screen.getByRole('button', { name: 'Sign Out' });
    fireEvent.press(signOut());

    await waitFor(() => {
      expect(signOut()).toHaveProp('accessibilityState', { disabled: false, busy: false });
    });
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('keeps focus order heading back first, then account rows in visual order', async () => {
    await renderWithTheme(<SettingsScreen />);

    const focusOrder = screen.getAllByRole('button').slice(0, 5).map((node) => node.props.accessibilityLabel);
    expect(focusOrder).toEqual([
      'Back',
      'Profile Settings. Edit name, bio, sport, position',
      'Account security. Password, MFA, sessions, identity, and account recovery',
      'Privacy & Security. Account visibility, block list',
      'Notifications. Push and in-app activity alerts'
    ]);
  });
});