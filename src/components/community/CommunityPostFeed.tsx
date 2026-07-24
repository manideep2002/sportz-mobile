import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { PostCard } from '@/components/feed/PostCard';
import { PostOptionsSheet } from '@/components/feed/PostOptionsSheet';
import { AppText, Button } from '@/components/ui';
import { colors, spacing } from '@/design/tokens';
import { useDeletePost, useOptimisticPostSave, useRecordPostShare } from '@/hooks/useFeed';
import type { AppStackParamList } from '@/navigation/routes';
import { reportReasons, reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import type { Post } from '@/types/domain';
import { openPostMedia, sharePost } from '@/utils/share';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

interface CommunityPostFeedProps {
  posts: Post[];
  emptyMessage: string;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  onLoadMore: () => void;
}

export function CommunityPostFeed({
  posts,
  emptyMessage,
  isLoading,
  isError,
  error,
  onRetry,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  onLoadMore
}: CommunityPostFeedProps) {
  const navigation = useNavigation<Navigation>();
  const currentUserId = useAuthStore((state) => state.user?.id ?? state.profile?.id);
  const [activeOptionsPost, setActiveOptionsPost] = useState<Post | null>(null);
  const saveMutation = useOptimisticPostSave();
  const shareMutation = useRecordPostShare();
  const deletePostMutation = useDeletePost();

  const openPost = (post: Post) => navigation.navigate('PostDetail', { postId: post.id });
  const openAuthor = (post: Post) => {
    if (post.author.id.startsWith('page-')) {
      navigation.navigate('PageDetail', { communityId: post.author.id });
      return;
    }
    navigation.navigate('UserProfile', { userId: post.author.id });
  };
  const share = (post: Post) => {
    void sharePost(post).then(() => shareMutation.mutate(post.id));
  };
  const report = (post: Post) => {
    Alert.alert('Report Post', 'Choose a reason.', [
      ...reportReasons.map((reason) => ({
        text: reason,
        onPress: async () => {
          await reportService.reportEntity('post', post.id, reason);
          Alert.alert('Report submitted', 'Thank you. We will review this post.');
        }
      })),
      { text: 'Cancel', style: 'cancel' as const }
    ], { cancelable: true });
  };

  if (isLoading) {
    return <ActivityIndicator accessibilityLabel="Loading posts" color={colors.orange[500]} style={styles.loader} />;
  }

  if (isError && posts.length === 0) {
    return (
      <View style={styles.state}>
        <AppText variant="h4">Could not load posts</AppText>
        <AppText variant="bodyMuted">
          {error instanceof Error ? error.message : 'Please try again.'}
        </AppText>
        <Button size="sm" onPress={onRetry}>Retry</Button>
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={styles.state}>
        <AppText variant="bodyMuted">{emptyMessage}</AppText>
      </View>
    );
  }

  return (
    <>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onPress={() => openPost(post)}
          onAuthorPress={() => openAuthor(post)}
          onComment={() => openPost(post)}
          onShare={() => share(post)}
          onSave={() => saveMutation.mutate({ postId: post.id, saved: post.savedByMe })}
          onMediaPress={() => void openPostMedia(post)}
          onPrimaryAction={() => post.kind === 'stats' ? openAuthor(post) : openPost(post)}
          onMore={() => setActiveOptionsPost(post)}
        />
      ))}
      <View style={styles.pagination}>
        {isFetchNextPageError ? (
          <>
            <AppText variant="bodyMuted">Could not load more posts.</AppText>
            <Button size="sm" variant="dark" onPress={onLoadMore}>Retry Load More</Button>
          </>
        ) : hasNextPage ? (
          <Button
            size="sm"
            variant="dark"
            loading={isFetchingNextPage}
            disabled={isFetchingNextPage}
            onPress={onLoadMore}
          >
            Load More Posts
          </Button>
        ) : (
          <AppText variant="small">You&apos;re all caught up.</AppText>
        )}
      </View>
      <PostOptionsSheet
        open={activeOptionsPost !== null}
        post={activeOptionsPost}
        currentUserId={currentUserId}
        onClose={() => setActiveOptionsPost(null)}
        onViewAuthor={() => {
          if (activeOptionsPost) openAuthor(activeOptionsPost);
        }}
        onSaveToggle={() => {
          if (activeOptionsPost) {
            saveMutation.mutate({ postId: activeOptionsPost.id, saved: activeOptionsPost.savedByMe });
          }
        }}
        onViewSavedPosts={() => navigation.navigate('SavedPosts')}
        onShare={() => {
          if (activeOptionsPost) share(activeOptionsPost);
        }}
        onReport={() => {
          if (activeOptionsPost) report(activeOptionsPost);
        }}
        onEdit={() => {
          if (activeOptionsPost) {
            navigation.navigate('CreatePost', {
              editPostId: activeOptionsPost.id,
              communityId: activeOptionsPost.communityId ?? undefined
            });
          }
        }}
        onDelete={() => {
          if (activeOptionsPost) deletePostMutation.mutate(activeOptionsPost.id);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginVertical: spacing.lg
  },
  state: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg
  },
  pagination: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.lg
  }
});
