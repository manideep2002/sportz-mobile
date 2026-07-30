import type { PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockRpc = jest.fn();
const mockGetUser = jest.fn();

jest.mock('@/lib/supabaseOnly', () => ({ assertSupabaseConfigured: jest.fn() }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) }
  }
}));
jest.mock('@/lib/monitoring', () => ({ captureUnexpectedError: jest.fn() }));

// eslint-disable-next-line import/first
import { eventService } from '@/services/eventService';
// eslint-disable-next-line import/first
import { eventKeys, useJoinEvent, useLeaveEvent, useLeaveEventWaitlist, useRsvpEvent } from '@/hooks/useEvents';

const mockUserId = 'user-1';
const mockEventId = 'event-1';

// ── Service layer ──────────────────────────────────────────────────────

describe('eventService.rsvpEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
    mockRpc.mockResolvedValue({ data: undefined, error: null });
  });

  it('calls set_sport_event_rsvp RPC with "interested" status', async () => {
    await eventService.rsvpEvent(mockEventId, 'interested');
    expect(mockRpc).toHaveBeenCalledWith('set_sport_event_rsvp', {
      target_event_id: mockEventId,
      target_status: 'interested'
    });
  });

  it('calls set_sport_event_rsvp RPC with "declined" status', async () => {
    await eventService.rsvpEvent(mockEventId, 'declined');
    expect(mockRpc).toHaveBeenCalledWith('set_sport_event_rsvp', {
      target_event_id: mockEventId,
      target_status: 'declined'
    });
  });

  it('throws when the RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: undefined, error: new Error('Server error') });
    await expect(eventService.rsvpEvent(mockEventId, 'interested')).rejects.toThrow('Server error');
  });

  it('throws when no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(eventService.rsvpEvent(mockEventId, 'interested')).rejects.toThrow('You must be signed in to RSVP.');
  });
});

// ── Hook layer ─────────────────────────────────────────────────────────

interface WrapperProps {
  queryClient: QueryClient;
  children: React.ReactNode;
}

function TestWrapper({ queryClient, children }: WrapperProps) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useRsvpEvent', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
    mockRpc.mockResolvedValue({ data: undefined, error: null });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('optimistically writes participation status', async () => {
    queryClient.setQueryData(eventKeys.participation(mockEventId), 'none');
    queryClient.setQueryData(eventKeys.participationBatch([mockEventId]), { [mockEventId]: 'none' });

    const { result } = await renderHook(() => useRsvpEvent(), {
      wrapper: ({ children }) => <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    });

    await act(async () => {
      await result.current.mutateAsync({ eventId: mockEventId, status: 'interested' });
    });

    expect(queryClient.getQueryData(eventKeys.participation(mockEventId))).toBe('interested');
    const batch = queryClient.getQueryData(eventKeys.participationBatch([mockEventId]));
    expect(batch?.[mockEventId]).toBe('interested');
  });

  it('rolls back participation on failure', async () => {
    mockRpc.mockResolvedValue({ data: undefined, error: new Error('Server error') });
    queryClient.setQueryData(eventKeys.participation(mockEventId), 'none');

    const { result } = await renderHook(() => useRsvpEvent(), {
      wrapper: ({ children }) => <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    });

    await act(async () => {
      await expect(result.current.mutateAsync({ eventId: mockEventId, status: 'interested' })).rejects.toThrow();
    });

    expect(queryClient.getQueryData(eventKeys.participation(mockEventId))).toBe('none');
  });
});

describe('useJoinEvent', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
    mockRpc.mockResolvedValue({ data: 'going', error: null });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('optimistically writes "going" participation', async () => {
    queryClient.setQueryData(eventKeys.participation(mockEventId), 'none');

    const { result } = await renderHook(() => useJoinEvent(), {
      wrapper: ({ children }) => <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    });

    await act(async () => {
      await result.current.mutateAsync(mockEventId);
    });

    expect(queryClient.getQueryData(eventKeys.participation(mockEventId))).toBe('going');
  });

  it('rolls back participation on join failure', async () => {
    mockRpc.mockResolvedValue({ data: undefined, error: new Error('Join failed') });
    queryClient.setQueryData(eventKeys.participation(mockEventId), 'none');

    const { result } = await renderHook(() => useJoinEvent(), {
      wrapper: ({ children }) => <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    });

    await act(async () => {
      await expect(result.current.mutateAsync(mockEventId)).rejects.toThrow('Join failed');
    });

    expect(queryClient.getQueryData(eventKeys.participation(mockEventId))).toBe('none');
  });
});

describe('useLeaveEvent', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
    mockRpc.mockResolvedValue({ data: undefined, error: null });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('optimistically writes "none" participation', async () => {
    queryClient.setQueryData(eventKeys.participation(mockEventId), 'going');

    const { result } = await renderHook(() => useLeaveEvent(), {
      wrapper: ({ children }) => <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    });

    await act(async () => {
      await result.current.mutateAsync(mockEventId);
    });

    expect(queryClient.getQueryData(eventKeys.participation(mockEventId))).toBe('none');
  });

  it('rolls back participation on leave failure', async () => {
    mockRpc.mockResolvedValue({ data: undefined, error: new Error('Leave failed') });
    queryClient.setQueryData(eventKeys.participation(mockEventId), 'going');

    const { result } = await renderHook(() => useLeaveEvent(), {
      wrapper: ({ children }) => <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    });

    await act(async () => {
      await expect(result.current.mutateAsync(mockEventId)).rejects.toThrow('Leave failed');
    });

    expect(queryClient.getQueryData(eventKeys.participation(mockEventId))).toBe('going');
  });
});

describe('useLeaveEventWaitlist', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
    mockRpc.mockResolvedValue({ data: undefined, error: null });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('optimistically writes "none" participation on waitlist leave', async () => {
    queryClient.setQueryData(eventKeys.participation(mockEventId), 'waitlisted');

    const { result } = await renderHook(() => useLeaveEventWaitlist(), {
      wrapper: ({ children }) => <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    });

    await act(async () => {
      await result.current.mutateAsync(mockEventId);
    });

    expect(queryClient.getQueryData(eventKeys.participation(mockEventId))).toBe('none');
  });

  it('rolls back participation on waitlist leave failure', async () => {
    mockRpc.mockResolvedValue({ data: undefined, error: new Error('Leave waitlist failed') });
    queryClient.setQueryData(eventKeys.participation(mockEventId), 'waitlisted');

    const { result } = await renderHook(() => useLeaveEventWaitlist(), {
      wrapper: ({ children }) => <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    });

    await act(async () => {
      await expect(result.current.mutateAsync(mockEventId)).rejects.toThrow('Leave waitlist failed');
    });

    expect(queryClient.getQueryData(eventKeys.participation(mockEventId))).toBe('waitlisted');
  });
});
