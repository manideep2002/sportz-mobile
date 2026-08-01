import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockListFactors = jest.fn();
const mockVerify = jest.fn();
const mockReauthenticate = jest.fn();
const mockRequestRecovery = jest.fn();
const mockCompleteRecovery = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@/services/accountSecurityService', () => ({
  accountSecurityService: {
    listMfaFactors: () => mockListFactors(),
    reauthenticate: (...args: unknown[]) => mockReauthenticate(...args),
    requestMfaRecovery: () => mockRequestRecovery(),
    completeMfaRecovery: (...args: unknown[]) => mockCompleteRecovery(...args)
  }
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({
    verifyMfaChallenge: (...args: unknown[]) => mockVerify(...args),
    signOut: () => mockSignOut(),
    loading: false
  })
}));

// eslint-disable-next-line import/first
import { MfaChallengeScreen } from '@/screens/auth/MfaChallengeScreen';

const renderScreen = () => render(<MfaChallengeScreen navigation={{} as never} route={{} as never} />);

describe('MfaChallengeScreen recovery states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListFactors.mockResolvedValue([{ id: 'factor-1', status: 'verified' }]);
    mockVerify.mockResolvedValue(undefined);
    mockReauthenticate.mockResolvedValue(undefined);
    mockRequestRecovery.mockResolvedValue(undefined);
    mockCompleteRecovery.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
  });

  it('shows factor failure and retry without enabling verification', async () => {
    mockListFactors.mockRejectedValueOnce(new Error('Factors offline')).mockResolvedValueOnce([]);
    await renderScreen();

    expect(await screen.findByText('Factors offline')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verify and continue' }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry authenticator loading' }));
    expect(await screen.findByText('No verified authenticator is available for this account.')).toBeTruthy();
  });

  it('validates empty recovery password and recovery code inline', async () => {
    await renderScreen();
    await waitFor(() => expect(
      screen.getByRole('button', { name: 'Verify and continue' }).props.accessibilityState.disabled
    ).toBe(false));
    await fireEvent.press(screen.getByRole('button', { name: 'I lost my authenticator' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Send recovery code' }));
    expect(await screen.findByText('Enter your current password.')).toBeTruthy();
    expect(mockReauthenticate).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Current password'), 'password');
    await waitFor(() => expect(screen.getByLabelText('Current password').props.value).toBe('password'));
    await fireEvent.press(screen.getByRole('button', { name: 'Send recovery code' }));
    await waitFor(() => expect(mockRequestRecovery).toHaveBeenCalledTimes(1));
    expect(await screen.findByLabelText('Email recovery code')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove MFA and sign out other devices' }));
    expect(screen.getByText('Enter the recovery code from your email.')).toBeTruthy();
    expect(mockCompleteRecovery).not.toHaveBeenCalled();
  });

  it('shows an expired challenge as a durable inline error', async () => {
    mockVerify.mockRejectedValue(new Error('Challenge has expired'));
    await renderScreen();
    await waitFor(() => expect(
      screen.getByRole('button', { name: 'Verify and continue' }).props.accessibilityState.disabled
    ).toBe(false));
    await fireEvent.changeText(screen.getByLabelText('Authenticator code'), '123456');
    await waitFor(() => expect(screen.getByLabelText('Authenticator code').props.value).toBe('123456'));
    await fireEvent.press(screen.getByRole('button', { name: 'Verify and continue' }));

    expect(await screen.findByText(/This challenge expired/)).toBeTruthy();
  });
});
