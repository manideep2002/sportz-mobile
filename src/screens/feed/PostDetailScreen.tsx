import { useRef, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Heart } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PostCard } from '@/components/feed/PostCard';
import { PostOptionsSheet } from '@/components/feed/PostOptionsSheet';
import { CommentInput } from '@/components/social/CommentInput';

import { AppRefreshControl, AppText, Avatar, Button, IconButton, Screen, VerifiedName } from '@/components/ui';

import { colors, spacing, typography } from '@/design/tokens';
import { useComments, useDeleteComment, useDeletePost, useOptimisticCommentLike, useOptimisticPostSave, usePost, usePostRealtimeUpdates, useRecordPostShare } from '@/hooks/useFeed';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import { reportReasons, reportService } from '@/services/reportService';
import { openPostMedia, sharePost } from '@/utils/share';
import type { Comment } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'PostDetail'>;

export function PostDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const {
    data: post,
    isLoading: postLoading,
    isError: postIsError,
    isRefetching: postRefetching,
    error: postError,
    refetch: refetchPost
  } = usePost(route.params.postId);
  const {
    data: comments = [],
    isLoading: commentsLoading,
    isError: commentsIsError,
    isRefetching: commentsRefetching,
    error: commentsError,
    refetch: refetchComments
  } = useComments(route.params.postId);
  usePostRealtimeUpdates(route.params.postId);
  const profile = useAuthStore((state) => state.profile);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [optionsSheetOpen, setOptionsSheetOpen] = useState(false);
  const commentInputRef = useRef<TextInput>(null);
  const saveMutation = useOptimisticPostSave();
  const shareMutation = useRecordPostShare();
  const deletePostMutation = useDeletePost();
  const likeCommentMutation = useOptimisticCommentLike(route.params.postId);
  const deleteCommentMutation = useDeleteComment(route.params.postId);
  const highlightedCommentId = route.params.commentId;
  const openAuthor = () => {
    if (!post) return;
    if (post.author.id.startsWith('page-')) {
      navigation.navigate('PageDetail', { communityId: post.author.id });
      return;
    }
    navigation.navigate('UserProfile', { userId: post.author.id });
  };
  const reportPost = () => {
    if (!post) return;
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
  return (
    <Screen
      keyboard
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl
          refreshing={postRefetching || commentsRefetching}
          onRefresh={() => void Promise.all([refetchPost(), refetchComments()])}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Post</AppText>
        <View style={{ width: 40 }} />
      </View>
      {postLoading ? <ActivityIndicator color={colors.orange[500]} style={styles.loader} /> : null}
      {postIsError ? (
        <View style={styles.state}>
          <AppText variant="h4">Could not load post</AppText>
          <AppText variant="bodyMuted" style={styles.stateText}>
            {postError instanceof Error ? postError.message : 'Please try again.'}
          </AppText>
          <Button size="sm" onPress={() => void refetchPost()}>Retry</Button>
        </View>
      ) : null}
      {!postLoading && !postIsError && !post ? (
        <View style={styles.state}>
          <AppText variant="h4">Post not found</AppText>
          <AppText variant="bodyMuted" style={styles.stateText}>This post may have been deleted.</AppText>
          <Button size="sm" onPress={() => navigation.goBack()}>Go Back</Button>
        </View>
      ) : null}
      {post ? (
        <PostCard
          post={post}
          onAuthorPress={openAuthor}
          onComment={() => commentInputRef.current?.focus()}
          onShare={() => {
            void sharePost(post).then(() => shareMutation.mutate(post.id));
          }}
          onSave={() => saveMutation.mutate({ postId: post.id, saved: post.savedByMe })}
          onMediaPress={() => void openPostMedia(post)}
          onPrimaryAction={() =>
            post.kind === 'stats'
              ? openAuthor()
              : commentInputRef.current?.focus()
          }
          onMore={() => setOptionsSheetOpen(true)}
        />
      ) : null}
      <View style={styles.commentsHeader}>
        <AppText variant="h4">Comments ({comments.length})</AppText>
      </View>
      {commentsLoading ? <ActivityIndicator color={colors.orange[500]} style={styles.loader} /> : null}
      {commentsIsError ? (
        <View style={styles.state}>
          <AppText variant="bodyMuted" style={styles.stateText}>
            {commentsError instanceof Error ? commentsError.message : 'Could not load comments.'}
          </AppText>
          <Button size="sm" onPress={() => void refetchComments()}>Retry</Button>
        </View>
      ) : null}
      {!commentsLoading && !commentsIsError && comments.length === 0 ? (
        <View style={styles.state}>
          <AppText variant="bodyMuted">No comments yet. Start the conversation.</AppText>
        </View>
      ) : null}
      {comments.map((comment) => (
        <Pressable
          key={comment.id}
          accessibilityRole="button"
          style={[
            styles.commentRow,
            comment.parentCommentId ? styles.commentReplyRow : null,
            highlightedCommentId === comment.id ? styles.commentHighlighted : null
          ]}
          onPress={() => {
            setReplyingTo(comment);
            commentInputRef.current?.focus();
          }}
          onLongPress={() => {
            if (comment.author.id !== profile?.id) return;
            Alert.alert('Delete comment', 'Remove your comment?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteCommentMutation.mutate(comment.id) }
            ], { cancelable: true });
          }}
        >
          <Pressable onPress={() => navigation.navigate('UserProfile', { userId: comment.author.id })}>
            <Avatar initials={comment.author.initials} uri={comment.author.avatarUrl} size={36} tone="green" />
          </Pressable>
          <View style={styles.commentBody}>
            <VerifiedName profile={comment.author} style={styles.commentAuthor} numberOfLines={1} />
            <AppText variant="bodyMuted">{comment.body}</AppText>
            <Pressable
              style={styles.commentLike}
              onPress={() => likeCommentMutation.mutate({ commentId: comment.id, liked: Boolean(comment.likedByMe) })}
            >
              <Heart
                size={14}
                color={comment.likedByMe ? colors.orange[400] : colors.text.tertiary}
                fill={comment.likedByMe ? colors.orange[400] : 'transparent'}
              />
              <AppText variant="small">{comment.likes}</AppText>
            </Pressable>
          </View>
        </Pressable>
      ))}
      <CommentInput
        postId={route.params.postId}
        profile={profile}
        replyingTo={replyingTo}
        inputRef={commentInputRef}
        disabled={!post}
        onCancelReply={() => setReplyingTo(null)}
        onSubmitted={() => setReplyingTo(null)}
      />
      <PostOptionsSheet
        open={optionsSheetOpen}
        post={post}
        currentUserId={profile?.id}
        onClose={() => setOptionsSheetOpen(false)}
        onViewAuthor={openAuthor}
        onSaveToggle={() => {
          if (post) saveMutation.mutate({ postId: post.id, saved: post.savedByMe });
        }}
        onViewSavedPosts={() => {
          navigation.navigate('SavedPosts');
        }}
        onShare={() => {
          if (post) void sharePost(post).then(() => shareMutation.mutate(post.id));
        }}
        onReport={reportPost}
        onEdit={() => {
          if (post) navigation.navigate('CreatePost', { editPostId: post.id });
        }}
        onDelete={() => {
          if (post) {
            deletePostMutation.mutate(post.id);
            navigation.goBack();
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0
  },
  header: {
    paddingHorizontal: spacing.screen,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  commentsHeader: {
    paddingHorizontal: spacing.screen,
    marginBottom: 12
  },
  loader: {
    paddingVertical: spacing.xl
  },
  state: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.lg
  },
  stateText: {
    textAlign: 'center'
  },
  commentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    marginBottom: 14
  },
  commentReplyRow: {
    paddingLeft: spacing.screen + 32
  },
  commentHighlighted: {
    borderLeftWidth: 3,
    borderLeftColor: colors.orange[400]
  },
  commentBody: {
    flex: 1,
    backgroundColor: colors.dark[800],
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: 12
  },
  commentAuthor: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 13,
    marginBottom: 2
  },
  commentLike: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8
  },
});
