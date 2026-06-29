import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export const pushNotificationsEnabledKey = 'sportz.push.enabled';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export async function registerForPushNotificationsAsync() {
  const enabled = await AsyncStorage.getItem(pushNotificationsEnabledKey);
  if (enabled === 'false') return null;

  if (!Device.isDevice) {
    return null;
  }

  const existingPermission = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermission.status;

  if (existingPermission.status !== 'granted') {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermission.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF5A1F'
    });
  }

  const { data: authData } = await supabase.auth.getUser();
  if (authData.user) {
    await supabase.from('push_tokens').upsert(
      {
        user_id: authData.user.id,
        token: token.data,
        platform: Platform.OS,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'token' }
    );
  }

  return token.data;
}
