import { useEffect, type PropsWithChildren } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import {
  asyncStoragePersister,
  clearLegacyPersistedQueryCache,
  queryClient,
  shouldPersistQuery
} from '@/lib/queryClient';
import { ThemeProvider } from '@/design/ThemeProvider';
import { I18nProvider } from '@/i18n';
import { hotCacheService } from '@/services/hotCacheService';

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    // V1 restored all query data. It is intentionally never rehydrated under
    // the V2 key and is removed as soon as the application starts.
    void Promise.all([
      clearLegacyPersistedQueryCache(),
      hotCacheService.clearLegacyPersistedCache()
    ]);
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: asyncStoragePersister,
            maxAge: 1000 * 60 * 60 * 24,
            dehydrateOptions: {
              shouldDehydrateQuery: shouldPersistQuery,
              shouldDehydrateMutation: () => false
            }
          }}
        >
          <ThemeProvider>
            <I18nProvider>{children}</I18nProvider>
          </ThemeProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  }
});
