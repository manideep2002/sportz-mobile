import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockNavigation = {
  goBack: jest.fn()
};
const mockRoute: { params?: Record<string, any> } = { params: undefined };
const mockCreatePost = jest.fn();
const mockUpdatePost = jest.fn();
const mockRefetchPost = jest.fn();
const mockPickMedia = jest.fn();
let mockEditPostResult: {
  data?: Record<string, unknown>;
  isLoading: boolean;
  isError: boolean;
  error?: Error;
};

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
  useEditablePost: () => ({ ...mockEditPostResult, refetch: mockRefetchPost })
}));
jest.mock('@/services/profileService', () => ({
  profileService: { listPlayers: jest.fn() }
}));
jest.mock('@/services/storageService', () => ({
  storageService: {
    pickMedia: (...args: unknown[]) => mockPickMedia(...args),
    validateMediaAsset: jest.fn()
  }
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
  const editPost = {
    id: 'post-1',
    author: {
      id: 'user-1',
      displayName: 'Asha Singh',
      initials: 'AS',
      username: 'asha'
    },
    communityId: null,
    kind: 'post',
    sport: 'Basketball',
    body: 'Original caption',
    mediaUrl: null,
    mediaKind: 'none',
    mediaStoragePath: null,
    statsLine: undefined,
    visibility: 'public',
    locationLabel: 'Bengaluru, Karnataka',
    mentionedUsers: [{
      id: 'user-2',
      displayName: 'Mina Rao',
      initials: 'MR',
      username: 'mina'
    }]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatePost.mockResolvedValue({ id: 'post-1' });
    mockUpdatePost.mockResolvedValue({ id: 'post-1' });
    mockPickMedia.mockResolvedValue(null);
    mockEditPostResult = {
      data: undefined,
      isLoading: false,
      isError: false
    };
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

  it('preserves structured mentions and location in a text-only edit', async () => {
    mockRoute.params = { editPostId: 'post-1' };
    mockEditPostResult.data = editPost;
    await render(<CreatePostScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('What is happening on the court?'), 'Updated caption');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockUpdatePost).toHaveBeenCalledWith({
        postId: 'post-1',
        input: expect.objectContaining({
          body: 'Updated caption',
          communityId: null,
          locationLabel: 'Bengaluru, Karnataka',
          mentionedUserIds: ['user-2'],
          mediaAsset: null,
          removeMedia: false
        })
      })
    );
  });

  it('allows a media-only post to be saved', async () => {
    mockRoute.params = { editPostId: 'post-1' };
    mockEditPostResult.data = {
      ...editPost,
      body: '',
      mediaUrl: 'https://example.test/original.jpg',
      mediaKind: 'image'
    };
    await render(<CreatePostScreen />);

    expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockUpdatePost).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ body: '', removeMedia: false })
        })
      )
    );
  });

  it('submits replacement media for a mixed-media edit', async () => {
    const replacement = {
      uri: 'file:///replacement.mp4',
      width: 1280,
      height: 720,
      assetId: null,
      type: 'video'
    };
    mockRoute.params = { editPostId: 'post-1' };
    mockEditPostResult.data = {
      ...editPost,
      mediaUrl: 'https://example.test/original.jpg',
      mediaKind: 'image'
    };
    mockPickMedia.mockResolvedValue(replacement);
    await render(<CreatePostScreen />);

    await fireEvent.press(screen.getByText('Change media'));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockUpdatePost).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            mediaAsset: replacement,
            mediaKind: 'video',
            removeMedia: false
          })
        })
      )
    );
  });

  it('submits explicit media removal while keeping text', async () => {
    mockRoute.params = { editPostId: 'post-1' };
    mockEditPostResult.data = {
      ...editPost,
      mediaUrl: 'https://example.test/original.jpg',
      mediaKind: 'image'
    };
    await render(<CreatePostScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Remove media' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockUpdatePost).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            mediaAsset: null,
            mediaKind: 'none',
            removeMedia: true
          })
        })
      )
    );
  });

  it('retains community context and disables visibility changes while editing', async () => {
    mockRoute.params = { editPostId: 'post-1', communityId: 'community-9' };
    mockEditPostResult.data = {
      ...editPost,
      communityId: 'community-9',
      visibility: 'group'
    };
    await render(<CreatePostScreen />);

    expect(screen.queryByRole('button', { name: 'Public' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Community' }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockUpdatePost).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            communityId: 'community-9',
            visibility: 'group'
          })
        })
      )
    );
  });
});



