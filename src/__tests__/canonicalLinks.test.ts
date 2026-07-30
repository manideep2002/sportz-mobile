import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';

import {
  canonicalUrlFor,
  parseCanonicalDestination,
  pendingCanonicalDestination,
  shareCanonicalEntity
} from '@/services/canonicalLinkService';

describe('canonical links', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it.each([
    ['post', 'posts', 'PostDetail', 'postId'],
    ['profile', 'profiles', 'UserProfile', 'userId'],
    ['event', 'events', 'EventDetail', 'eventId'],
    ['court', 'courts', 'CourtDetail', 'courtId'],
    ['group', 'groups', 'GroupDetail', 'communityId'],
    ['page', 'pages', 'PageDetail', 'communityId']
  ] as const)('builds and parses the %s route', (entity, pathName, screen, parameter) => {
    const url = canonicalUrlFor(entity, 'entity-1');
    expect(url).toContain(`/${pathName}/entity-1`);
    expect(parseCanonicalDestination(url)).toEqual({
      screen,
      params: { [parameter]: 'entity-1' }
    });
  });

  it('supports a recipient-protected community invitation route', () => {
    const url = canonicalUrlFor('community-invitation', 'invite-1');
    expect(parseCanonicalDestination(url)).toEqual({
      screen: 'CommunityInvitation',
      params: { inviteId: 'invite-1' }
    });
  });

  it('parses warm custom-scheme links and rejects chats or unknown routes', () => {
    expect(parseCanonicalDestination('sportz://posts/post-2')).toEqual({
      screen: 'PostDetail',
      params: { postId: 'post-2' }
    });
    expect(parseCanonicalDestination('https://sportz.app/chats/private-chat')).toBeNull();
    expect(parseCanonicalDestination('https://sportz.app/deleted/entity')).toBeNull();
    expect(parseCanonicalDestination('https://example.com/posts/untrusted')).toBeNull();
  });

  it('persists and consumes the destination through authentication', async () => {
    const url = canonicalUrlFor('event', 'event-after-login');
    await pendingCanonicalDestination.save(url);
    await expect(pendingCanonicalDestination.consume()).resolves.toBe(url);
    await expect(pendingCanonicalDestination.consume()).resolves.toBeNull();
  });

  it('does not persist malformed or unsupported destinations', async () => {
    await pendingCanonicalDestination.save('https://sportz.app/chats/not-shareable');
    await expect(pendingCanonicalDestination.consume()).resolves.toBeNull();
  });

  it('distinguishes completed native shares from iOS dismissals', async () => {
    const share = jest.spyOn(Share, 'share');
    share.mockResolvedValueOnce({ action: Share.dismissedAction });
    await expect(shareCanonicalEntity('post', 'post-1', {
      title: 'Post',
      message: 'Take a look'
    })).resolves.toBe('dismissed');

    share.mockResolvedValueOnce({ action: Share.sharedAction, activityType: 'com.apple.UIKit.activity.CopyToPasteboard' });
    await expect(shareCanonicalEntity('post', 'post-1', {
      title: 'Post',
      message: 'Take a look'
    })).resolves.toBe('shared');
    share.mockRestore();
  });
});
