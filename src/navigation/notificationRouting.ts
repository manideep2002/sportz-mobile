import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RootStackParamList } from '@/navigation/routes';
import type { SportzNotification } from '@/types/domain';

export type PushNotificationRouteData = {
  screen?: unknown;
  type?: unknown;
  kind?: unknown;
  entityType?: unknown;
  entity_type?: unknown;
  entityId?: unknown;
  entity_id?: unknown;
  postId?: unknown;
  post_id?: unknown;
  commentId?: unknown;
  comment_id?: unknown;
  parentCommentId?: unknown;
  parent_comment_id?: unknown;
  eventId?: unknown;
  event_id?: unknown;
  profileId?: unknown;
  profile_id?: unknown;
  conversationId?: unknown;
  conversation_id?: unknown;
  roomId?: unknown;
  room_id?: unknown;
  communityId?: unknown;
  community_id?: unknown;
  inviteId?: unknown;
  invite_id?: unknown;
  bookingId?: unknown;
  booking_id?: unknown;
  offerId?: unknown;
  offer_id?: unknown;
  securityEventId?: unknown;
  security_event_id?: unknown;
};

const stringValue = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);
const pendingNotificationDestinationKey = 'sportz.pending-notification-destination.v1';

export const normalizeNotificationDestination = (data: PushNotificationRouteData): PushNotificationRouteData => {
  const normalized = Object.fromEntries(
    Object.entries(data).flatMap(([key, value]) => {
      const string = stringValue(value);
      return string ? [[key, string]] : [];
    })
  );
  return normalized as PushNotificationRouteData;
};

export const pendingNotificationDestination = {
  async save(data: PushNotificationRouteData): Promise<void> {
    const normalized = normalizeNotificationDestination(data);
    await AsyncStorage.setItem(pendingNotificationDestinationKey, JSON.stringify(normalized));
  },
  async peek(): Promise<PushNotificationRouteData | null> {
    try {
      const raw = await AsyncStorage.getItem(pendingNotificationDestinationKey);
      return raw ? normalizeNotificationDestination(JSON.parse(raw) as PushNotificationRouteData) : null;
    } catch {
      await AsyncStorage.removeItem(pendingNotificationDestinationKey);
      return null;
    }
  },
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(pendingNotificationDestinationKey);
  }
};

let openingPendingNotification = false;
export async function openPendingNotificationDestination(
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>,
  authenticated: boolean
): Promise<boolean> {
  if (!authenticated || !navigationRef.isReady() || openingPendingNotification) return false;
  openingPendingNotification = true;
  try {
    const destination = await pendingNotificationDestination.peek();
    if (!destination) return false;
    const handled = navigateFromNotificationData(navigationRef, destination);
    if (handled) await pendingNotificationDestination.clear();
    return handled;
  } finally {
    openingPendingNotification = false;
  }
}

export const notificationToRouteData = (notification: SportzNotification): PushNotificationRouteData => ({
  ...(notification.data ?? {}),
  type: notification.kind,
  kind: notification.kind,
  entityType: notification.entityType,
  entityId: notification.entityId,
  postId: notification.entityType === 'post' ? notification.entityId : undefined,
  commentId: notification.data?.commentId,
  parentCommentId: notification.data?.parentCommentId,
  eventId: notification.entityType === 'event' ? notification.entityId : undefined,
  profileId: notification.entityType === 'profile' ? notification.entityId : notification.actor?.id,
  conversationId: notification.entityType === 'conversation' ? notification.entityId : undefined,
  communityId:
    notification.entityType === 'group' || notification.entityType === 'page'
      ? notification.entityId
      : undefined,
  bookingId: notification.entityType === 'court_booking' ? notification.entityId : undefined,
  offerId: notification.entityType === 'team_offer' ? notification.entityId : undefined,
  securityEventId: notification.entityType === 'security_event' ? notification.entityId : undefined
});

export function navigateFromNotificationData(
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>,
  data: PushNotificationRouteData
) {
  if (!navigationRef.isReady()) return false;

  const screen = stringValue(data.screen);
  const entityType = stringValue(data.entityType) ?? stringValue(data.entity_type);
  const entityId = stringValue(data.entityId) ?? stringValue(data.entity_id);
  const kind = stringValue(data.kind) ?? stringValue(data.type);

  if (kind === 'security' || entityType === 'security_event' || stringValue(data.securityEventId) || stringValue(data.security_event_id)) {
    navigationRef.navigate('App', { screen: 'AccountSecurity' });
    return true;
  }

  const postId =
    stringValue(data.postId) ??
    stringValue(data.post_id) ??
    (entityType === 'post' ? entityId : undefined);
  const commentId = stringValue(data.commentId) ?? stringValue(data.comment_id);
  if (postId || (screen === '/post/[id]' && entityId)) {
    navigationRef.navigate('App', {
      screen: 'PostDetail',
      params: { postId: postId ?? entityId ?? '', commentId }
    });
    return true;
  }

  const eventId =
    stringValue(data.eventId) ??
    stringValue(data.event_id) ??
    (entityType === 'event' ? entityId : undefined);
  if (eventId || (screen === '/event/[id]' && entityId)) {
    navigationRef.navigate('App', { screen: 'EventDetail', params: { eventId: eventId ?? entityId ?? '' } });
    return true;
  }

  const bookingId =
    stringValue(data.bookingId) ??
    stringValue(data.booking_id) ??
    (entityType === 'court_booking' ? entityId : undefined);
  if (bookingId || (screen === 'CourtBookingDetail' && entityId)) {
    navigationRef.navigate('App', {
      screen: 'CourtBookingDetail',
      params: { bookingId: bookingId ?? entityId ?? '' }
    });
    return true;
  }

  const offerId =
    stringValue(data.offerId) ??
    stringValue(data.offer_id) ??
    (entityType === 'team_offer' ? entityId : undefined);
  if (offerId || (screen === 'OfferDetail' && entityId)) {
    navigationRef.navigate('App', {
      screen: 'OfferDetail',
      params: { offerId: offerId ?? entityId ?? '' }
    });
    return true;
  }

  const profileId =
    stringValue(data.profileId) ??
    stringValue(data.profile_id) ??
    (entityType === 'profile' ? entityId : undefined);
  if (profileId || (screen === '/profile/[id]' && entityId)) {
    navigationRef.navigate('App', { screen: 'UserProfile', params: { userId: profileId ?? entityId ?? '' } });
    return true;
  }

  const conversationId =
    stringValue(data.conversationId) ??
    stringValue(data.conversation_id) ??
    stringValue(data.roomId) ??
    stringValue(data.room_id) ??
    (entityType === 'conversation' || entityType === 'chat_room' ? entityId : undefined);
  if (conversationId || (screen === '/messages/[id]' && entityId)) {
    navigationRef.navigate('App', {
      screen: 'Chat',
      params: { conversationId: conversationId ?? entityId ?? '' }
    });
    return true;
  }

  const communityId =
    stringValue(data.communityId) ??
    stringValue(data.community_id) ??
    (entityType === 'group' || entityType === 'page' ? entityId : undefined);
  const inviteId = stringValue(data.inviteId) ?? stringValue(data.invite_id);
  if (inviteId && (entityType === 'group' || entityType === 'page')) {
    navigationRef.navigate('App', {
      screen: 'CommunityInvitation',
      params: { inviteId }
    });
    return true;
  }
  if (communityId || ((screen === '/group/[id]' || screen === '/page/[id]') && entityId)) {
    navigationRef.navigate('App', {
      screen: screen === '/page/[id]' || entityType === 'page' ? 'PageDetail' : 'GroupDetail',
      params: { communityId: communityId ?? entityId ?? '' }
    });
    return true;
  }

  // Achievement notifications → own profile tab (no entity ID needed).
  if (kind === 'achievement') {
    navigationRef.navigate('App', { screen: 'MainTabs', params: { screen: 'ProfileTab' } });
    return true;
  }

  navigationRef.navigate('App', { screen: 'Notifications' });
  return true;
}
