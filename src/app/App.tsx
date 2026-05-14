import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
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
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuthStore } from '@/store/authStore';

void SplashScreen.preventAutoHideAsync();

function AppContent() {
  usePushNotifications();
  return <RootNavigator />;
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
    return null;
  }

  return (
    <AppProviders>
      <StatusBar style="light" />
      <AppContent />
    </AppProviders>
  );
}
