const mockCancelQueries = jest.fn();
const mockClearQueries = jest.fn();
const mockRemoveClient = jest.fn();
const mockClearHotCache = jest.fn();
const mockClearSeenState = jest.fn();
const mockResetMessaging = jest.fn();
const mockResetUi = jest.fn();

jest.mock('@/lib/queryClient', () => ({
  queryClient: {
    cancelQueries: () => mockCancelQueries(),
    clear: () => mockClearQueries()
  },
  asyncStoragePersister: { removeClient: () => mockRemoveClient() }
}));
jest.mock('@/services/hotCacheService', () => ({
  hotCacheService: { clearAll: () => mockClearHotCache() }
}));
jest.mock('@/services/storyService', () => ({
  storyService: { clearSeenState: () => mockClearSeenState() }
}));
jest.mock('@/store/messagingStore', () => ({
  useMessagingStore: { getState: () => ({ resetForSession: () => mockResetMessaging() }) }
}));
jest.mock('@/store/uiStore', () => ({
  useUiStore: { getState: () => ({ resetForSession: () => mockResetUi() }) }
}));

// eslint-disable-next-line import/first
import { sessionDataService } from '@/services/sessionDataService';

describe('sessionDataService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCancelQueries.mockResolvedValue(undefined);
    mockRemoveClient.mockResolvedValue(undefined);
    mockClearHotCache.mockResolvedValue(undefined);
    mockClearSeenState.mockResolvedValue(undefined);
  });

  it('clears persisted, cached, and in-memory user data', async () => {
    await sessionDataService.clearUserScopedData();

    expect(mockCancelQueries).toHaveBeenCalledTimes(1);
    expect(mockClearQueries).toHaveBeenCalledTimes(1);
    expect(mockResetMessaging).toHaveBeenCalledTimes(1);
    expect(mockResetUi).toHaveBeenCalledTimes(1);
    expect(mockRemoveClient).toHaveBeenCalledTimes(1);
    expect(mockClearHotCache).toHaveBeenCalledTimes(1);
    expect(mockClearSeenState).toHaveBeenCalledTimes(1);
  });
});
