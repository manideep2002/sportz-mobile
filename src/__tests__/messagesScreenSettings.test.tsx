import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('expo-video', () => ({
  useVideoPlayer: () => ({
    play: jest.fn(),
    pause: jest.fn(),
    replay: jest.fn(),
    muted: false,
    playing: false,
    status: 'idle',
    addListener: jest.fn(() => ({ remove: jest.fn() }))
  }),
  VideoView: 'VideoView'
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 })
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn()
  }),
  useFocusEffect: (cb: () => void) => {
    cb();
  }
}));

const mockConversation = {
  id: 'conv-100',
  title: 'Badminton Doubles',
  participants: [
    {
      id: 'user-1',
      username: 'alex',
      displayName: 'Alex Rider',
      initials: 'AR',
      bio: '',
      city: '',
      country: 'IN',
      primarySport: 'Badminton',
      sports: ['Badminton'],
      skillLevel: 'Intermediate',
      isOnline: true,
      badges: [],
      stats: { followers: 0, following: 0, posts: 0, winRate: 0, games: 0 }
    },
    {
      id: 'user-2',
      username: 'sam',
      displayName: 'Sam Wilson',
      initials: 'SW',
      bio: '',
      city: '',
      country: 'IN',
      primarySport: 'Badminton',
      sports: ['Badminton'],
      skillLevel: 'Intermediate',
      isOnline: true,
      badges: [],
      stats: { followers: 0, following: 0, posts: 0, winRate: 0, games: 0 }
    }
  ],
  isGroup: false,
  lastMessage: 'Ready for the game tonight?',
  lastMessageAt: '2026-08-07T12:00:00.000Z',
  unreadCount: 0,
  pinned: false,
  muted: false
};

const mockRefetch = jest.fn().mockResolvedValue({ data: [mockConversation] });
jest.mock('@/hooks/useMessages', () => ({
  useConversations: () => ({
    data: [mockConversation],
    isLoading: false,
    isError: false,
    refetch: mockRefetch
  }),
  messageKeys: {
    conversations: ['conversations'],
    conversation: (id: string) => ['conversation', id],
    messages: (id: string) => ['messages', id]
  }
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'user-1' } })
}));

jest.mock('@/store/messagingStore', () => ({
  useMessagingStore: () => jest.fn()
}));

jest.mock('@/layout/responsive', () => ({
  useResponsiveLayout: () => ({ supportsSplitPane: false })
}));

jest.mock('@/i18n', () => ({
  useAppTranslation: () => ({
    t: (key: string) => key
  })
}));

jest.mock('@/design/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      text: '#FFFFFF',
      textMuted: '#A0A0A0',
      textSubtle: '#707070',
      accent: '#FF6B00',
      accentSoft: 'rgba(255,107,0,0.15)',
      danger: '#FF3B30',
      dangerSoft: 'rgba(255,59,48,0.15)',
      surface: '#1A1A1A',
      border: '#333333',
      background: '#0D0D0D',
      onAccent: '#FFFFFF'
    }
  })
}));

import { MessagesScreen } from '@/screens/messages/MessagesScreen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const renderWithQueryClient = async (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
  return await render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('MessagesScreen conversation options', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens conversation settings on the same window when three dots is clicked without navigating to Chat', async () => {
    const { getByLabelText, getByText } = await renderWithQueryClient(<MessagesScreen />);

    // Tap the Manage button (three dots) on the conversation row
    const menuButton = getByLabelText('Manage Sam Wilson');
    expect(menuButton).toBeTruthy();

    await fireEvent.press(menuButton);

    // Verify it did NOT navigate to Chat with openSettings: true
    expect(mockNavigate).not.toHaveBeenCalledWith('Chat', expect.anything());

    // Verify settings sheet is rendered on the same window
    expect(getByText('Conversation settings')).toBeTruthy();
    expect(getByText('Pin conversation')).toBeTruthy();
    expect(getByText('Mute notifications')).toBeTruthy();
  });

  it('navigates to Chat when conversation row is clicked directly', async () => {
    const { getByLabelText } = await renderWithQueryClient(<MessagesScreen />);

    const row = getByLabelText(/Open conversation with Sam Wilson/);
    await fireEvent.press(row);

    expect(mockNavigate).toHaveBeenCalledWith('Chat', { conversationId: 'conv-100' });
  });
});
