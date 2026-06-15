import { Alert, Linking, Share } from 'react-native';

import type { Post, SportEvent } from '@/types/domain';
import { eventDate, formatTime } from './format';

export const sharePost = (post: Post) =>
  Share.share({
    title: `${post.author.displayName} on SPORTZ`,
    message: `${post.author.displayName} shared on SPORTZ:\n\n${post.body}`
  });

export const shareEvent = async (event: SportEvent) => {
  try {
    const message = `Join me at ${event.title}!\n\n${event.sport} • ${eventDate(event.startsAt)} at ${formatTime(event.startsAt)}\n${event.locationName}, ${event.city}\n\n${event.playerCount}/${event.maxPlayers} players • ${event.entryFeeLabel}`;
    
    await Share.share({
      message,
      title: event.title
    });
  } catch (error) {
    console.error('Share failed:', error);
  }
};

export const openPostMedia = async (post: Post) => {
  if (!post.mediaUrl) return;

  try {
    await Linking.openURL(post.mediaUrl);
  } catch {
    Alert.alert('Could not open media', 'This media is currently unavailable.');
  }
};
