import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockHasRecent = jest.fn();
const mockListSessions = jest.fn();
const mockListFactors = jest.fn();
const mockListEvents = jest.fn();
const mockListIdentities = jest.fn();
const mockUnenroll = jest.fn();

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));
jest.mock('@/services/accountSecurityService', () => ({
  accountSecurityService: {
    hasRecentAuthentication: () => mockHasRecent(),
    listSessions: () => mockListSessions(),
    listMfaFactors: () => mockListFactors(),
    listSecurityEvents: () => mockListEvents(),
    listIdentities: () => mockListIdentities(),
    unenrollTotp: (...args: unknown[]) => mockUnenroll(...args),
    reauthenticate: jest.fn(),
    updatePassword: jest.fn(),
    enrollTotp: jest.fn(),
    verifyTotp: jest.fn(),
    recordMfaEnrollment: jest.fn(),
    requestEmailChange: jest.fn(),
    requestPhoneChange: jest.fn(),
    verifyPhoneChange: jest.fn(),
    revokeSession: jest.fn()
  }
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({
    user: { id: 'user-1', email: 'athlete@example.com' },
    deleteAccount: jest.fn()
  })
}));

// eslint-disable-next-line import/first
import { AccountSecurityScreen } from '@/screens/settings/AccountSecurityScreen';

describe('AccountSecurityScreen independent resources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasRecent.mockResolvedValue(true);
    mockListSessions.mockResolvedValue([]);
    mockListFactors.mockResolvedValue([{
      id: 'factor-1', status: 'verified', friendly_name: 'My authenticator', created_at: '2026-01-01T00:00:00Z'
    }]);
    mockListEvents.mockResolvedValue([]);
    mockListIdentities.mockResolvedValue([{ id: 'identity-1', provider: 'email' }]);
    mockUnenroll.mockResolvedValue(undefined);
  });

  it('keeps factors and identities usable when sessions fail', async () => {
    mockListSessions.mockRejectedValue(new Error('Sessions unavailable'));
    await render(<AccountSecurityScreen />);

    expect(await screen.findByText('My authenticator')).toBeTruthy();
    expect(screen.getByText('Linked sign-in methods: email')).toBeTruthy();
    expect(screen.getByText('Sessions unavailable')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry active sessions' })).toBeTruthy();
    expect(screen.queryByText('No active sessions were returned.')).toBeNull();
  });

  it('protects destructive factor removal from duplicate taps', async () => {
    let finishRemoval!: () => void;
    mockUnenroll.mockImplementationOnce(() => new Promise<void>((resolve) => { finishRemoval = resolve; }));
    await render(<AccountSecurityScreen />);
    const remove = await screen.findByRole('button', { name: 'Remove' });

    await fireEvent.press(remove);
    await fireEvent.press(remove);
    expect(mockUnenroll).toHaveBeenCalledTimes(1);
    finishRemoval();
    await waitFor(() => expect(mockListFactors).toHaveBeenCalledTimes(2));
  });
});
