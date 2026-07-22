import { asyncStoragePersister, queryClient } from '@/lib/queryClient';
import { hotCacheService } from '@/services/hotCacheService';
import { storyService } from '@/services/storyService';
import { useMessagingStore } from '@/store/messagingStore';
import { useUiStore } from '@/store/uiStore';

/** Clears data that must never survive an account change on the same device. */
export const sessionDataService = {
  async clearUserScopedData(): Promise<void> {
    await queryClient.cancelQueries();
    queryClient.clear();

    useMessagingStore.getState().resetForSession();
    useUiStore.getState().resetForSession();

    await Promise.allSettled([
      asyncStoragePersister.removeClient(),
      hotCacheService.clearAll(),
      storyService.clearSeenState()
    ]);
  }
};
