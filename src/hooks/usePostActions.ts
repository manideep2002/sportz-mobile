import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useDeletePost, useRecordPostShare } from '@/hooks/useFeed';
import type { Post } from '@/types/domain';
import { sharePost } from '@/utils/share';

type PostAction = 'share' | 'delete';

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export function usePostActions() {
  const shareMutation = useRecordPostShare();
  const deleteMutation = useDeletePost();
  const activeKeysRef = useRef(new Set<string>());
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());

  const setActionActive = useCallback((key: string, active: boolean) => {
    if (active) activeKeysRef.current.add(key);
    else activeKeysRef.current.delete(key);
    setActiveKeys(new Set(activeKeysRef.current));
  }, []);

  const runGuarded = useCallback(async (
    action: PostAction,
    postId: string,
    operation: () => Promise<void>
  ) => {
    const key = `${action}:${postId}`;
    if (activeKeysRef.current.has(key)) return;
    setActionActive(key, true);
    try {
      await operation();
    } finally {
      setActionActive(key, false);
    }
  }, [setActionActive]);

  const recordShare = useCallback(async (postId: string) => {
    try {
      await shareMutation.mutateAsync(postId);
    } catch (error) {
      Alert.alert(
        'Share count not updated',
        errorMessage(error, 'The post was shared, but its share count could not be updated.'),
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => void recordShare(postId) }
        ]
      );
    }
  }, [shareMutation]);

  const share = useCallback((post: Post) => runGuarded('share', post.id, async () => {
    try {
      const outcome = await sharePost(post);
      if (outcome === 'shared') await recordShare(post.id);
    } catch (error) {
      Alert.alert(
        'Could not share post',
        errorMessage(error, 'Please try again.'),
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => void share(post) }
        ]
      );
    }
  }), [recordShare, runGuarded]);

  const deletePost = useCallback((
    postId: string,
    onSuccess?: () => void
  ) => runGuarded('delete', postId, async () => {
    try {
      await deleteMutation.mutateAsync(postId);
      onSuccess?.();
    } catch (error) {
      Alert.alert(
        'Could not delete post',
        errorMessage(error, 'Please try again.'),
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', style: 'destructive', onPress: () => void deletePost(postId, onSuccess) }
        ]
      );
    }
  }), [deleteMutation, runGuarded]);

  const isPending = useCallback(
    (postId: string, action?: PostAction) => action
      ? activeKeys.has(`${action}:${postId}`)
      : activeKeys.has(`share:${postId}`) || activeKeys.has(`delete:${postId}`),
    [activeKeys]
  );

  return { share, deletePost, isPending };
}
