import {
  EVENT_MESSAGE_PAGE_SIZE,
  eventService,
  mergeEventMessages
} from '@/services/eventService';
import type { EventMessage, UserProfile } from '@/types/domain';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockAssertConfigured = jest.fn();
const mockRemoveChannel = jest.fn();
let mockRealtimeStatus: ((status: string) => void) | undefined;
const mockRealtimeChannel = {
  on: jest.fn(),
  subscribe: jest.fn()
};
mockRealtimeChannel.on.mockReturnValue(mockRealtimeChannel);
mockRealtimeChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
  mockRealtimeStatus = callback;
  return mockRealtimeChannel;
});

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: jest.fn(() => mockRealtimeChannel),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args)
  }
}));
jest.mock('@/lib/supabaseOnly', () => ({
  assertSupabaseConfigured: () => mockAssertConfigured()
}));
jest.mock('@/services/profileMapper', () => ({
  mapProfileRow: (row: { id: string }) => ({
    id: row.id,
    username: row.id,
    displayName: row.id,
    initials: row.id.slice(0, 2),
    bio: '',
    city: '',
    country: '',
    primarySport: 'Football',
    sports: ['Football'],
    skillLevel: 'Beginner',
    isOnline: false,
    badges: [],
    stats: { followers: 0, following: 0, posts: 0, winRate: 0, games: 0 }
  })
}));

const sender = {
  id: 'sender',
  username: 'sender',
  displayName: 'Sender',
  initials: 'SE',
  bio: '',
  city: '',
  country: '',
  primarySport: 'Football',
  sports: ['Football'],
  skillLevel: 'Beginner',
  isOnline: false,
  badges: [],
  stats: { followers: 0, following: 0, posts: 0, winRate: 0, games: 0 }
} as UserProfile;

const message = (index: number, status: EventMessage['deliveryStatus'] = 'sent'): EventMessage => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  eventId: 'event-1',
  sender,
  body: `message ${index}`,
  createdAt: new Date(Date.UTC(2026, 6, 30, 12, 0, index)).toISOString(),
  deliveryStatus: status
});

function queryReturning(data: unknown[]) {
  const query: Record<string, jest.Mock> & PromiseLike<unknown> = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    or: jest.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve)
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.or.mockReturnValue(query);
  mockFrom.mockReturnValue(query);
  return query;
}

describe('event chat pagination and reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRealtimeStatus = undefined;
    mockRealtimeChannel.on.mockReturnValue(mockRealtimeChannel);
    mockRealtimeChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      mockRealtimeStatus = callback;
      return mockRealtimeChannel;
    });
  });

  it('loads the latest page and returns a stable cursor for older messages', async () => {
    const rows = Array.from({ length: EVENT_MESSAGE_PAGE_SIZE + 1 }, (_, index) => ({
      id: message(100 - index).id,
      event_id: 'event-1',
      sender_id: sender.id,
      body: `message ${100 - index}`,
      created_at: message(100 - index).createdAt,
      profiles: { id: sender.id }
    }));
    const query = queryReturning(rows);

    const page = await eventService.listEventMessages('event-1');

    expect(page.messages).toHaveLength(EVENT_MESSAGE_PAGE_SIZE);
    expect(page.messages[0].body).toBe('message 100');
    expect(page.nextCursor).toEqual({
      createdAt: rows[EVENT_MESSAGE_PAGE_SIZE - 1].created_at,
      id: rows[EVENT_MESSAGE_PAGE_SIZE - 1].id
    });
    expect(query.order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: false });
    expect(query.order).toHaveBeenNthCalledWith(2, 'id', { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(EVENT_MESSAGE_PAGE_SIZE + 1);
  });

  it('uses both timestamp and id in the older-page cursor', async () => {
    const query = queryReturning([]);
    const cursor = { createdAt: '2026-07-30T12:00:00.000Z', id: message(50).id };

    await eventService.listEventMessages('event-1', cursor);

    expect(query.or).toHaveBeenCalledWith(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    );
  });

  it('keeps more than 100 messages while deduplicating overlapping pages', () => {
    const all = Array.from({ length: 125 }, (_, index) => message(index));
    const latest = all.slice(75);
    const middleWithOverlap = all.slice(25, 80);
    const oldestWithOverlap = all.slice(0, 30);

    const merged = mergeEventMessages(
      mergeEventMessages(latest, middleWithOverlap),
      oldestWithOverlap
    );

    expect(merged).toHaveLength(125);
    expect(new Set(merged.map((item) => item.id)).size).toBe(125);
  });

  it('reconciles concurrent optimistic, mutation, reconnect, and duplicate realtime copies', () => {
    const first = message(201, 'sending');
    const second = message(202, 'sending');
    const mutationResponse = { ...first, deliveryStatus: 'sent' as const };
    const duplicateRealtime = { ...first, deliveryStatus: 'sent' as const };
    const reconnectPage = [{ ...second, deliveryStatus: 'sent' as const }, duplicateRealtime];

    const merged = mergeEventMessages(
      mergeEventMessages([first, second], mutationResponse),
      [duplicateRealtime, ...reconnectPage]
    );

    expect(merged).toHaveLength(2);
    expect(merged.every((item) => item.deliveryStatus === 'sent')).toBe(true);
  });

  it('identifies reconnects so missed rows can be reconciled', () => {
    const connectionChange = jest.fn();
    const subscription = eventService.subscribeToEventMessages(
      'event-1',
      jest.fn(),
      connectionChange
    );

    mockRealtimeStatus?.('SUBSCRIBED');
    mockRealtimeStatus?.('CHANNEL_ERROR');
    mockRealtimeStatus?.('SUBSCRIBED');

    expect(connectionChange.mock.calls).toEqual([
      [true, false],
      [false, false],
      [true, true]
    ]);
    subscription.unsubscribe();
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockRealtimeChannel);
  });

  it('lists event chat threads and marks a thread as read', async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: [{
          event_id: 'event-1',
          title: 'Sunday Football',
          sport: 'Football',
          cover_url: null,
          last_message: 'See you there',
          last_message_at: '2026-07-30T12:00:00.000Z',
          unread_count: 2
        }],
        error: null
      })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(eventService.listEventMessageThreads()).resolves.toEqual([{
      eventId: 'event-1',
      title: 'Sunday Football',
      sport: 'Football',
      coverUrl: null,
      lastMessage: 'See you there',
      lastMessageAt: '2026-07-30T12:00:00.000Z',
      unreadCount: 2
    }]);
    await expect(eventService.markEventChatRead('event-1')).resolves.toBeUndefined();

    expect(mockRpc).toHaveBeenNthCalledWith(1, 'list_my_event_message_threads');
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'mark_event_chat_read', { target_event_id: 'event-1' });
  });
});
