/**
 * usePlayerSearch tests — QG-03
 *
 * Fake timers drive the debounce deterministically; deferred promises create
 * deliberately out-of-order responses to prove a slower older response never
 * replaces a newer query.
 */

import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

import type { Sport, UserProfile } from '@/types/domain';

const mockListPlayers = jest.fn();

jest.mock('@/services/profileService', () => ({
  profileService: { listPlayers: (...args: unknown[]) => mockListPlayers(...args) }
}));

// eslint-disable-next-line import/first
import { PLAYER_SEARCH_DEBOUNCE_MS, usePlayerSearch } from '@/hooks/usePlayerSearch';

const makePlayer = (id: string): UserProfile => ({
  id,
  displayName: id.toUpperCase(),
  username: id,
  initials: id.slice(0, 2).toUpperCase(),
  avatarUrl: null,
  bio: '',
  city: '',
  country: '',
  primarySport: 'Basketball',
  sports: ['Basketball'],
  skillLevel: 'Intermediate',
  isOnline: false,
  badges: [],
  stats: { followers: 0, following: 0, posts: 0, winRate: 0, games: 0 }
});

let queryClient: QueryClient;

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  });
  mockListPlayers.mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
  queryClient.clear();
});

// React Query delivers query state updates through a setTimeout(0)-scheduled
// notifier, so with fake timers a flush must yield microtasks AND run pending
// timers (possibly chained) to land the final state.
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    await Promise.resolve();
    jest.runOnlyPendingTimers();
  });
};

describe('usePlayerSearch', () => {
  it('debounces keystrokes and never fires below the minimum query length', async () => {
    const { result } = await renderHook(() => usePlayerSearch(), { wrapper });
    expect(mockListPlayers).not.toHaveBeenCalled();

    await act(() => result.current.setQuery('a'));
    await act(() => jest.advanceTimersByTime(PLAYER_SEARCH_DEBOUNCE_MS - 1));
    expect(mockListPlayers).not.toHaveBeenCalled();

    await act(() => jest.advanceTimersByTime(1));
    expect(mockListPlayers).toHaveBeenCalledTimes(1);
    expect(mockListPlayers).toHaveBeenCalledWith('a', undefined, 0, undefined, expect.any(AbortSignal));

    await flush();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.results).toEqual([]);
  });

  it('never lets a slower older response replace a newer query', async () => {
    const deferred: Array<(value: UserProfile[]) => void> = [];
    mockListPlayers.mockImplementation((q: string) => new Promise<UserProfile[]>((resolve) => {
      deferred.push(resolve);
      return;
    }));

    const { result } = await renderHook(() => usePlayerSearch(), { wrapper });

    await act(() => result.current.setQuery('ali'));
    await act(() => jest.advanceTimersByTime(PLAYER_SEARCH_DEBOUNCE_MS));
    expect(mockListPlayers).toHaveBeenLastCalledWith('ali', undefined, 0, undefined, expect.any(AbortSignal));

    await act(() => result.current.setQuery('alice'));
    await act(() => jest.advanceTimersByTime(PLAYER_SEARCH_DEBOUNCE_MS));
    expect(mockListPlayers).toHaveBeenLastCalledWith('alice', undefined, 0, undefined, expect.any(AbortSignal));

    // The newer request resolves first.
    await act(async () => deferred[1]([makePlayer('alice-1')]));
    await flush();
    expect(result.current.results.map((player) => player.id)).toEqual(['alice-1']);

    // The older request resolves late — it must not replace the newer results.
    await act(async () => deferred[0]([makePlayer('ali-1')]));
    await flush();
    expect(result.current.results.map((player) => player.id)).toEqual(['alice-1']);
    expect(result.current.isLoading).toBe(false);
  });

  it('clears results immediately when the query drops below the minimum, with no request', async () => {
    mockListPlayers.mockResolvedValue([makePlayer('p-1')]);
    const { result } = await renderHook(() => usePlayerSearch(), { wrapper });

    await act(() => result.current.setQuery('pre'));
    await act(() => jest.advanceTimersByTime(PLAYER_SEARCH_DEBOUNCE_MS));
    await flush();
    expect(result.current.results.map((player) => player.id)).toEqual(['p-1']);

    const calls = mockListPlayers.mock.calls.length;
    await act(() => result.current.setQuery(''));
    await flush();
    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(mockListPlayers.mock.calls.length).toBe(calls);
  });

  it('respects a custom minimum query length', async () => {
    const { result } = await renderHook(() => usePlayerSearch({ minQueryLength: 2 }), { wrapper });

    await act(() => result.current.setQuery('a'));
    await act(() => jest.advanceTimersByTime(PLAYER_SEARCH_DEBOUNCE_MS + 100));
    expect(mockListPlayers).not.toHaveBeenCalled();

    await act(() => result.current.setQuery('ab'));
    await act(() => jest.advanceTimersByTime(PLAYER_SEARCH_DEBOUNCE_MS));
    expect(mockListPlayers).toHaveBeenCalledTimes(1);
    expect(mockListPlayers).toHaveBeenCalledWith('ab', undefined, 0, undefined, expect.any(AbortSignal));
  });

  it('searches immediately with an empty query when minQueryLength is 0 (browse mode)', async () => {
    await renderHook(() => usePlayerSearch({ minQueryLength: 0 }), { wrapper });
    expect(mockListPlayers).toHaveBeenCalledTimes(1);
    expect(mockListPlayers).toHaveBeenCalledWith('', undefined, 0, undefined, expect.any(AbortSignal));
  });

  it('surfaces errors and recovers via retry', async () => {
    mockListPlayers
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce([makePlayer('ok-1')]);
    const { result } = await renderHook(() => usePlayerSearch(), { wrapper });

    await act(() => result.current.setQuery('ok'));
    await act(() => jest.advanceTimersByTime(PLAYER_SEARCH_DEBOUNCE_MS));
    await flush();
    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toBe('network down');
    expect(result.current.results).toEqual([]);

    await act(async () => {
      await result.current.retry();
    });
    await flush();
    expect(result.current.isError).toBe(false);
    expect(result.current.results.map((player) => player.id)).toEqual(['ok-1']);
  });

  it('filters excluded ids from results without refetching', async () => {
    mockListPlayers.mockResolvedValue([makePlayer('p-1'), makePlayer('p-2')]);
    const { result, rerender } = await renderHook(
      (props: { excludeIds?: ReadonlySet<string> | null }) =>
        usePlayerSearch({ excludeIds: props?.excludeIds }),
      { wrapper, initialProps: { excludeIds: null } }
    );

    await act(() => result.current.setQuery('x'));
    await act(() => jest.advanceTimersByTime(PLAYER_SEARCH_DEBOUNCE_MS));
    await flush();
    expect(result.current.results.map((player) => player.id)).toEqual(['p-1', 'p-2']);

    const calls = mockListPlayers.mock.calls.length;
    await rerender({ excludeIds: new Set(['p-1']) });
    expect(result.current.results.map((player) => player.id)).toEqual(['p-2']);
    expect(mockListPlayers.mock.calls.length).toBe(calls);
  });

  it('refetches with the sport filter when it changes', async () => {
    mockListPlayers.mockResolvedValue([makePlayer('p-1')]);
    const { result, rerender } = await renderHook(
      (props: { sports?: Sport[] }) => usePlayerSearch({ sports: props?.sports }),
      { wrapper, initialProps: { sports: undefined } }
    );

    await act(() => result.current.setQuery('vin'));
    await act(() => jest.advanceTimersByTime(PLAYER_SEARCH_DEBOUNCE_MS));
    await flush();
    expect(mockListPlayers).toHaveBeenLastCalledWith('vin', undefined, 0, undefined, expect.any(AbortSignal));

    await rerender({ sports: ['Basketball'] });
    expect(mockListPlayers).toHaveBeenLastCalledWith('vin', ['Basketball'], 0, undefined, expect.any(AbortSignal));
  });

  it('accumulates pages and reports hasMore from the page size', async () => {
    mockListPlayers.mockImplementation(
      (_q: string, _s: string | undefined, page: number) =>
        Promise.resolve(page === 0 ? [makePlayer('p-1'), makePlayer('p-2')] : [makePlayer('p-3')])
    );
    const { result } = await renderHook(() => usePlayerSearch({ pageSize: 2 }), { wrapper });

    await act(() => result.current.setQuery('x'));
    await act(() => jest.advanceTimersByTime(PLAYER_SEARCH_DEBOUNCE_MS));
    await flush();
    expect(result.current.results.map((player) => player.id)).toEqual(['p-1', 'p-2']);
    expect(result.current.hasMore).toBe(true);

    await act(() => result.current.loadMore());
    await flush();
    expect(result.current.results.map((player) => player.id)).toEqual(['p-1', 'p-2', 'p-3']);
    expect(result.current.hasMore).toBe(false);
  });
});
