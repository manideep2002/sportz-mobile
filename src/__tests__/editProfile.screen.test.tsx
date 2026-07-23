import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockGoBack = jest.fn();
const mockSetProfile = jest.fn();
const mockUpdateProfile = jest.fn();
const mockVerifyUsername = jest.fn();
const mockRememberUsername = jest.fn();

const profile = {
  id: 'user-1',
  username: 'asha',
  displayName: 'Asha Singh',
  initials: 'AS',
  avatarUrl: null,
  coverUrl: 'https://example.test/cover.jpg',
  bio: 'Guard',
  city: 'Pune',
  country: 'IN',
  primarySport: 'Cricket',
  sports: ['Cricket', 'Running', 'Swimming'],
  position: 'Opener',
  skillLevel: 'Advanced' as const,
  isOnline: true,
  badges: [],
  stats: { followers: 4, following: 2, posts: 3, games: 1, winRate: 50 }
};

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@/components/profile/ProfileCover', () => ({
  ProfileCover: ({ uri, testID }: { uri?: string | null; testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID} accessibilityLabel={uri ?? 'gradient'} />;
  }
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack })
}));
jest.mock('@/hooks/useUsernameAvailability', () => ({
  useUsernameAvailability: () => ({ status: 'available', message: 'Available' })
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ profile, setProfile: mockSetProfile })
}));
jest.mock('@/services/profileService', () => ({
  profileService: {
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args)
  }
}));
jest.mock('@/services/storageService', () => ({
  storageService: {
    pickImage: jest.fn(),
    uploadMedia: jest.fn()
  }
}));
jest.mock('@/services/usernameAvailabilityService', () => ({
  usernameAvailabilityService: {
    verifyUsernameAvailability: (...args: unknown[]) => mockVerifyUsername(...args),
    rememberUsername: (...args: unknown[]) => mockRememberUsername(...args)
  }
}));

// eslint-disable-next-line import/first
import { EditProfileScreen } from '@/screens/profile/EditProfileScreen';

describe('EditProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyUsername.mockResolvedValue({ status: 'available', message: 'Available' });
    mockRememberUsername.mockResolvedValue(undefined);
    mockUpdateProfile.mockImplementation((_id: string, input: Record<string, unknown>) =>
      Promise.resolve({
        ...profile,
        ...input,
        coverUrl: input.removeCover ? null : profile.coverUrl
      })
    );
  });

  it('preserves all selected sports when saving an unrelated bio edit', async () => {
    await render(<EditProfileScreen />);

    await fireEvent.changeText(screen.getByLabelText('Bio'), 'Team captain');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          bio: 'Team captain',
          primarySport: 'Cricket',
          sports: ['Cricket', 'Running', 'Swimming']
        })
      )
    );
  });

  it('adds a new primary sport without deleting secondary sports', async () => {
    await render(<EditProfileScreen />);

    await fireEvent.press(screen.getAllByRole('button', { name: 'Football' })[0]);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          primarySport: 'Football',
          sports: ['Football', 'Cricket', 'Running', 'Swimming']
        })
      )
    );
  });

  it('stages cover removal and persists it only when Save is pressed', async () => {
    await render(<EditProfileScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Change profile cover' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Cover' }));
    expect(mockUpdateProfile).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ removeCover: true })
      )
    );
    expect(screen.getByTestId('edit-profile-cover').props.accessibilityLabel).toBe('gradient');
  });
});
