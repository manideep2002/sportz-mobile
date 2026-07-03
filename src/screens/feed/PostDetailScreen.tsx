import { useRef, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Heart, Send } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { PostCard } from '@/components/feed/PostCard';
import { PostOptionsSheet } from '@/components/feed/PostOptionsSheet';
import { AppText, Avatar, Button, IconButton, Input, Screen } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import { useComments, useCreateComment, useDeleteComment, useDeletePost, useOptimisticCommentLike, useOptimisticPostLike, useOptimisticPostSave, usePost, useRecordPostShare } from '@/hooks/useFeed';
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
  const profile = useAuthStore((state) => state.profile);
  const [commentBody, setCommentBody] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [optionsSheetOpen, setOptionsSheetOpen] = useState(false);
  const commentInputRef = useRef<TextInput>(null);
  const createComment = useCreateComment(route.params.postId);
  const likeMutation = useOptimisticPostLike();
  const saveMutation = useOptimisticPostSave();
  const shareMutation = useRecordPostShare();
  const deletePostMutation = useDeletePost();
  const likeCommentMutation = useOptimisticCommentLike(route.params.postId);
  const deleteCommentMutation = useDeleteComment(route.params.postId);
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
  const submitComment = async () => {
    const body = commentBody.trim();
    if (!body || !post) return;

    try {
      setCommentBody('');
      await createComment.mutateAsync({ body, parentCommentId: replyingTo?.id });
      setReplyingTo(null);
    } catch (error) {
      setCommentBody(body);
      Alert.alert('Could not comment', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <Screen
      keyboard
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={postRefetching || commentsRefetching}
          onRefresh={() => void Promise.all([refetchPost(), refetchComments()])}
          tintColor={colors.orange[500]}
          colors={[colors.orange[500]]}
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
          onLike={() => likeMutation.mutate({ postId: post.id, liked: post.likedByMe })}
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
          style={[styles.commentRow, comment.parentCommentId ? styles.commentReplyRow : null]}
          onPress={() => {
            setReplyingTo(comment);
            setCommentBody(`@${comment.author.username} `);
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
            <AppText style={styles.commentAuthor}>{comment.author.displayName}</AppText>
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
      <View style={styles.commentInput}>
        <Avatar initials={profile?.initials ?? 'MK'} uri={profile?.avatarUrl} size={36} />
        <View style={styles.inputWrap}>
          {replyingTo ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setReplyingTo(null);
                setCommentBody('');
              }}
            >
              <AppText variant="small" style={styles.replyingTo}>
                Replying to {replyingTo.author.displayName}
              </AppText>
            </Pressable>
          ) : null}
          <Input
            ref={commentInputRef}
            value={commentBody}
            onChangeText={setCommentBody}
            placeholder="Add a comment..."
            returnKeyType="send"
            onSubmitEditing={() => void submitComment()}
          />
        </View>
        <IconButton
          icon={Send}
          accessibilityLabel="Send comment"
          filled
          size={40}
          disabled={!commentBody.trim() || createComment.isPending || !post}
          accessibilityState={{ disabled: !commentBody.trim() || createComment.isPending || !post }}
          onPress={() => void submitComment()}
        />
      </View>
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
  commentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    marginTop: 16
  },
  inputWrap: {
    flex: 1
  },
  replyingTo: {
    color: colors.orange[300],
    marginBottom: 4
  }
});
