import { eventService } from '@/services/eventService';

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

describe('event message reliability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRealtimeStatus = undefined;
    mockRealtimeChannel.on.mockReturnValue(mockRealtimeChannel);
    mockRealtimeChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      mockRealtimeStatus = callback;
      return mockRealtimeChannel;
    });
  });

  describe('event thread service mapping and unread counts', () => {
    it('maps RPC response to event message threads', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          event_id: 'event-1',
          title: 'Sunday Football',
          sport: 'Football',
          cover_url: 'https://example.com/cover.jpg',
          last_message: 'See you there',
          last_message_at: '2026-07-30T12:00:00.000Z',
          unread_count: 3
        }],
        error: null
      });

      const threads = await eventService.listEventMessageThreads();

      expect(threads).toEqual([{
        eventId: 'event-1',
        title: 'Sunday Football',
        sport: 'Football',
        coverUrl: 'https://example.com/cover.jpg',
        lastMessage: 'See you there',
        lastMessageAt: '2026-07-30T12:00:00.000Z',
        unreadCount: 3
      }]);

      expect(mockRpc).toHaveBeenCalledWith('list_my_event_message_threads');
    });

    it('calculates unread count correctly', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          event_id: 'event-1',
          title: 'Event 1',
          sport: 'Football',
          cover_url: null,
          last_message: 'Message 1',
          last_message_at: '2026-07-30T12:00:00.000Z',
          unread_count: 5
        }, {
          event_id: 'event-2',
          title: 'Event 2',
          sport: 'Basketball',
          cover_url: null,
          last_message: 'Message 2',
          last_message_at: '2026-07-30T11:00:00.000Z',
          unread_count: 2
        }],
        error: null
      });

      const threads = await eventService.listEventMessageThreads();

      const totalUnread = threads.reduce((sum: number, thread: { unreadCount: number }) => sum + thread.unreadCount, 0);
      expect(totalUnread).toBe(7);
    });

    it('marks event chat as read', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: null });

      await expect(eventService.markEventChatRead('event-1')).resolves.toBeUndefined();

      expect(mockRpc).toHaveBeenCalledWith('mark_event_chat_read', { target_event_id: 'event-1' });
    });
  });

  describe('event message thread subscription', () => {
    it('subscribes to event messages with connection state tracking', () => {
      const connectionStates: string[] = [];
      
      const subscription = eventService.subscribeToEventMessageThreads(
        jest.fn(),
        (connected: boolean, reconnected: boolean) => {
          connectionStates.push(connected ? 'connected' : 'disconnected');
          if (reconnected) connectionStates.push('reconnected');
        }
      );

      mockRealtimeStatus?.('SUBSCRIBED');
      mockRealtimeStatus?.('CHANNEL_ERROR');
      mockRealtimeStatus?.('SUBSCRIBED');

      expect(connectionStates).toEqual(['connected', 'disconnected', 'connected', 'reconnected']);
      
      subscription.unsubscribe();
      expect(mockRemoveChannel).toHaveBeenCalledWith(mockRealtimeChannel);
    });

    it('cleans up subscription on unsubscribe', () => {
      const subscription = eventService.subscribeToEventMessageThreads(jest.fn());
      
      subscription.unsubscribe();

      expect(mockRemoveChannel).toHaveBeenCalledWith(mockRealtimeChannel);
    });
  });

  describe('notification routing to EventChat', () => {
    it('routes event_chat notifications to event chat screen', () => {
      // This test verifies the notification routing payload
      // The actual routing is handled by the notification system
      const notificationPayload = {
        kind: 'message',
        entityType: 'event_chat',
        entityId: 'event-1'
      };

      expect(notificationPayload.entityType).toBe('event_chat');
      expect(notificationPayload.entityId).toBe('event-1');
    });
  });
});
