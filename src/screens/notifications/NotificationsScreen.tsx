import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { NotificationRow } from '@/components/notifications/NotificationRow';
import { AppText, Button, IconButton, Screen, SegmentedControl } from '@/components/ui';
import { spacing } from '@/design/tokens';
import { useMarkNotificationsRead, useNotifications } from '@/hooks/useNotifications';
import type { AppStackParamList } from '@/navigation/routes';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function NotificationsScreen() {
  const navigation = useNavigation<Navigation>();
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationsRead();

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Activity</AppText>
        <Button variant="dark" size="sm" loading={markRead.isPending} onPress={() => markRead.mutate()}>
          Mark all read
        </Button>
      </View>
      <SegmentedControl value="All" options={['All', 'Mentions', 'Events']} onChange={() => undefined} />
      <AppText variant="caption">New</AppText>
      {notifications.map((notification) => (
        <NotificationRow
          key={notification.id}
          notification={notification}
          onPress={() => {
            if (notification.kind === 'event' && notification.entityId) {
              navigation.navigate('EventDetail', { eventId: notification.entityId });
            }
          }}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0,
    gap: spacing.md
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen
  }
});
