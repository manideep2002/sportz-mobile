import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockNavigation = {
  goBack: jest.fn()
};
const mockRoute: { params?: Record<string, any> } = { params: undefined };
const mockCreatePost = jest.fn();
const mockUpdatePost = jest.fn();

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute
}));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 1 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn()
}));
jest.mock('@/hooks/useFeed', () => ({
  useCreatePost: () => ({ mutateAsync: mockCreatePost, isPending: false }),
  useUpdatePost: () => ({ mutateAsync: mockUpdatePost, isPending: false }),
  usePost: () => ({ data: undefined })
}));
jest.mock('@/services/profileService', () => ({
  profileService: { listPlayers: jest.fn() }
}));
jest.mock('@/services/storageService', () => ({
  storageService: { pickMedia: jest.fn() }
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      profile: {
        id: 'user-1',
        displayName: 'Asha Singh',
        initials: 'AS',
        avatarUrl: null
      }
    })
}));

// eslint-disable-next-line import/first
import { CreatePostScreen } from '@/screens/feed/CreatePostScreen';

describe('CreatePostScreen visibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatePost.mockResolvedValue({ id: 'post-1' });
    mockRoute.params = undefined;
  });

  it('defaults a community post to members and submits an explicit public override', async () => {
    mockRoute.params = { communityId: 'community-9' };
    await render(<CreatePostScreen />);

    expect(screen.getByText(/Posting to community/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Community' }).props.accessibilityState.selected).toBe(true);

    await fireEvent.changeText(screen.getByPlaceholderText('What is happening on the court?'), 'Open practice tonight');
    await fireEvent.press(screen.getByRole('button', { name: 'Public' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() =>
      expect(mockCreatePost).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Open practice tonight',
          communityId: 'community-9',
          visibility: 'public'
        })
      )
    );
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('submits followers visibility for a standalone post', async () => {
    await render(<CreatePostScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('What is happening on the court?'), 'Training recap');
    await fireEvent.press(screen.getByRole('button', { name: 'Followers' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() =>
      expect(mockCreatePost).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Training recap',
          communityId: undefined,
          visibility: 'followers'
        })
      )
    );
  });
});



