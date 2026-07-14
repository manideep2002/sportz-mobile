import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  popToTop: jest.fn()
};
const mockRoute = {
  params: { conversationId: 'room-1' }
};
const mockSetConversationMutedLocally = jest.fn();
const mockInsertMessage = jest.fn();
const mockSetPinned = jest.fn();
const mockSetMuted = jest.fn();
const mockInvalidateQueries = jest.fn().mockResolvedValue(undefined);
const mockQueryClient = {
  invalidateQueries: mockInvalidateQueries,
  setQueryData: jest.fn(),
  removeQueries: jest.fn()
};

const mockCurrentUser = {
  id: 'user-1',
  username: 'asha',
  displayName: 'Asha Singh',
  initials: 'AS',
  avatarUrl: null,
  bio: '',
  city: 'Bengaluru',
  country: 'India',
  primarySport: 'Basketball',
  sports: ['Basketball'],
  skillLevel: 'Intermediate',
  isOnline: true,
  badges: [],
  stats: { followers: 1, following: 1, posts: 1, winRate: 50, games: 2 }
};
const mockTeammate = {
  ...mockCurrentUser,
  id: 'user-2',
  username: 'maya',
  displayName: 'Maya Rao',
  initials: 'MR'
};
const mockConversation = {
  id: 'room-1',
  title: 'Tournament Team',
  participants: [mockCurrentUser, mockTeammate],
  isGroup: true,
  lastMessage: '',
  lastMessageAt: '2026-07-14T10:00:00.000Z',
  unreadCount: 0,
  pinned: false,
  muted: false,
  currentUserRole: 'owner',
  participantRoles: { 'user-1': 'owner', 'user-2': 'member' }
};

const mockChannel: Record<string, jest.Mock> = {
  on: jest.fn(),
  subscribe: jest.fn(),
  send: jest.fn().mockResolvedValue(undefined),
  track: jest.fn().mockResolvedValue(undefined),
  untrack: jest.fn().mockResolvedValue(undefined)
};
mockChannel.on.mockImplementation(() => mockChannel);
mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
  callback('SUBSCRIBED');
  return mockChannel;
});

const mergeMessages = (current: any[], incoming: any | any[]) => {
  const items = Array.isArray(incoming) ? incoming : [incoming];
  const byId = new Map(current.map((item) => [item.id, item]));
  items.forEach((item) => byId.set(item.id, { ...byId.get(item.id), ...item }));
  return Array.from(byId.values());
};

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@shopify/flash-list', () => require('@/test/mockFlashList'));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn()
}));
jest.mock('@/hooks/useMessages', () => ({
  useConversation: () => ({ data: mockConversation }),
  messageKeys: {
    conversation: (id: string) => ['messages', 'conversation', id],
    conversations: ['messages', 'conversations'],
    messages: (id: string) => ['messages', id]
  }
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => mockChannel),
    removeChannel: jest.fn().mockResolvedValue(undefined)
  }
}));
jest.mock('@/services/messageService', () => ({
  messageService: {
    updateMessage: jest.fn(),
    deleteMessage: jest.fn(),
    setConversationPinned: (...args: unknown[]) => mockSetPinned(...args),
    setConversationMuted: (...args: unknown[]) => mockSetMuted(...args),
    removeGroupMember: jest.fn(),
    leaveConversation: jest.fn()
  }
}));
jest.mock('@/services/threadFirstChatService', () => ({
  mergeThreadMessages: (current: any[], incoming: any | any[]) => mergeMessages(current, incoming),
  removeThreadMessage: (current: any[], id: string) => current.filter((item) => item.id !== id),
  threadFirstChatService: {
    pageSize: 20,
    listMessages: jest.fn().mockResolvedValue([]),
    listParticipants: jest.fn().mockResolvedValue([
      { roomId: 'room-1', userId: 'user-1', lastReadAt: null, isActive: true, role: 'owner' },
      { roomId: 'room-1', userId: 'user-2', lastReadAt: null, isActive: true, role: 'member' }
    ]),
    createMessageId: jest.fn(() => 'message-1'),
    insertMessage: (...args: unknown[]) => mockInsertMessage(...args),
    markRead: jest.fn(),
    getBubbleImageUrl: jest.fn(),
    getFullImageUrl: jest.fn(),
    uploadChatMedia: jest.fn()
  }
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ user: { id: 'user-1' } })
}));
jest.mock('@/store/messagingStore', () => ({
  useMessagingStore: (selector: (state: unknown) => unknown) =>
    selector({ setConversationMutedLocally: mockSetConversationMutedLocally })
}));

// eslint-disable-next-line import/first
import { ChatScreen } from '@/screens/messages/ChatScreen';

describe('ChatScreen actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChannel.on.mockImplementation(() => mockChannel);
    mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      callback('SUBSCRIBED');
      return mockChannel;
    });
    mockChannel.send.mockResolvedValue(undefined);
    mockInsertMessage.mockImplementation(async (message) => ({
      ...message,
      deliveryStatus: 'sent'
    }));
    mockSetPinned.mockResolvedValue(undefined);
    mockSetMuted.mockResolvedValue(undefined);
    mockInvalidateQueries.mockResolvedValue(undefined);
  });

  it('sends composer text and persists the optimistic message', async () => {
    await render(<ChatScreen />);

    expect(await screen.findByText('Send the first message.')).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText('Message...'), '  See you at six  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Send message' }));

    expect(screen.getByText('See you at six')).toBeTruthy();
    await waitFor(() =>
      expect(mockInsertMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'message-1',
          roomId: 'room-1',
          senderId: 'user-1',
          body: 'See you at six'
        })
      )
    );
  });

  it('pins, mutes, and routes owners to add group members', async () => {
    await render(<ChatScreen />);

    await screen.findByText('Send the first message.');
    await fireEvent.press(screen.getByRole('button', { name: 'Conversation settings' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Pin conversation' }));
    await waitFor(() => expect(mockSetPinned).toHaveBeenCalledWith('room-1', true));

    await fireEvent.press(screen.getByRole('button', { name: 'Mute notifications' }));
    await waitFor(() => expect(mockSetMuted).toHaveBeenCalledWith('room-1', true));

    await fireEvent.press(screen.getByRole('button', { name: 'Add members' }));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('NewMessage', {
      addToConversationId: 'room-1'
    });
  });
});









