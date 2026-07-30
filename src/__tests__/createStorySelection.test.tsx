import type { ImagePickerAsset } from 'expo-image-picker';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockNavigation = {
  goBack: jest.fn(),
  replace: jest.fn()
};
const mockPickMultipleImages = jest.fn();
const mockCaptureMedia = jest.fn();
const mockValidateMediaAsset = jest.fn();
const mockCreateStories = jest.fn();

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation
}));
jest.mock('@/services/storageService', () => ({
  storageService: {
    pickMultipleImages: (...args: unknown[]) => mockPickMultipleImages(...args),
    captureMedia: (...args: unknown[]) => mockCaptureMedia(...args),
    validateMediaAsset: (...args: unknown[]) => mockValidateMediaAsset(...args)
  }
}));
jest.mock('@/hooks/useStories', () => ({
  useCreateStories: () => ({
    isPending: false,
    mutateAsync: (...args: unknown[]) => mockCreateStories(...args)
  })
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      profile: {
        id: 'viewer-1',
        displayName: 'Asha Singh',
        initials: 'AS',
        avatarUrl: null,
        skillLevel: 'Advanced'
      }
    })
}));

// eslint-disable-next-line import/first
import { CreateStoryScreen } from '@/screens/feed/CreateStoryScreen';

const asset = (index: number): ImagePickerAsset => ({
  uri: `file:///story-${index}.jpg`,
  width: 1080,
  height: 1920,
  assetId: `asset-${index}`,
  type: 'image',
  mimeType: 'image/jpeg'
});

const createdStory = (index: number) => ({
  id: `created-${index}`,
  user: {
    id: 'viewer-1',
    displayName: 'Asha Singh',
    initials: 'AS',
    avatarUrl: null,
    skillLevel: 'Advanced'
  },
  mediaUrl: `https://example.com/story-${index}.jpg`,
  mediaKind: 'image' as const,
  body: null,
  seen: false,
  createdAt: '2026-07-30T10:00:00.000Z'
});

describe('CreateStoryScreen multi-asset selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPickMultipleImages.mockResolvedValue([]);
    mockCaptureMedia.mockResolvedValue(null);
    mockCreateStories.mockImplementation(async ({ assets }: { assets: ImagePickerAsset[] }) =>
      assets.map((_, index) => createdStory(index + 1))
    );
  });

  it('keeps zero assets after picker cancellation', async () => {
    await render(<CreateStoryScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Choose story media' }));

    await waitFor(() => expect(mockPickMultipleImages).toHaveBeenCalledWith(10));
    expect(screen.getByText('0 of 10 selected')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share' })).toBeDisabled();
  });

  it('previews one asset and lets the user remove it', async () => {
    mockPickMultipleImages.mockResolvedValue([asset(1)]);
    await render(<CreateStoryScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Choose story media' }));

    expect(await screen.findByText('1 of 10 selected')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Preview story 1' }).props.accessibilityState).toEqual({
      selected: true
    });
    mockPickMultipleImages.mockResolvedValue([]);
    fireEvent.press(screen.getByRole('button', { name: 'Add more story media' }));
    expect(await screen.findByText('1 of 10 selected')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Remove story 1' }));

    expect(await screen.findByText('0 of 10 selected')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove story 1' })).toBeNull();
  });

  it('accepts ten ordered assets and preserves order after an edit', async () => {
    const orderedAssets = Array.from({ length: 10 }, (_, index) => asset(index + 1));
    mockPickMultipleImages.mockResolvedValue(orderedAssets);
    await render(<CreateStoryScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Choose story media' }));
    expect(await screen.findByText('10 of 10 selected')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Story asset limit reached' })).toBeDisabled();

    fireEvent.press(screen.getByRole('button', { name: 'Remove story 5' }));
    expect(await screen.findByText('9 of 10 selected')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Share 9' }));

    await waitFor(() => expect(mockCreateStories).toHaveBeenCalled());
    expect(mockCreateStories.mock.calls[0][0].assets).toEqual([
      ...orderedAssets.slice(0, 4),
      ...orderedAssets.slice(5)
    ]);
  });

  it('reports and rejects assets beyond ten instead of truncating silently', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const selectedAssets = Array.from({ length: 12 }, (_, index) => asset(index + 1));
    mockPickMultipleImages.mockResolvedValue(selectedAssets);
    await render(<CreateStoryScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Choose story media' }));

    expect(await screen.findByText('10 of 10 selected')).toBeTruthy();
    expect(alert).toHaveBeenCalledWith(
      'Some assets were not added',
      '2 selected assets were not added because a story can contain at most 10 assets.'
    );
    expect(screen.queryByRole('button', { name: 'Preview story 11' })).toBeNull();
    alert.mockRestore();
  });

  it('surfaces picker errors without changing the current selection', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    mockPickMultipleImages.mockRejectedValue(new Error('Picker unavailable'));
    await render(<CreateStoryScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Choose story media' }));

    await waitFor(() => {
      expect(alert).toHaveBeenCalledWith('Media picker failed', 'Picker unavailable');
    });
    expect(screen.getByText('0 of 10 selected')).toBeTruthy();
    alert.mockRestore();
  });
});
