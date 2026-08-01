/**
 * Unit tests for navigateFromNotificationData and notificationToRouteData.
 *
 * Covers: each routable entity type, camelCase / snake_case field aliases,
 * the `screen` path-template field, achievement fallback, and the not-ready guard.
 */

import {
  navigateFromNotificationData,
  notificationToRouteData,
  type PushNotificationRouteData
} from '@/navigation/notificationRouting';
import type { SportzNotification } from '@/types/domain';

// ─── navigationRef mock ───────────────────────────────────────────────────────

const mockNavigate = jest.fn();
let mockReady = true;

const fakeRef = {
  isReady: () => mockReady,
  navigate: mockNavigate
} as unknown as Parameters<typeof navigateFromNotificationData>[0];

// ─── helpers ─────────────────────────────────────────────────────────────────

function navigate(data: PushNotificationRouteData) {
  return navigateFromNotificationData(fakeRef, data);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('navigateFromNotificationData', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockReady = true;
  });

  it('returns false and does not navigate when navigator is not ready', () => {
    mockReady = false;
    const result = navigate({ postId: 'post-1' });
    expect(result).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // ── Post ────────────────────────────────────────────────────────────────────

  it('routes to PostDetail via postId', () => {
    navigate({ postId: 'post-1' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'PostDetail',
      params: { postId: 'post-1', commentId: undefined }
    });
  });

  it('routes to PostDetail via post_id alias', () => {
    navigate({ post_id: 'post-2' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'PostDetail',
      params: { postId: 'post-2', commentId: undefined }
    });
  });

  it('routes to PostDetail via entityType=post + entityId', () => {
    navigate({ entityType: 'post', entityId: 'post-3' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'PostDetail',
      params: { postId: 'post-3', commentId: undefined }
    });
  });

  it('routes to PostDetail via screen path template', () => {
    navigate({ screen: '/post/[id]', entityId: 'post-4' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'PostDetail',
      params: { postId: 'post-4', commentId: undefined }
    });
  });

  it('includes commentId when present', () => {
    navigate({ postId: 'post-1', commentId: 'cmt-5' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'PostDetail',
      params: { postId: 'post-1', commentId: 'cmt-5' }
    });
  });

  it('includes commentId via comment_id alias', () => {
    navigate({ postId: 'post-1', comment_id: 'cmt-6' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'PostDetail',
      params: { postId: 'post-1', commentId: 'cmt-6' }
    });
  });

  // ── Event ───────────────────────────────────────────────────────────────────

  it('routes to EventDetail via eventId', () => {
    navigate({ eventId: 'evt-1' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'EventDetail',
      params: { eventId: 'evt-1' }
    });
  });

  it('routes to EventDetail via event_id alias', () => {
    navigate({ event_id: 'evt-2' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'EventDetail',
      params: { eventId: 'evt-2' }
    });
  });

  it('routes to EventDetail via entityType=event + entityId', () => {
    navigate({ entityType: 'event', entityId: 'evt-3' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'EventDetail',
      params: { eventId: 'evt-3' }
    });
  });

  it('routes to EventDetail via screen path template', () => {
    navigate({ screen: '/event/[id]', entityId: 'evt-4' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'EventDetail',
      params: { eventId: 'evt-4' }
    });
  });

  // ── Court booking ────────────────────────────────────────────────────────────

  it('routes to CourtBookingDetail via bookingId', () => {
    navigate({ bookingId: 'bk-1' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'CourtBookingDetail',
      params: { bookingId: 'bk-1' }
    });
  });

  it('routes to CourtBookingDetail via booking_id alias', () => {
    navigate({ booking_id: 'bk-2' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'CourtBookingDetail',
      params: { bookingId: 'bk-2' }
    });
  });

  it('routes to CourtBookingDetail via entityType=court_booking', () => {
    navigate({ entityType: 'court_booking', entityId: 'bk-3' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'CourtBookingDetail',
      params: { bookingId: 'bk-3' }
    });
  });

  it('routes to CourtBookingDetail via screen name', () => {
    navigate({ screen: 'CourtBookingDetail', entityId: 'bk-4' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'CourtBookingDetail',
      params: { bookingId: 'bk-4' }
    });
  });

  it('routes a team offer notification to OfferDetail', () => {
    navigate({ entityType: 'team_offer', entityId: 'offer-1' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'OfferDetail',
      params: { offerId: 'offer-1' }
    });
  });

  // ── User profile ─────────────────────────────────────────────────────────────

  it('routes to UserProfile via profileId', () => {
    navigate({ profileId: 'user-1' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'UserProfile',
      params: { userId: 'user-1' }
    });
  });

  it('routes to UserProfile via profile_id alias', () => {
    navigate({ profile_id: 'user-2' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'UserProfile',
      params: { userId: 'user-2' }
    });
  });

  it('routes to UserProfile via entityType=profile', () => {
    navigate({ entityType: 'profile', entityId: 'user-3' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'UserProfile',
      params: { userId: 'user-3' }
    });
  });

  it('routes to UserProfile via screen path template', () => {
    navigate({ screen: '/profile/[id]', entityId: 'user-4' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'UserProfile',
      params: { userId: 'user-4' }
    });
  });

  // ── Conversation / chat ───────────────────────────────────────────────────────

  it('routes to Chat via conversationId', () => {
    navigate({ conversationId: 'conv-1' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'Chat',
      params: { conversationId: 'conv-1' }
    });
  });

  it('routes to Chat via conversation_id alias', () => {
    navigate({ conversation_id: 'conv-2' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'Chat',
      params: { conversationId: 'conv-2' }
    });
  });

  it('routes to Chat via roomId alias', () => {
    navigate({ roomId: 'conv-3' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'Chat',
      params: { conversationId: 'conv-3' }
    });
  });

  it('routes to Chat via entityType=conversation', () => {
    navigate({ entityType: 'conversation', entityId: 'conv-4' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'Chat',
      params: { conversationId: 'conv-4' }
    });
  });

  it('routes to Chat via screen path template', () => {
    navigate({ screen: '/messages/[id]', entityId: 'conv-5' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'Chat',
      params: { conversationId: 'conv-5' }
    });
  });

  // ── Community ────────────────────────────────────────────────────────────────

  it('routes to GroupDetail via entityType=group', () => {
    navigate({ entityType: 'group', entityId: 'grp-1' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'GroupDetail',
      params: { communityId: 'grp-1' }
    });
  });

  it('routes to PageDetail via entityType=page', () => {
    navigate({ entityType: 'page', entityId: 'page-1' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'PageDetail',
      params: { communityId: 'page-1' }
    });
  });

  it('routes to PageDetail via screen path /page/[id]', () => {
    navigate({ screen: '/page/[id]', entityId: 'page-2' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'PageDetail',
      params: { communityId: 'page-2' }
    });
  });

  it('routes to GroupDetail via screen path /group/[id]', () => {
    navigate({ screen: '/group/[id]', entityId: 'grp-2' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'GroupDetail',
      params: { communityId: 'grp-2' }
    });
  });

  // ── Achievement fallback ──────────────────────────────────────────────────────

  it('routes to ProfileTab for achievement kind', () => {
    navigate({ kind: 'achievement' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'MainTabs',
      params: { screen: 'ProfileTab' }
    });
  });

  it('routes to ProfileTab for achievement type', () => {
    navigate({ type: 'achievement' });
    expect(mockNavigate).toHaveBeenCalledWith('App', {
      screen: 'MainTabs',
      params: { screen: 'ProfileTab' }
    });
  });

  it('routes security and security-event notifications to Account Security', () => {
    navigate({ kind: 'security', entityType: 'security_event', entityId: 'security-1' });
    expect(mockNavigate).toHaveBeenCalledWith('App', { screen: 'AccountSecurity' });
  });

  // ── Generic fallback ──────────────────────────────────────────────────────────

  it('falls back to Notifications screen for unknown payload', () => {
    navigate({});
    expect(mockNavigate).toHaveBeenCalledWith('App', { screen: 'Notifications' });
  });

  it('returns true for every routable payload', () => {
    expect(navigate({ postId: 'p' })).toBe(true);
    expect(navigate({ eventId: 'e' })).toBe(true);
    expect(navigate({ bookingId: 'b' })).toBe(true);
    expect(navigate({ profileId: 'u' })).toBe(true);
    expect(navigate({ conversationId: 'c' })).toBe(true);
    expect(navigate({ entityType: 'group', entityId: 'g' })).toBe(true);
    expect(navigate({ kind: 'achievement' })).toBe(true);
    expect(navigate({})).toBe(true);
  });
});

// ─── notificationToRouteData ──────────────────────────────────────────────────

describe('notificationToRouteData', () => {
  const base: SportzNotification = {
    id: 'n-1',
    kind: 'event',
    title: 'Test',
    body: 'Body',
    read: false,
    createdAt: new Date().toISOString()
  };

  it('maps event notification to eventId route field', () => {
    const data = notificationToRouteData({
      ...base,
      kind: 'event',
      entityType: 'event',
      entityId: 'evt-42'
    });
    expect(data.eventId).toBe('evt-42');
    expect(data.postId).toBeUndefined();
  });

  it('maps post notification to postId route field', () => {
    const data = notificationToRouteData({
      ...base,
      kind: 'like',
      entityType: 'post',
      entityId: 'post-7'
    });
    expect(data.postId).toBe('post-7');
    expect(data.eventId).toBeUndefined();
  });

  it('maps follow notification profileId from entityId when entityType=profile', () => {
    const data = notificationToRouteData({
      ...base,
      kind: 'follow',
      entityType: 'profile',
      entityId: 'user-99'
    });
    expect(data.profileId).toBe('user-99');
  });

  it('maps message notification to conversationId', () => {
    const data = notificationToRouteData({
      ...base,
      kind: 'message',
      entityType: 'conversation',
      entityId: 'conv-5'
    });
    expect(data.conversationId).toBe('conv-5');
  });

  it('maps group invite to communityId', () => {
    const data = notificationToRouteData({
      ...base,
      kind: 'invite',
      entityType: 'group',
      entityId: 'grp-3'
    });
    expect(data.communityId).toBe('grp-3');
  });

  it('maps court_booking to bookingId', () => {
    const data = notificationToRouteData({
      ...base,
      kind: 'event',
      entityType: 'court_booking',
      entityId: 'bk-9'
    });
    expect(data.bookingId).toBe('bk-9');
  });

  it('maps team_offer to offerId', () => {
    const data = notificationToRouteData({
      ...base,
      kind: 'invite',
      entityType: 'team_offer',
      entityId: 'offer-9'
    });
    expect(data.offerId).toBe('offer-9');
  });

  it('sets kind and type from notification.kind', () => {
    const data = notificationToRouteData({ ...base, kind: 'comment' });
    expect(data.kind).toBe('comment');
    expect(data.type).toBe('comment');
  });

  it('maps a security event to the typed security destination', () => {
    const data = notificationToRouteData({
      ...base,
      kind: 'security',
      entityType: 'security_event',
      entityId: 'security-42'
    });
    expect(data.securityEventId).toBe('security-42');
  });
});
