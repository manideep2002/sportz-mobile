import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, AppState, type AppStateStatus } from 'react-native';

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
const mockListMessages = jest.fn();
const mockListParticipants = jest.fn();
const mockNetInfoFetch = jest.fn();
const mockRequestMediaPermissions = jest.fn();
const mockLaunchImageLibrary = jest.fn();
const mockUploadChatMedia = jest.fn();
const mockBroadcastHandlers: Record<string, (event: { payload: unknown }) => void> = {};
let mockSubscribeCallback: ((status: string) => void) | undefined;
let mockPresenceState: Record<string, Record<string, unknown>[]> = {};
const mockSetPinned = jest.fn();
const mockSetMuted = jest.fn();
const mockClearHistory = jest.fn();
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
  untrack: jest.fn().mockResolvedValue(undefined),
  presenceState: jest.fn(() => mockPresenceState)
};
mockChannel.on.mockImplementation((_type, filter: { event: string }, callback: (event: { payload: unknown }) => void) => {
  mockBroadcastHandlers[filter.event] = callback;
  return mockChannel;
});
mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
  mockSubscribeCallback = callback;
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
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockRequestMediaPermissions(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibrary(...args)
}));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: (...args: unknown[]) => mockNetInfoFetch(...args) }
}));
jest.mock('@/hooks/useMessages', () => ({
  useConversation: () => ({ data: mockConversation }),
  useMarkConversationRead: jest.fn(),
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
jest.mock('@/services/storageService', () => ({
  storageService: { validateMediaAsset: jest.fn() }
}));
jest.mock('@/services/threadFirstChatService', () => ({
  mergeThreadMessages: (current: any[], incoming: any | any[]) => mergeMessages(current, incoming),
  removeThreadMessage: (current: any[], id: string) => current.filter((item) => item.id !== id),
  isMessageVisibleAfterClear: () => true,
  threadFirstChatService: {
    pageSize: 20,
    listMessages: (...args: unknown[]) => mockListMessages(...args),
    listParticipants: (...args: unknown[]) => mockListParticipants(...args),
    createMessageId: jest.fn(() => 'message-1'),
    insertMessage: (...args: unknown[]) => mockInsertMessage(...args),
    markRead: jest.fn(),
    clearDirectRoomHistory: (...args: unknown[]) => mockClearHistory(...args),
    getBubbleImageUrl: jest.fn(),
    getFullImageUrl: jest.fn(),
    uploadChatMedia: (...args: unknown[]) => mockUploadChatMedia(...args)
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

// eslint-disable-next-line import/first
import { useUiStore } from '@/store/uiStore';

describe('ChatScreen actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
    Object.keys(mockBroadcastHandlers).forEach((key) => delete mockBroadcastHandlers[key]);
    mockSubscribeCallback = undefined;
    mockPresenceState = {};
    useUiStore.getState().setOnlineUserIds([]);
    mockConversation.isGroup = true;
    mockChannel.on.mockImplementation((_type, filter: { event: string }, callback: (event: { payload: unknown }) => void) => {
      mockBroadcastHandlers[filter.event] = callback;
      return mockChannel;
    });
    mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      mockSubscribeCallback = callback;
      callback('SUBSCRIBED');
      return mockChannel;
    });
    mockChannel.send.mockResolvedValue(undefined);
    mockInsertMessage.mockImplementation(async (message) => ({
      ...message,
      deliveryStatus: 'sent'
    }));
    mockListMessages.mockResolvedValue([]);
    mockListParticipants.mockResolvedValue([
      { roomId: 'room-1', userId: 'user-1', lastReadAt: null, clearedAt: null, isActive: true, role: 'owner' },
      { roomId: 'room-1', userId: 'user-2', lastReadAt: null, clearedAt: null, isActive: true, role: 'member' }
    ]);
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockRequestMediaPermissions.mockResolvedValue({ granted: true });
    mockUploadChatMedia.mockResolvedValue({
      mediaUrl: 'https://cdn.example.com/img.jpg',
      mediaPath: 'room-1/user-1/message-1.jpg',
      mediaWidth: 640,
      mediaHeight: 480,
      mediaMimeType: 'image/jpeg'
    });
    mockSetPinned.mockResolvedValue(undefined);
    mockSetMuted.mockResolvedValue(undefined);
    mockClearHistory.mockResolvedValue({
      roomId: 'room-1', userId: 'user-1', lastReadAt: '2026-07-29T10:00:00.000Z',
      clearedAt: '2026-07-29T10:00:00.000Z', isActive: true, role: 'owner'
    });
    mockInvalidateQueries.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('only shows online after verified peer presence and clears it on disconnect', async () => {
    let appStateChange: ((state: AppStateStatus) => void) | undefined;
    const appStateSpy = jest.mocked(AppState.addEventListener).mockImplementation((_type, listener) => {
      appStateChange = listener;
      return { remove: jest.fn() };
    });
    mockConversation.isGroup = false;
    await render(<ChatScreen />);

    expect(await screen.findByText('Chat')).toBeTruthy();
    mockPresenceState = {
      'user-2': [{ userId: 'user-2', onlineAt: '2026-07-30T12:00:00.000Z' }]
    };
    await act(async () => {
      mockBroadcastHandlers.sync?.({ payload: {} });
    });
    expect(await screen.findByText('Active now')).toBeTruthy();

    await act(async () => {
      appStateChange?.('background');
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.queryByText('Active now')).toBeNull());
    expect(screen.getByText('Chat')).toBeTruthy();
    expect(mockChannel.untrack).toHaveBeenCalled();

    await act(async () => {
      mockSubscribeCallback?.('CHANNEL_ERROR');
      await Promise.resolve();
    });
    expect(await screen.findByText('Presence unavailable')).toBeTruthy();
    mockConversation.isGroup = true;
    appStateSpy.mockRestore();
  }, 10_000);

  it('falls back to app-wide presence for a peer online outside the room, excluding the current user', async () => {
    mockConversation.isGroup = false;
    await render(<ChatScreen />);

    expect(await screen.findByText('Chat')).toBeTruthy();

    // Room presence is empty; only the current user is online app-wide.
    await act(async () => {
      useUiStore.getState().setOnlineUserIds(['user-1']);
      mockBroadcastHandlers.sync?.({ payload: {} });
    });
    expect(await screen.findByText('Offline')).toBeTruthy();

    // A peer online somewhere else in the app (not in this room) is active.
    await act(async () => {
      useUiStore.getState().setOnlineUserIds(['user-2']);
    });
    expect(await screen.findByText('Active now')).toBeTruthy();

    // The current user alone app-wide must never mark the chat active.
    await act(async () => {
      useUiStore.getState().setOnlineUserIds(['user-1']);
    });
    await waitFor(() => expect(screen.queryByText('Active now')).toBeNull());
    mockConversation.isGroup = true;
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
    await fireEvent.press(screen.getByRole('switch', { name: 'Pin conversation' }));
    await waitFor(() => expect(mockSetPinned).toHaveBeenCalledWith('room-1', true));

    await fireEvent.press(screen.getByRole('switch', { name: 'Mute notifications' }));
    await waitFor(() => expect(mockSetMuted).toHaveBeenCalledWith('room-1', true));

    await fireEvent.press(screen.getByRole('button', { name: 'Add members' }));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('NewMessage', {
      addToConversationId: 'room-1'
    });
  });

  it('confirms and clears direct history only after the server watermark succeeds', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    mockConversation.isGroup = false;
    await render(<ChatScreen />);
    await screen.findByText('Send the first message.');

    await fireEvent.press(screen.getByRole('button', { name: 'Conversation settings' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Clear history' }));

    expect(alert).toHaveBeenCalledWith(
      'Clear history?',
      expect.stringContaining('only for you'),
      expect.any(Array)
    );
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => {
      buttons.find((button) => button.text === 'Clear history')?.onPress?.();
      await Promise.resolve();
    });

    await waitFor(() => expect(mockClearHistory).toHaveBeenCalledWith('room-1'));
    expect(mockQueryClient.removeQueries).toHaveBeenCalledWith({ queryKey: ['messages', 'room-1'] });
    mockConversation.isGroup = true;
    alert.mockRestore();
  });

  it('keeps the direct conversation usable and reports a clear-history failure', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    mockConversation.isGroup = false;
    mockClearHistory.mockRejectedValueOnce(new Error('Watermark update failed'));
    await render(<ChatScreen />);
    await screen.findByText('Send the first message.');

    await fireEvent.press(screen.getByRole('button', { name: 'Conversation settings' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Clear history' }));
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => {
      buttons.find((button) => button.text === 'Clear history')?.onPress?.();
      await Promise.resolve();
    });

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not clear history', 'Watermark update failed'));
    expect(screen.getByText('Send the first message.')).toBeTruthy();
    alert.mockRestore();
  });

  it('renders a durable initial error, disables composition, and retries', async () => {
    mockListMessages.mockRejectedValueOnce(new Error('History unavailable'));
    await render(<ChatScreen />);

    expect(await screen.findByText('Chat unavailable')).toBeTruthy();
    expect(screen.getByText('History unavailable')).toBeTruthy();
    expect(screen.queryByText('Send the first message.')).toBeNull();
    expect(screen.getByLabelText('Message').props.editable).toBe(false);
    expect(screen.getByRole('button', { name: 'Send message' }).props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Retry chat' }));
    expect(await screen.findByText('Send the first message.')).toBeTruthy();
    expect(screen.getByLabelText('Message').props.editable).toBe(true);
  });

  it('retries failed delivery with the same client ID and prevents duplicate sends', async () => {
    let attempt = 0;
    mockInsertMessage.mockImplementation(async (message) => {
      attempt += 1;
      if (attempt === 1) throw new Error('offline');
      return { ...message, deliveryStatus: 'sent' };
    });
    await render(<ChatScreen />);
    await screen.findByText('Send the first message.');

    await fireEvent.changeText(screen.getByPlaceholderText('Message...'), 'Idempotent hello');
    const send = screen.getByRole('button', { name: 'Send message' });
    fireEvent.press(send);

    expect(await screen.findByText('Failed')).toBeTruthy();
    expect(mockInsertMessage).toHaveBeenCalledTimes(1);
    expect(mockInsertMessage.mock.calls[0][0].id).toBe('message-1');
    fireEvent.press(send);
    expect(mockInsertMessage).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Retry message' }));
    await waitFor(() => expect(mockInsertMessage).toHaveBeenCalledTimes(2));
    expect(mockInsertMessage.mock.calls[1][0].id).toBe('message-1');
    expect(await screen.findByText('Sent')).toBeTruthy();
  });

  it('keeps offline messages recoverable and allows removing a failed message', async () => {
    mockNetInfoFetch.mockResolvedValueOnce({ isConnected: false });
    await render(<ChatScreen />);
    await screen.findByText('Send the first message.');

    await fireEvent.changeText(screen.getByPlaceholderText('Message...'), 'Offline hello');
    await fireEvent.press(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('Failed')).toBeTruthy();
    expect(mockInsertMessage).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove failed message' }));
    expect(screen.queryByText('Offline hello')).toBeNull();
  });

  it('deduplicates realtime events and reconciles messages after reconnect', async () => {
    const first = {
      id: 'server-1', roomId: 'room-1', senderId: 'user-2', messageType: 'text',
      body: 'Server hello', mediaUrl: null, mediaPath: null, mediaWidth: null,
      mediaHeight: null, mediaMimeType: null, createdAt: '2026-07-30T10:00:00.000Z',
      editedAt: null, deliveryStatus: 'sent'
    };
    mockListMessages.mockResolvedValueOnce([first]);
    await render(<ChatScreen />);
    expect(await screen.findByText('Server hello')).toBeTruthy();

    await act(() => {
      mockBroadcastHandlers.message_created?.({ payload: { message: first } });
      mockBroadcastHandlers.message_created?.({ payload: { message: first } });
    });
    expect(screen.getAllByText('Server hello')).toHaveLength(1);

    mockListMessages.mockResolvedValueOnce([
      first,
      { ...first, id: 'server-2', body: 'After reconnect', createdAt: '2026-07-30T10:01:00.000Z' }
    ]);
    await act(() => {
      mockSubscribeCallback?.('CHANNEL_ERROR');
      mockSubscribeCallback?.('SUBSCRIBED');
    });
    expect(await screen.findByText('After reconnect')).toBeTruthy();
  });

  it('shows pagination failure recovery and merges a retried page once', async () => {
    const page = Array.from({ length: 20 }, (_, index) => ({
      id: `message-${index + 10}`, roomId: 'room-1', senderId: 'user-2', messageType: 'text',
      body: `Message ${index}`, mediaUrl: null, mediaPath: null, mediaWidth: null,
      mediaHeight: null, mediaMimeType: null, createdAt: `2026-07-30T09:${String(index).padStart(2, '0')}:00.000Z`,
      editedAt: null, deliveryStatus: 'sent'
    }));
    mockListMessages.mockResolvedValueOnce(page).mockRejectedValueOnce(new Error('Page failed'));
    await render(<ChatScreen />);
    await screen.findByText('Message 0');

    await fireEvent.press(screen.getByText('Load older'));
    expect(await screen.findByText('Page failed')).toBeTruthy();

    mockListMessages.mockResolvedValueOnce([
      { ...page[0], id: 'older-1', body: 'Recovered older message', createdAt: '2026-07-30T08:00:00.000Z' }
    ]);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry older messages' }));
    expect(await screen.findByText('Recovered older message')).toBeTruthy();
    expect(screen.getAllByText('Recovered older message')).toHaveLength(1);
  });

  it('shows a media review and only sends after confirmation', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///photo.jpg', type: 'image', width: 640, height: 480, mimeType: 'image/jpeg' }]
    });
    await render(<ChatScreen />);
    await screen.findByText('Send the first message.');

    await fireEvent.press(screen.getByRole('button', { name: 'Attach photo or video' }));
    expect(await screen.findByText('Review media')).toBeTruthy();
    expect(mockUploadChatMedia).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(mockUploadChatMedia).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mockInsertMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType: 'image',
          mediaUrl: 'https://cdn.example.com/img.jpg'
        })
      )
    );
  });

  it('discards the selected media when the preview is cancelled', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///photo.jpg', type: 'image', width: 640, height: 480, mimeType: 'image/jpeg' }]
    });
    await render(<ChatScreen />);
    await screen.findByText('Send the first message.');

    await fireEvent.press(screen.getByRole('button', { name: 'Attach photo or video' }));
    await screen.findByText('Review media');

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText('Review media')).toBeNull());
    expect(mockUploadChatMedia).not.toHaveBeenCalled();
    expect(mockInsertMessage).not.toHaveBeenCalled();
    expect(mockLaunchImageLibrary).toHaveBeenCalledTimes(1);
  });
});









