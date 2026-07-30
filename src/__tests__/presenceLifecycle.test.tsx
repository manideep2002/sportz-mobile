import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { usePresence } from '@/hooks/usePresence';
import { useUiStore } from '@/store/uiStore';

let mockStatusCallback: ((status: string) => void) | undefined;
let mockPresenceSync: (() => void) | undefined;
let mockAppStateChange: ((state: AppStateStatus) => void) | undefined;
let mockPresenceState: Record<string, Record<string, unknown>[]> = {};
const mockTrack = jest.fn().mockResolvedValue('ok');
const mockUntrack = jest.fn().mockResolvedValue('ok');
const mockRemoveChannel = jest.fn().mockResolvedValue(undefined);
const mockEq = jest.fn().mockResolvedValue({ error: null });
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockChannel = {
  on: jest.fn((_type: string, _filter: unknown, callback: () => void) => {
    mockPresenceSync = callback;
    return mockChannel;
  }),
  subscribe: jest.fn((callback: (status: string) => void) => {
    mockStatusCallback = callback;
    return mockChannel;
  }),
  presenceState: jest.fn(() => mockPresenceState),
  track: mockTrack,
  untrack: mockUntrack
};

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => mockChannel),
    from: jest.fn(() => ({ update: mockUpdate })),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args)
  }
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ user: { id: 'me' } })
}));

describe('global presence lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatusCallback = undefined;
    mockPresenceSync = undefined;
    mockAppStateChange = undefined;
    mockPresenceState = {};
    useUiStore.getState().setOnlineUserIds([]);
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active'
    });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      mockAppStateChange = listener;
      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('clears verified online IDs when realtime disconnects', async () => {
    const { unmount } = await renderHook(() => usePresence());

    await act(async () => {
      await (mockStatusCallback as ((status: string) => Promise<void>) | undefined)?.('SUBSCRIBED');
    });
    mockPresenceState = { peer: [{ user_id: 'peer' }] };
    await act(async () => {
      mockPresenceSync?.();
    });
    expect(useUiStore.getState().onlineUserIds.has('peer')).toBe(true);

    await act(async () => {
      mockStatusCallback?.('CHANNEL_ERROR');
    });
    expect(useUiStore.getState().onlineUserIds.size).toBe(0);
    unmount();
  });

  it('untracks and clears presence when the app backgrounds', async () => {
    const { unmount } = await renderHook(() => usePresence());
    await waitFor(() => expect(mockAppStateChange).toBeDefined());
    mockPresenceState = { peer: [{ user_id: 'peer' }] };
    await act(async () => {
      mockPresenceSync?.();
    });

    await act(async () => {
      mockAppStateChange?.('background');
    });

    expect(mockUntrack).toHaveBeenCalled();
    expect(useUiStore.getState().onlineUserIds.size).toBe(0);
    unmount();
  });
});
