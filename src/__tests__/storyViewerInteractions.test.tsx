import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { Story } from '@/types/domain';

const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn()
};
const mockRoute = {
  params: {
    storyId: 'story-1',
    mediaUrl: 'https://example.com/story.jpg',
    mediaKind: 'image' as const
  }
};
const mockMarkStorySeen = jest.fn();
const mockDeleteStory = jest.fn();
const mockCreateDirectConversation = jest.fn();
const mockSendMessage = jest.fn();
const mockRecordReaction = jest.fn();
const mockRecordReply = jest.fn();
let mockCurrentProfileId = 'viewer-1';
let mockStories: Story[] = [];

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@/components/feed/StoryReactionOverlay', () => {
  const React = require('react');
  return {
    StoryReactionOverlay: React.forwardRef(function MockStoryReactionOverlay() {
      return null;
    })
  };
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 })
}));
jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true
}));
jest.mock('@/hooks/useStories', () => ({
  useStories: () => ({ data: mockStories }),
  useMarkStorySeen: () => mockMarkStorySeen,
  useDeleteStory: () => ({
    isPending: false,
    mutate: (...args: unknown[]) => mockDeleteStory(...args)
  })
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ profile: { id: mockCurrentProfileId } })
}));
jest.mock('@/services/messageService', () => ({
  messageService: {
    createDirectConversation: (...args: unknown[]) => mockCreateDirectConversation(...args),
    sendMessage: (...args: unknown[]) => mockSendMessage(...args)
  }
}));
jest.mock('@/services/storyService', () => ({
  storyService: {
    recordReaction: (...args: unknown[]) => mockRecordReaction(...args),
    recordReply: (...args: unknown[]) => mockRecordReply(...args)
  }
}));

// eslint-disable-next-line import/first
import { StoryViewerScreen } from '@/screens/feed/StoryViewerScreen';

const makeStory = (authorId: string): Story => ({
  id: 'story-1',
  user: {
    id: authorId,
    displayName: authorId === 'viewer-1' ? 'Asha Singh' : 'Maya Rao',
    initials: authorId === 'viewer-1' ? 'AS' : 'MR',
    avatarUrl: null,
    skillLevel: 'Advanced'
  },
  mediaUrl: 'https://example.com/story.jpg',
  mediaKind: 'image',
  body: null,
  seen: false,
  createdAt: '2026-07-30T10:00:00.000Z'
});

describe('StoryViewerScreen interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentProfileId = 'viewer-1';
    mockCreateDirectConversation.mockResolvedValue('room-1');
    mockSendMessage.mockResolvedValue(undefined);
    mockRecordReaction.mockResolvedValue(undefined);
    mockRecordReply.mockResolvedValue(undefined);
  });

  it('hides replies and reactions for an own story while preserving owner deletion', async () => {
    mockStories = [makeStory('viewer-1')];

    await render(<StoryViewerScreen />);

    expect(screen.getByRole('button', { name: 'Delete story' })).toBeTruthy();
    expect(screen.queryByLabelText('Reply to story')).toBeNull();
    expect(screen.queryByRole('button', { name: 'React 🔥 to story' })).toBeNull();
    expect(mockCreateDirectConversation).not.toHaveBeenCalled();
  });

  it('allows replies and reactions to another user story and creates the author DM', async () => {
    mockStories = [makeStory('author-2')];

    await render(<StoryViewerScreen />);

    expect(screen.queryByRole('button', { name: 'Delete story' })).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Reply to story'), 'Great finish');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Send story reply' }).props.accessibilityState?.disabled).toBe(false);
    });
    fireEvent.press(screen.getByRole('button', { name: 'Send story reply' }));

    await waitFor(() => {
      expect(mockRecordReply).toHaveBeenCalledWith('story-1', 'Great finish');
      expect(mockCreateDirectConversation).toHaveBeenCalledWith('author-2');
      expect(mockSendMessage).toHaveBeenCalledWith('room-1', 'Great finish');
    });

    fireEvent.press(screen.getByRole('button', { name: 'React 🔥 to story' }));

    await waitFor(() => {
      expect(mockRecordReaction).toHaveBeenCalledWith('story-1', '🔥');
      expect(mockCreateDirectConversation).toHaveBeenCalledTimes(2);
      expect(mockSendMessage).toHaveBeenLastCalledWith('room-1', '🔥');
    });
  });
});
