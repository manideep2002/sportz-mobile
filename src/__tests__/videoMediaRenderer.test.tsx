import { render, screen } from '@testing-library/react-native';

import type { Story } from '@/types/domain';
import type { ThreadChatMessage } from '@/types/threadFirstChat';

const mockNavigation = {
  goBack: jest.fn()
};
const mockRoute: { params: { storyId: string; mediaUrl?: string; mediaKind?: 'image' | 'video' } } = {
  params: { storyId: 'story-1' }
};
const mockMarkStorySeen = jest.fn();
let mockStories: Story[] = [];

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@shopify/flash-list', () => require('@/test/mockFlashList'));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 })
}));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: Record<string, unknown>) => <View {...props} /> };
});
jest.mock('@/hooks/useStories', () => ({
  useStories: () => ({ data: mockStories }),
  useMarkStorySeen: () => mockMarkStorySeen,
  useDeleteStory: () => ({ isPending: false, mutate: jest.fn() })
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ profile: { id: 'viewer-1' }, user: { id: 'viewer-1' } })
}));
jest.mock('@/services/messageService', () => ({
  messageService: {
    createDirectConversation: jest.fn(),
    sendMessage: jest.fn()
  }
}));
jest.mock('@/services/storyService', () => ({
  storyService: {
    recordReaction: jest.fn(),
    recordReply: jest.fn()
  }
}));
jest.mock('@/services/threadFirstChatService', () => ({
  mergeThreadMessages: jest.fn(),
  removeThreadMessage: jest.fn(),
  threadFirstChatService: {
    pageSize: 20,
    getBubbleImageUrl: (_path: string | null, fallback: string | null) => fallback,
    getFullImageUrl: (_path: string | null, fallback: string | null) => fallback,
    getSignedVideoUrl: jest.fn().mockResolvedValue('https://example.com/signed.mp4')
  }
}));

// eslint-disable-next-line import/first
import { StoryViewerScreen } from '@/screens/feed/StoryViewerScreen';
// eslint-disable-next-line import/first
import { MessageMedia } from '@/screens/messages/ThreadFirstChatScreen';

const story = (mediaKind?: 'image' | 'video'): Story => ({
  id: 'story-1',
  user: {
    id: 'author-1',
    displayName: 'Asha Singh',
    initials: 'AS',
    avatarUrl: null,
    skillLevel: 'Advanced'
  },
  mediaUrl: 'https://example.com/story',
  mediaKind,
  body: null,
  seen: false,
  createdAt: '2026-07-23T10:00:00.000Z'
});

const message = (messageType: 'image' | 'video'): ThreadChatMessage => ({
  id: `message-${messageType}`,
  roomId: 'room-1',
  senderId: 'author-1',
  messageType,
  body: null,
  mediaUrl: `https://example.com/${messageType}`,
  mediaPath: `room-1/author-1/${messageType}`,
  mediaWidth: 1280,
  mediaHeight: 720,
  mediaMimeType: messageType === 'video' ? 'video/mp4' : 'image/jpeg',
  createdAt: '2026-07-23T10:00:00.000Z',
  editedAt: null,
  deliveryStatus: 'sent'
});

describe('video media rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStories = [];
    mockRoute.params = { storyId: 'story-1' };
  });

  it('renders VideoPlayer for a video story', async () => {
    mockStories = [story('video')];
    mockRoute.params = {
      storyId: 'story-1',
      mediaUrl: 'https://example.com/story.mp4',
      mediaKind: 'video'
    };

    await render(<StoryViewerScreen />);

    expect(screen.getByTestId('story-video-player')).toBeTruthy();
    expect(screen.queryByTestId('story-image')).toBeNull();
  });

  it.each([['image' as const], [undefined]])(
    'renders Image for an image or legacy story (%s)',
    async (mediaKind) => {
      mockStories = [story(mediaKind)];
      mockRoute.params = {
        storyId: 'story-1',
        mediaUrl: 'https://example.com/story.jpg',
        ...(mediaKind ? { mediaKind } : {})
      };

      await render(<StoryViewerScreen />);

      expect(screen.getByTestId('story-image')).toBeTruthy();
      expect(screen.queryByTestId('story-video-player')).toBeNull();
    }
  );

  it('renders VideoPlayer for a video chat message', async () => {
    await render(
      <MessageMedia
        message={message('video')}
        isActiveVideo={false}
        onActivateVideo={jest.fn()}
      />
    );

    expect(screen.getByTestId('chat-video-message-video')).toBeTruthy();
    expect(screen.queryByTestId('chat-image-message-video')).toBeNull();
  });

  it('renders ExpoImage for an image chat message', async () => {
    await render(
      <MessageMedia
        message={message('image')}
        isActiveVideo={false}
        onActivateVideo={jest.fn()}
      />
    );

    expect(screen.getByTestId('chat-image-message-image')).toBeTruthy();
    expect(screen.queryByTestId('chat-video-message-image')).toBeNull();
  });
});
