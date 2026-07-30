import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';

import { env } from '@/lib/env';
import type { AppStackParamList } from '@/navigation/routes';

export type CanonicalEntity =
  | 'post'
  | 'profile'
  | 'event'
  | 'court'
  | 'group'
  | 'page'
  | 'community-invitation';

export interface CanonicalDestination {
  screen: keyof AppStackParamList;
  params: Record<string, string>;
}

export type CanonicalShareOutcome = 'shared' | 'dismissed';

const entityPaths: Record<CanonicalEntity, string> = {
  post: 'posts',
  profile: 'profiles',
  event: 'events',
  court: 'courts',
  group: 'groups',
  page: 'pages',
  'community-invitation': 'invitations/community'
};

const pendingDestinationKey = 'sportz.pending-canonical-destination.v1';

const cleanId = (id: string) => encodeURIComponent(id.trim());

export const canonicalUrlFor = (entity: CanonicalEntity, id: string) =>
  `${env.canonicalWebUrl.replace(/\/+$/, '')}/${entityPaths[entity]}/${cleanId(id)}`;

export const shareCanonicalEntity = async (
  entity: CanonicalEntity,
  id: string,
  options: { title: string; message: string }
): Promise<CanonicalShareOutcome> => {
  const url = canonicalUrlFor(entity, id);
  const result = await Share.share({
    title: options.title,
    message: `${options.message.trim()}\n\n${url}`,
    url
  });
  return result.action === Share.sharedAction ? 'shared' : 'dismissed';
};

const normalizedSegments = (url: string): string[] => {
  try {
    const parsed = new URL(url);
    const scheme = parsed.protocol.replace(':', '');
    const isCustomScheme = scheme === env.appScheme;
    const isCanonicalHttps =
      (scheme === 'https' || scheme === 'http') &&
      parsed.origin === new URL(env.canonicalWebUrl).origin;
    if (!isCustomScheme && !isCanonicalHttps) return [];
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (isCustomScheme && parsed.hostname) segments.unshift(parsed.hostname);
    return segments.map((segment) => decodeURIComponent(segment));
  } catch {
    return [];
  }
};

export const parseCanonicalDestination = (url: string): CanonicalDestination | null => {
  const segments = normalizedSegments(url);
  if (segments.length < 2) return null;
  const [entity, id] = segments;
  if (!id) return null;

  if (entity === 'posts') return { screen: 'PostDetail', params: { postId: id } };
  if (entity === 'profiles') return { screen: 'UserProfile', params: { userId: id } };
  if (entity === 'events') return { screen: 'EventDetail', params: { eventId: id } };
  if (entity === 'courts') return { screen: 'CourtDetail', params: { courtId: id } };
  if (entity === 'groups') return { screen: 'GroupDetail', params: { communityId: id } };
  if (entity === 'pages') return { screen: 'PageDetail', params: { communityId: id } };
  if (entity === 'invitations' && id === 'community' && segments[2]) {
    return { screen: 'CommunityInvitation', params: { inviteId: segments[2] } };
  }
  return null;
};

export const pendingCanonicalDestination = {
  async save(url: string): Promise<void> {
    if (!parseCanonicalDestination(url)) return;
    await AsyncStorage.setItem(pendingDestinationKey, url);
  },

  async consume(): Promise<string | null> {
    const url = await AsyncStorage.getItem(pendingDestinationKey);
    if (url) await AsyncStorage.removeItem(pendingDestinationKey);
    return url;
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(pendingDestinationKey);
  }
};
