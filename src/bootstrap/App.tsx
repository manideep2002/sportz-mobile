import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar, StyleSheet, View } from 'react-native';
import {
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  BarlowCondensed_900Black,
  useFonts as useBarlowFonts
} from '@expo-google-fonts/barlow-condensed';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
  useFonts as useDMSansFonts
} from '@expo-google-fonts/dm-sans';

import { AppProviders } from './AppProviders';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePresence } from '@/hooks/usePresence';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuthStore } from '@/store/authStore';
import { AppText } from '@/components/ui';
import { colors } from '@/design/tokens';

void SplashScreen.preventAutoHideAsync();

function AppContent() {
  usePushNotifications();
  usePresence();
  const { isOffline } = useNetworkStatus();
  return (
    <View style={styles.appShell}>
      {isOffline ? (
        <View style={styles.offlineBanner}>
          <AppText style={styles.offlineText}>You&apos;re offline. Some content may be outdated.</AppText>
        </View>
      ) : null}
      <RootNavigator />
    </View>
  );
}

function LoadingSplash() {
  return (
    <View style={styles.loadingContainer}>
      <AppText variant="hero">
        SPORTZ<AppText variant="hero" color={colors.orange[500]}>.</AppText>
      </AppText>
    </View>
  );
}

export default function App() {
  useAuthBootstrap();
  const bootstrapped = useAuthStore((state) => state.bootstrapped);
  const [barlowLoaded] = useBarlowFonts({
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
    BarlowCondensed_900Black
  });
  const [dmSansLoaded] = useDMSansFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold
  });
  const ready = barlowLoaded && dmSansLoaded && bootstrapped;

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return <LoadingSplash />;
  }

  return (
    <AppProviders>
      <StatusBar barStyle="light-content" />
      <AppContent />
    </AppProviders>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.dark[950],
    alignItems: 'center',
    justifyContent: 'center'
  },
  offlineBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: colors.orange[500],
    paddingTop: 4,
    paddingBottom: 6,
    alignItems: 'center'
  },
  offlineText: {
    color: colors.light[0],
    fontSize: 12,
    fontWeight: '700'
  }
});
