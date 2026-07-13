import { useCallback, useRef, useState } from 'react';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Filter } from 'lucide-react-native';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { NotificationRow } from '@/components/notifications/NotificationRow';

import { AppRefreshControl, AppText, Button, IconButton, Screen, SegmentedControl } from '@/components/ui';

import { colors, spacing } from '@/design/tokens';
import {
  useInfiniteNotifications,
  useMarkNotificationRead,
  useMarkNotificationsRead
} from '@/hooks/useNotifications';
import { useRespondCommunityInvite } from '@/hooks/useCommunities';
import { navigateFromNotificationData, notificationToRouteData } from '@/navigation/notificationRouting';
import { navigationRef } from '@/navigation/navigationRef';
import type { AppStackParamList } from '@/navigation/routes';
import type { SportzNotification } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

type FilterType = 'All' | 'Mentions' | 'Events' | 'Social';

const FILTER_OPTIONS: FilterType[] = ['All', 'Mentions', 'Events', 'Social'];

const stringValue = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

const filterNotifications = (notifications: SportzNotification[], filter: FilterType) => {
  switch (filter) {
    case 'Events':
      return notifications.filter((n) => n.kind === 'event' || n.kind === 'invite');
    case 'Mentions':
      return notifications.filter((n) => n.kind === 'comment' || n.kind === 'like' || n.kind === 'mention');
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
  if (navigateFromNotificationData(navigationRef, notificationToRouteData(notification))) {
    return;
  }

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
    case 'mention':
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
      // Navigate to the current user's own profile tab, which shows stats/achievements.
      navigation.navigate('MainTabs', { screen: 'ProfileTab' });
      break;
  }
};

export function NotificationsScreen() {
  const navigation = useNavigation<Navigation>();
  const [filter, setFilter] = useState<FilterType>('All');
  const [refreshing, setRefreshing] = useState(false);
  const flashListRef = useRef<FlashListRef<SportzNotification>>(null);

  const {
    data: infiniteData,
    isLoading,
    isError,
    error,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch
  } = useInfiniteNotifications();
  // Flatten paginated results into a single array
  const notifications: SportzNotification[] = infiniteData?.pages.flat() ?? [];
  const markAllRead = useMarkNotificationsRead();
  const markAsRead = useMarkNotificationRead();
  const respondInvite = useRespondCommunityInvite();

  const filteredNotifications = filterNotifications(notifications, filter);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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

  const handleInviteResponse = (notification: SportzNotification, approve: boolean) => {
    const inviteId = stringValue(notification.data?.inviteId);
    if (!inviteId) {
      navigateForNotification(navigation, notification);
      return;
    }

    if (!notification.read) {
      markAsRead.mutate(notification.id);
    }
    respondInvite.mutate(
      { inviteId, communityId: notification.entityId, approve },
      {
        onError: (error) => {
          Alert.alert(approve ? 'Accept failed' : 'Decline failed', error instanceof Error ? error.message : 'Please try again.');
        }
      }
    );
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

      {/* Error banner — shown when the fetch fails, with a retry action */}
      {isError ? (
        <View style={styles.errorBanner}>
          <AppText style={styles.errorText}>
            {error instanceof Error ? error.message : 'Could not load notifications.'}
          </AppText>
          <Button size="sm" onPress={() => void refetch()}>Retry</Button>
        </View>
      ) : null}

      <FlashList
        ref={flashListRef}
        data={filteredNotifications}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        bounces
        overScrollMode="always"
        contentContainerStyle={[styles.listContent, filteredNotifications.length === 0 ? styles.emptyListContent : null]}
        refreshControl={
          <AppRefreshControl
            refreshing={refreshing || isRefetching}
            onRefresh={onRefresh}
          />
        }
        // Trigger next page when the user scrolls within 30% of the bottom.
        // We check hasNextPage on the *full* unfiltered list so that a narrow
        // filter that yields 0 visible items still loads more data.
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.3}
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
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator color={colors.orange[500]} style={styles.footer} />
          ) : !hasNextPage && notifications.length > 0 ? (
            <AppText variant="caption" style={styles.footerEnd}>
              {"You're all caught up"}
            </AppText>
          ) : null
        }
        renderItem={({ item }) => (
          <NotificationRow
            notification={item}
            onPress={() => handleNotificationPress(item)}
            onCtaPress={() => handleCtaPress(item)}
            inviteActionLoading={respondInvite.isPending}
            onInviteAccept={stringValue(item.data?.inviteId) ? () => handleInviteResponse(item, true) : undefined}
            onInviteDecline={stringValue(item.data?.inviteId) ? () => handleInviteResponse(item, false) : undefined}
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
  listContent: {
    flexGrow: 1
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
  },
  footer: {
    paddingVertical: spacing.xl
  },
  footerEnd: {
    textAlign: 'center',
    color: colors.text.tertiary,
    paddingVertical: spacing.xl
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.screen,
    marginBottom: spacing.sm,
    backgroundColor: colors.overlays.dangerSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.semantic.danger,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm
  },
  errorText: {
    flex: 1,
    color: colors.semantic.danger,
    fontSize: 13
  }
});
