import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { PostCard } from '@/components/feed/PostCard';
import { PostOptionsSheet } from '@/components/feed/PostOptionsSheet';
import { ReportSheet } from '@/components/moderation/ReportSheet';
import { AppText, Button } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { spacing } from '@/design/tokens';
import { useOptimisticPostSave } from '@/hooks/useFeed';
import { usePostActions } from '@/hooks/usePostActions';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import type { Post } from '@/types/domain';
import { openPostMedia } from '@/utils/share';

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
  const { colors: theme } = useAppTheme();
  const currentUserId = useAuthStore((state) => state.user?.id ?? state.profile?.id);
  const [activeOptionsPost, setActiveOptionsPost] = useState<Post | null>(null);
  const [reportTarget, setReportTarget] = useState<Post | null>(null);
  const [activeVideoPostId, setActiveVideoPostId] = useState<string | null>(null);
  const saveMutation = useOptimisticPostSave();
  const postActions = usePostActions();

  const openPost = (post: Post) => navigation.navigate('PostDetail', { postId: post.id });
  const openAuthor = (post: Post) => {
    if (post.author.id.startsWith('page-')) {
      navigation.navigate('PageDetail', { communityId: post.author.id });
      return;
    }
    navigation.navigate('UserProfile', { userId: post.author.id });
  };
  if (isLoading) {
    return <ActivityIndicator accessibilityLabel="Loading posts" color={theme.accent} style={styles.loader} />;
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
          onShare={() => void postActions.share(post)}
          sharePending={postActions.isPending(post.id, 'share')}
          onSave={() => saveMutation.mutate({ postId: post.id, saved: post.savedByMe })}
          isVideoActive={activeVideoPostId === post.id}
          onVideoActivate={() => setActiveVideoPostId(post.id)}
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
        actionPending={activeOptionsPost ? postActions.isPending(activeOptionsPost.id) : false}
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
          if (activeOptionsPost) void postActions.share(activeOptionsPost);
        }}
        onReport={() => {
          if (activeOptionsPost) setReportTarget(activeOptionsPost);
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
          if (activeOptionsPost) void postActions.deletePost(activeOptionsPost.id);
        }}
      />
      <ReportSheet
        open={reportTarget !== null}
        entityLabel="post"
        entityType="post"
        entityId={reportTarget?.id ?? ''}
        onClose={() => setReportTarget(null)}
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
