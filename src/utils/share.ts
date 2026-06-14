import { Alert, Linking, Share } from 'react-native';

import type { Post } from '@/types/domain';

export const sharePost = (post: Post) =>
  Share.share({
    title: `${post.author.displayName} on SPORTZ`,
    message: `${post.author.displayName} shared on SPORTZ:\n\n${post.body}`
  });

export const openPostMedia = async (post: Post) => {
  if (!post.mediaUrl) return;

  try {
    await Linking.openURL(post.mediaUrl);
  } catch {
    Alert.alert('Could not open media', 'This media is currently unavailable.');
  }
};
