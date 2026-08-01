import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockSignUp = jest.fn();
const mockVerifyUsername = jest.fn();
const mockRememberUsername = jest.fn();
const mockSetProfile = jest.fn();
const mockPickImage = jest.fn();
const mockStageAvatar = jest.fn();
const mockBindAvatar = jest.fn();
const mockAttachAvatar = jest.fn();
const mockValidateAvatar = jest.fn();
const mockDiscardAvatar = jest.fn();
let mockProfile: Record<string, unknown> | null = null;
let mockUser: Record<string, unknown> | null = null;

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn()
}));
jest.mock('@/hooks/useUsernameAvailability', () => ({
  useUsernameAvailability: () => ({ status: 'available', message: 'Username is available.' })
}));
jest.mock('@/services/usernameAvailabilityService', () => ({
  usernameAvailabilityService: {
    verifyUsernameAvailability: (...args: unknown[]) => mockVerifyUsername(...args),
    rememberUsername: (username: string) => mockRememberUsername(username)
  }
}));
jest.mock('@/services/storageService', () => ({
  storageService: { pickImage: () => mockPickImage() }
}));
jest.mock('@/services/registrationAvatarService', () => ({
  registrationAvatarService: {
    validate: (...args: unknown[]) => mockValidateAvatar(...args),
    stage: (...args: unknown[]) => mockStageAvatar(...args),
    bindToUser: (...args: unknown[]) => mockBindAvatar(...args),
    attachForAuthenticatedUser: (...args: unknown[]) => mockAttachAvatar(...args),
    discard: (...args: unknown[]) => mockDiscardAvatar(...args)
  }
}));
jest.mock('@/store/authStore', () => {
  const state = {
    signUp: (input: unknown) => mockSignUp(input),
    loading: false,
    get profile() { return mockProfile; },
    get user() { return mockUser; },
    setProfile: (profile: unknown) => mockSetProfile(profile)
  };
  const useAuthStore = (selector: (value: typeof state) => unknown) => selector(state);
  useAuthStore.getState = () => state;
  return { useAuthStore };
});

// eslint-disable-next-line import/first
import { RegisterScreen } from '@/screens/auth/RegisterScreen';

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

const renderScreen = async () => render(
  <RegisterScreen navigation={navigation as never} route={{} as never} />
);

interface TestFiber {
  memoizedProps?: { onPress?: () => Promise<void> };
  return: TestFiber | null;
}

const getPressHandler = (instance: unknown) => {
  let fiber = (instance as { unstable_fiber?: TestFiber }).unstable_fiber;
  while (fiber) {
    if (typeof fiber.memoizedProps?.onPress === 'function') return fiber.memoizedProps.onPress;
    fiber = fiber.return;
  }
  throw new Error('Press handler was not found.');
};

const chooseJanuary2000Dob = async () => {
  await fireEvent.press(screen.getByRole('button', { name: 'Date of birth' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Select Jan 15 2000' }));
};

const chooseMumbai = async () => {
  await fireEvent.press(screen.getByRole('button', { name: 'Location' }));
  await fireEvent.press(screen.getByText('Mumbai, Maharashtra'));
};

const fillValidForm = async () => {
  await fireEvent.changeText(screen.getByLabelText('First Name'), '  Priya  ');
  await fireEvent.changeText(screen.getByLabelText('Last Name'), ' Sharma ');
  await fireEvent.changeText(screen.getByLabelText('Username'), ' @Priya_10 ');
  await fireEvent.changeText(screen.getByLabelText('Email'), ' PRIYA@EXAMPLE.COM ');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'StrongPass9!');
  await fireEvent.changeText(screen.getByLabelText('Confirm Password'), 'StrongPass9!');
  await fireEvent.changeText(screen.getByLabelText('Mobile Number'), '09876 543 210');
  await chooseJanuary2000Dob();
  await chooseMumbai();
};

describe('RegisterScreen validation', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    mockProfile = null;
    mockUser = null;
    mockSignUp.mockResolvedValue({
      session: null,
      user: { id: 'user-1', email: 'priya@example.com' }
    });
    mockVerifyUsername.mockResolvedValue({ status: 'available', message: 'Username is available.' });
    mockRememberUsername.mockResolvedValue(undefined);
    mockPickImage.mockResolvedValue(null);
    mockStageAvatar.mockResolvedValue(undefined);
    mockBindAvatar.mockResolvedValue(undefined);
    mockAttachAvatar.mockResolvedValue(null);
    mockDiscardAvatar.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps an empty registration disabled and never submits', async () => {
    await renderScreen();
    const submit = screen.getByRole('button', { name: 'Create Profile' });

    expect(submit.props.accessibilityState.disabled).toBe(true);
    await fireEvent(screen.getByLabelText('First Name'), 'blur');
    await fireEvent(screen.getByLabelText('Email'), 'blur');
    await fireEvent(screen.getByLabelText('Mobile Number'), 'blur');
    expect(screen.getByText('First name is required.')).toBeTruthy();
    expect(screen.getByText('Email is required.')).toBeTruthy();
    expect(screen.getByText('Mobile number is required.')).toBeTruthy();
    await fireEvent.press(submit);
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('shows field-level messages for malformed values', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByLabelText('First Name'), '123');
    await fireEvent.changeText(screen.getByLabelText('Last Name'), 'Sharma_1');
    await fireEvent.changeText(screen.getByLabelText('Email'), 'not-an-email');
    await fireEvent.changeText(screen.getByLabelText('Mobile Number'), '12345');

    expect(screen.getByText(/First name can contain letters/)).toBeTruthy();
    expect(screen.getByText(/Last name can contain letters/)).toBeTruthy();
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(screen.getByText(/Enter a valid 10-digit Indian mobile number/)).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('shows an underage DOB error', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2010, 0, 20));
    await renderScreen();

    await chooseJanuary2000Dob();

    expect(screen.getAllByText('You must be at least 13 years old to create an account.').length).toBeGreaterThan(0);
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('shows a future-DOB error', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(1999, 0, 1));
    await renderScreen();

    await chooseJanuary2000Dob();

    expect(screen.getByText('Date of birth cannot be in the future.')).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('shows a field error when password confirmation does not match', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByLabelText('Password'), 'StrongPass9!');
    await fireEvent.changeText(screen.getByLabelText('Confirm Password'), 'Different9!');

    expect(screen.getByText('Passwords do not match.')).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('prevents duplicate submissions while signup is pending', async () => {
    let resolveSignup!: () => void;
    mockSignUp.mockReturnValueOnce(new Promise((resolve) => { resolveSignup = () => resolve({ session: null, user: { id: 'user-1', email: 'priya@example.com' } }); }));
    await renderScreen();
    await fillValidForm();
    const submit = screen.getByRole('button', { name: 'Create Profile' });
    const press = getPressHandler(submit);

    let firstSubmission!: Promise<void>;
    await act(async () => {
      firstSubmission = press();
      await press();
      await Promise.resolve();
    });

    await waitFor(() => expect(mockSignUp).toHaveBeenCalledTimes(1));
    await act(async () => {
      resolveSignup();
      await firstSubmission;
    });
    await waitFor(() => expect(screen.getByText('Check your inbox')).toBeTruthy());
  });

  it('submits normalized valid data and shows email confirmation', async () => {
    await renderScreen();
    await fillValidForm();
    const submit = screen.getByRole('button', { name: 'Create Profile' });

    expect(submit.props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(submit);

    await waitFor(() => expect(mockSignUp).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Priya',
      lastName: 'Sharma',
      username: 'Priya_10',
      email: 'priya@example.com',
      mobileNumber: '+919876543210',
      city: 'Mumbai, Maharashtra',
      dateOfBirth: '2000-01-15',
      confirmPassword: 'StrongPass9!'
    })));
    expect(await screen.findByText('Check your inbox')).toBeTruthy();
  });

  it('stages and attaches a selected avatar for an immediate authenticated session', async () => {
    const asset = { uri: 'file:///picked.jpg', width: 600, height: 600, type: 'image', mimeType: 'image/jpeg' };
    const profile = { id: 'user-1', avatarUrl: null };
    const uploadedProfile = { ...profile, avatarUrl: 'https://cdn/avatar.jpg' };
    mockPickImage.mockResolvedValue(asset);
    mockProfile = profile;
    mockUser = { id: 'user-1', email: 'priya@example.com' };
    mockSignUp.mockResolvedValue({ session: { user: mockUser }, user: mockUser });
    mockAttachAvatar.mockResolvedValue(uploadedProfile);
    await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Choose profile photo' }));
    await fillValidForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Create Profile' }));

    await waitFor(() => expect(mockStageAvatar).toHaveBeenCalledWith(asset, 'priya@example.com'));
    expect(mockBindAvatar).toHaveBeenCalledWith('user-1', 'priya@example.com');
    expect(mockAttachAvatar).toHaveBeenCalledWith('user-1', 'priya@example.com');
    expect(mockSetProfile).toHaveBeenCalledWith(uploadedProfile);
  });

  it('keeps a scoped avatar continuation when email confirmation is required', async () => {
    const asset = { uri: 'file:///picked.jpg', width: 600, height: 600, type: 'image', mimeType: 'image/jpeg' };
    mockPickImage.mockResolvedValue(asset);
    await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Choose profile photo' }));
    await fillValidForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Create Profile' }));

    expect(await screen.findByText('Check your inbox')).toBeTruthy();
    expect(mockStageAvatar).toHaveBeenCalled();
    expect(mockBindAvatar).toHaveBeenCalledWith('user-1', 'priya@example.com');
    expect(mockAttachAvatar).not.toHaveBeenCalled();
    expect(mockDiscardAvatar).not.toHaveBeenCalled();
  });

  it('keeps the current avatar when a replacement picker is cancelled', async () => {
    const asset = { uri: 'file:///picked.jpg', width: 600, height: 600, type: 'image', mimeType: 'image/jpeg' };
    mockPickImage.mockResolvedValueOnce(asset).mockResolvedValueOnce(null);
    await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Choose profile photo' }));
    expect(screen.getByRole('button', { name: 'Remove selected profile photo' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose profile photo' }));

    expect(screen.getByRole('button', { name: 'Remove selected profile photo' })).toBeTruthy();
    expect(mockValidateAvatar).toHaveBeenCalledTimes(1);
  });

  it('discards a staged avatar when signup fails before creating an account', async () => {
    const asset = { uri: 'file:///picked.jpg', width: 600, height: 600, type: 'image', mimeType: 'image/jpeg' };
    mockPickImage.mockResolvedValue(asset);
    mockSignUp.mockRejectedValue(new Error('Confirmation email could not be sent'));
    await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Choose profile photo' }));
    await fillValidForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Create Profile' }));

    await waitFor(() => expect(mockDiscardAvatar).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Confirmation email could not be sent')).toBeTruthy();
  });
});
