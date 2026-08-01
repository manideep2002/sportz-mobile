import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { MutationCache, QueryClient, onlineManager, type Query } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { captureUnexpectedError } from '@/lib/monitoring';

onlineManager.setEventListener((setOnline) => {
  // Fetch the initial network state so React Query doesn't start in an
  // "offline" limbo while NetInfo is still wiring up its listeners.
  void NetInfo.fetch().then((state) => setOnline(Boolean(state.isConnected)));

  return NetInfo.addEventListener((state) => {
    setOnline(Boolean(state.isConnected));
  });
});

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      captureUnexpectedError(error, {
        operation: 'query.mutation',
        extra: {
          mutationKey: mutation.options.mutationKey
        }
      });
    }
  }),
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
      staleTime: 1000 * 30,
      // Always attempt to fetch regardless of the online manager's initial
      // state – avoids queries being paused before NetInfo has resolved.
      networkMode: 'always',
      retry: 2
    },
    mutations: {
      networkMode: 'always',
      retry: 1
    }
  }
});

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.action.type === 'error') {
    captureUnexpectedError(event.action.error, {
      operation: 'query.fetch',
      extra: {
        queryKey: event.query.queryKey
      }
    });
  }
});

const LEGACY_QUERY_CACHE_KEY = 'SPORTZ_QUERY_CACHE';
const PUBLIC_QUERY_CACHE_KEY = 'SPORTZ_PUBLIC_QUERY_CACHE_V2';

/** Only public, non-account-specific data may survive an app restart. */
export const shouldPersistQuery = (query: Query): boolean => {
  if (query.meta?.persist === false) return false;
  const [scope, resource] = query.queryKey;
  return scope === 'search' && resource === 'trending-tags';
};

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PUBLIC_QUERY_CACHE_KEY,
  throttleTime: 1000
});

/** Removes the pre-IG-11 broad cache before it can be restored again. */
export const clearLegacyPersistedQueryCache = () => AsyncStorage.removeItem(LEGACY_QUERY_CACHE_KEY);
