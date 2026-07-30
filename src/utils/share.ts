import { Alert, Linking } from 'react-native';

import type { Post, SportEvent } from '@/types/domain';
import { eventDate, formatTime } from './format';
import { shareCanonicalEntity } from '@/services/canonicalLinkService';

export const sharePost = (post: Post) =>
  shareCanonicalEntity('post', post.id, {
    title: `${post.author.displayName} on SPORTZ`,
    message: post.visibility === 'public'
      ? `${post.author.displayName} shared on SPORTZ:\n\n${post.body}`
      : 'Open this SPORTZ post. Sign-in and audience access rules apply.'
  });

export const shareEvent = async (event: SportEvent) => {
  try {
    const message = event.visibility === 'public'
      ? `Join me at ${event.title}!\n\n${event.sport} - ${eventDate(event.startsAt)} at ${formatTime(event.startsAt)}\n${event.locationName}, ${event.city}\n\n${event.playerCount}/${event.maxPlayers} players - ${event.entryFeeLabel}`
      : 'Open this SPORTZ event. Sign-in and invitation or membership access rules apply.';
    
    await shareCanonicalEntity('event', event.id, { message, title: event.title });
  } catch (error) {
    console.error('Share failed:', error);
  }
};

const IN_APP_VIDEO_PROTOCOLS = new Set(['http:', 'https:', 'file:', 'content:', 'blob:']);

export const supportsInAppVideoUrl = (value?: string | null) => {
  if (!value?.trim()) return false;
  try {
    return IN_APP_VIDEO_PROTOCOLS.has(new URL(value).protocol.toLowerCase());
  } catch {
    return false;
  }
};

export const openPostMedia = async (post: Post) => {
  if (!post.mediaUrl) return;

  try {
    if (!(await Linking.canOpenURL(post.mediaUrl))) {
      throw new Error('Unsupported media URL.');
    }
    await Linking.openURL(post.mediaUrl);
  } catch {
    Alert.alert('Could not open media', 'This media is currently unavailable.');
  }
};
