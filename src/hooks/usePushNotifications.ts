import { useEffect } from 'react';

import { registerForPushNotificationsAsync } from '@/lib/notifications';

export const usePushNotifications = () => {
  useEffect(() => {
    void registerForPushNotificationsAsync();
  }, []);
};
