import { useCallback, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Filter } from 'lucide-react-native';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { NotificationRow } from '@/components/notifications/NotificationRow';
import { AppText, Button, IconButton, Screen, SegmentedControl } from '@/components/ui';
import { colors, spacing } from '@/design/tokens';
import {
  useInfiniteNotifications,
  useMarkNotificationRead,
  useMarkNotificationsRead,
  useRealtimeNotifications
} from '@/hooks/useNotifications';
import type { AppStackParamList } from '@/navigation/routes';
import type { SportzNotification } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

type FilterType = 'All' | 'Mentions' | 'Events' | 'Social';

const FILTER_OPTIONS: FilterType[] = ['All', 'Mentions', 'Events', 'Social'];

const filterNotifications = (notifications: SportzNotification[], filter: FilterType) => {
  switch (filter) {
    case 'Events':
      return notifications.filter((n) => n.kind === 'event' || n.kind === 'invite');
    case 'Mentions':
      return notifications.filter((n) => n.kind === 'comment' || n.kind === 'like');
    case 'Social':
      return notifications.filter((n) => n.kind === 'follow' || n.kind === 'follow_request' || n.kind === 'achievement');
    case 'All':
    default:
      return notifications;
  }
};

const navigateForNotification = (
  navigation: Navigation,
  notification: SportzNotification
) => {
  const { kind, entityId, entityType, actor } = notification;

  switch (kind) {
    case 'event':
    case 'invite':
      if (entityId && entityType === 'event') {
        navigation.navigate('EventDetail', { eventId: entityId });
      } else if (entityId && entityType === 'group') {
        navigation.navigate('GroupDetail', { communityId: entityId });
      }
      break;
    case 'like':
    case 'comment':
      if (entityId && entityType === 'post') {
        navigation.navigate('PostDetail', { postId: entityId });
      }
      break;
    case 'message':
      if (entityId && entityType === 'conversation') {
        navigation.navigate('Chat', { conversationId: entityId });
      }
      break;
    case 'follow':
    case 'follow_request':
      if (entityId && entityType === 'profile') {
        navigation.navigate('UserProfile', { userId: entityId });
      } else if (actor?.id) {
        navigation.navigate('UserProfile', { userId: actor.id });
      }
      break;
    case 'achievement':
      // Could navigate to profile or achievements screen
      break;
  }
};

export function NotificationsScreen() {
  const navigation = useNavigation<Navigation>();
  const [filter, setFilter] = useState<FilterType>('All');
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef<FlatList<SportzNotification>>(null);

  const { data: infiniteData, isLoading, isRefetching, refetch } = useInfiniteNotifications();
  // Flatten paginated results into a single array
  const notifications: SportzNotification[] = infiniteData?.pages.flat() ?? [];
  const markAllRead = useMarkNotificationsRead();
  const markAsRead = useMarkNotificationRead();

  const filteredNotifications = filterNotifications(notifications, filter);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  useRealtimeNotifications(() => {});

  const handleNotificationPress = (notification: SportzNotification) => {
    if (!notification.read) {
      markAsRead.mutate(notification.id);
    }
    navigateForNotification(navigation, notification);
  };

  const handleCtaPress = (notification: SportzNotification) => {
    if (!notification.read) {
      markAsRead.mutate(notification.id);
    }
    navigateForNotification(navigation, notification);
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  if (isLoading) {
    return (
      <Screen contentContainerStyle={styles.loadingContainer}>
        <ActivityIndicator color={colors.orange[500]} size="large" />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Activity</AppText>
        <Button
          variant="dark"
          size="sm"
          loading={markAllRead.isPending}
          onPress={handleMarkAllRead}
          disabled={notifications.every((n) => n.read)}
        >
          Mark all read
        </Button>
      </View>

      <SegmentedControl value={filter} options={FILTER_OPTIONS} onChange={setFilter} />
      <View style={styles.requestRow}>
        <Button variant="dark" size="sm" onPress={() => navigation.navigate('FollowRequests')}>
          Follow requests
        </Button>
      </View>

      <FlatList
        ref={flatListRef}
        data={filteredNotifications}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={filteredNotifications.length === 0 ? styles.emptyListContent : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.orange[500]}
            colors={[colors.orange[500]]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Filter size={48} color={colors.text.tertiary} />
            <AppText variant="h4" style={styles.emptyTitle}>
              {filter === 'All' ? 'No activity yet' : `No ${filter.toLowerCase()} notifications`}
            </AppText>
            <AppText variant="bodyMuted" style={styles.emptySubtitle}>
              {filter === 'All'
                ? 'When someone interacts with your posts, events, or profile, it will show up here.'
                : 'Try another filter or check back later.'}
            </AppText>
          </View>
        }
        ListHeaderComponent={
          filteredNotifications.length > 0 ? (
            <AppText variant="caption" style={styles.sectionHeader}>New</AppText>
          ) : null
        }
        renderItem={({ item }) => (
          <NotificationRow
            notification={item}
            onPress={() => handleNotificationPress(item)}
            onCtaPress={() => handleCtaPress(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 0
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md
  },
  sectionHeader: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    color: colors.text.secondary
  },
  requestRow: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    alignItems: 'flex-start'
  },
  emptyListContent: {
    flexGrow: 1
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md
  },
  emptyTitle: {
    textAlign: 'center',
    color: colors.text.primary
  },
  emptySubtitle: {
    textAlign: 'center',
    color: colors.text.tertiary
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.dark[700],
    marginHorizontal: spacing.screen
  }
});
