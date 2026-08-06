import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
  addEventListener: jest.fn(() => jest.fn())
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn()
    })),
    removeChannel: jest.fn()
  }
}));

jest.mock('@/lib/supabaseOnly', () => ({
  assertSupabaseConfigured: jest.fn()
}));

// eslint-disable-next-line import/first
import { useRealtimeMessages, messageKeys } from '@/hooks/useMessages';
// eslint-disable-next-line import/first
import { messageService } from '@/services/messageService';
// eslint-disable-next-line import/first
import { useAuthStore } from '@/store/authStore';

describe('realtimeMessages', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    useAuthStore.setState({
      user: {
        id: 'user-1',
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString()
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('subscribes to realtime message events when user is logged in', async () => {
    const mockUnsubscribe = jest.fn();
    const subscribeSpy = jest.spyOn(messageService, 'subscribeToRealtimeMessages').mockReturnValue({
      unsubscribe: mockUnsubscribe
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { unmount } = await renderHook(() => useRealtimeMessages(), { wrapper });

    expect(subscribeSpy).toHaveBeenCalledWith('user-1', expect.any(Function));

    await unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('triggers query invalidation and preview cache update on realtime message change', async () => {
    let messageCallback: (payload: { roomId?: string; body?: string; createdAt?: string; senderId?: string }) => void = () => {};

    jest.spyOn(messageService, 'subscribeToRealtimeMessages').mockImplementation((_userId, callback) => {
      messageCallback = callback;
      return { unsubscribe: jest.fn() };
    });

    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const setQueryDataSpy = jest.spyOn(queryClient, 'setQueryData');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    await renderHook(() => useRealtimeMessages(), { wrapper });

    await act(async () => {
      messageCallback({
        roomId: 'room-123',
        body: 'New live message!',
        createdAt: '2026-08-06T22:50:00.000Z',
        senderId: 'user-2'
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: messageKeys.messages('room-123') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: messageKeys.conversations });
    expect(setQueryDataSpy).toHaveBeenCalledWith(messageKeys.conversations, expect.any(Function));
  });

  it('does not subscribe when user is not authenticated', async () => {
    useAuthStore.setState({ user: null });

    const subscribeSpy = jest.spyOn(messageService, 'subscribeToRealtimeMessages');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    await renderHook(() => useRealtimeMessages(), { wrapper });

    expect(subscribeSpy).not.toHaveBeenCalled();
  });
});
