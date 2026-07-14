import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockUpdatePassword = jest.fn();
const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn()
};

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ updatePassword: mockUpdatePassword, loading: false })
}));

// eslint-disable-next-line import/first
import { ResetPasswordScreen } from '@/screens/auth/ResetPasswordScreen';

describe('ResetPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdatePassword.mockResolvedValue(undefined);
  });

  it('keeps an invalid password on the form and shows user-facing validation', async () => {
    await render(<ResetPasswordScreen navigation={mockNavigation as never} route={{} as never} />);

    await fireEvent.changeText(screen.getByPlaceholderText('New password'), 'short');
    await fireEvent.changeText(screen.getByPlaceholderText('Confirm password'), 'different');
    await fireEvent.press(screen.getByRole('button', { name: 'Update Password' }));

    expect(await screen.findByText('Password must be at least 8 characters.')).toBeTruthy();
    expect(screen.getByText('Passwords do not match.')).toBeTruthy();
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('updates the password, shows success, and returns to sign in', async () => {
    await render(<ResetPasswordScreen navigation={mockNavigation as never} route={{} as never} />);

    await fireEvent.changeText(screen.getByPlaceholderText('New password'), 'StrongPass9!');
    await fireEvent.changeText(screen.getByPlaceholderText('Confirm password'), 'StrongPass9!');
    await fireEvent.press(screen.getByRole('button', { name: 'Update Password' }));

    await waitFor(() => expect(mockUpdatePassword).toHaveBeenCalledWith('StrongPass9!'));
    expect(await screen.findByText('Password Updated')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Back to Sign In' }));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Login');
  });
});



