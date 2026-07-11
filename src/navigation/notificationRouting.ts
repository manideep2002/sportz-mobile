import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';

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
};

const stringValue = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);

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
      : undefined
});

export function navigateFromNotificationData(
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>,
  data: PushNotificationRouteData
) {
  if (!navigationRef.isReady()) return false;

  const screen = stringValue(data.screen);
  const entityType = stringValue(data.entityType) ?? stringValue(data.entity_type);
  const entityId = stringValue(data.entityId) ?? stringValue(data.entity_id);

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
  if (communityId || ((screen === '/group/[id]' || screen === '/page/[id]') && entityId)) {
    navigationRef.navigate('App', {
      screen: screen === '/page/[id]' || entityType === 'page' ? 'PageDetail' : 'GroupDetail',
      params: { communityId: communityId ?? entityId ?? '' }
    });
    return true;
  }

  navigationRef.navigate('App', { screen: 'Notifications' });
  return true;
}
