import { useRef, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Heart } from 'lucide-react-native';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostCard } from '@/components/feed/PostCard';
import { PostOptionsSheet } from '@/components/feed/PostOptionsSheet';
import { CommentInput } from '@/components/social/CommentInput';
import { ReportSheet } from '@/components/moderation/ReportSheet';

import { AppRefreshControl, AppText, Avatar, Button, IconButton, VerifiedName } from '@/components/ui';

import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import { useComments, useDeleteComment, useOptimisticCommentLike, useOptimisticPostSave, usePost, usePostRealtimeUpdates } from '@/hooks/useFeed';
import { usePostActions } from '@/hooks/usePostActions';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import { openPostMedia } from '@/utils/share';
import type { Comment } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'PostDetail'>;

export function PostDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const { colors: theme } = useAppTheme();
  const insets = useSafeAreaInsets();
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
    data: commentsData,
    isLoading: commentsLoading,
    isError: commentsIsError,
    isRefetching: commentsRefetching,
    error: commentsError,
    refetch: refetchComments,
    fetchNextPage: fetchNextComments,
    hasNextPage: hasNextComments,
    isFetchingNextPage: fetchingNextComments
  } = useComments(route.params.postId);
  const comments = Array.isArray(commentsData)
    ? commentsData
    : commentsData?.pages.flatMap((page) => page.comments) ?? [];
  usePostRealtimeUpdates(route.params.postId);
  const profile = useAuthStore((state) => state.profile);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [optionsSheetOpen, setOptionsSheetOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<
    | { type: 'post'; id: string }
    | { type: 'comment'; id: string }
    | null
  >(null);
  const commentInputRef = useRef<TextInput>(null);
  const saveMutation = useOptimisticPostSave();
  const postActions = usePostActions();
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

  /** Post card + comments header rendered as the scrollable list header */
  const ListHeader = (
    <View>
      {postLoading ? <ActivityIndicator color={theme.accent} style={styles.loader} /> : null}
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
          onShare={() => void postActions.share(post)}
          sharePending={postActions.isPending(post.id, 'share')}
          onSave={() => saveMutation.mutate({ postId: post.id, saved: post.savedByMe })}
          onViewLikes={() => navigation.navigate('PostLikes', { postId: post.id })}
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
      {commentsLoading ? <ActivityIndicator color={theme.accent} style={styles.loader} /> : null}
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
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 10}
    >
      {/* Fixed navigation header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top || spacing.lg, backgroundColor: theme.background }
        ]}
      >
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Post</AppText>
        <View style={{ width: 40 }} />
      </View>

      {/* Scrollable post + comments */}
      <FlashList
        data={comments}
        keyExtractor={(comment) => comment.id}
        estimatedItemSize={80}
        ListHeaderComponent={ListHeader}
        refreshControl={
          <AppRefreshControl
            refreshing={postRefetching || commentsRefetching}
            onRefresh={() => void Promise.all([refetchPost(), refetchComments()])}
          />
        }
        onEndReached={() => {
          if (hasNextComments && !fetchingNextComments) void fetchNextComments();
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          fetchingNextComments
            ? <ActivityIndicator color={theme.accent} style={styles.loader} />
            : <View style={{ height: spacing.lg }} />
        }
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: comment }) => (
          <Pressable
            key={comment.id}
            accessibilityRole="button"
            accessibilityLabel={`Comment by ${comment.author.displayName}`}
            style={[
              styles.commentRow,
              comment.parentCommentId ? styles.commentReplyRow : null,
              highlightedCommentId === comment.id
                ? [styles.commentHighlighted, { borderLeftColor: theme.accent }]
                : null
            ]}
            onPress={() => {
              setReplyingTo(comment);
              commentInputRef.current?.focus();
            }}
            onLongPress={() => {
              if (comment.author.id === profile?.id) {
                Alert.alert('Delete comment', 'Remove your comment?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteCommentMutation.mutate(comment.id) }
                ], { cancelable: true });
              } else {
                Alert.alert('Comment options', '', [
                  {
                    text: 'Report comment',
                    onPress: () => setReportTarget({ type: 'comment', id: comment.id })
                  },
                  { text: 'Cancel', style: 'cancel' }
                ], { cancelable: true });
              }
            }}
          >
            <Avatar
              initials={comment.author.initials}
              uri={comment.author.avatarUrl}
              size={36}
              tone="green"
              accessibilityLabel={`View ${comment.author.displayName}'s profile`}
              onPress={() => navigation.navigate('UserProfile', { userId: comment.author.id })}
            />
            <View style={[styles.commentBody, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <VerifiedName
                profile={comment.author}
                style={styles.commentAuthor}
                numberOfLines={1}
                onPress={() => navigation.navigate('UserProfile', { userId: comment.author.id })}
              />
              <AppText variant="bodyMuted">{comment.body}</AppText>
              <Pressable
                style={styles.commentLike}
                onPress={() => likeCommentMutation.mutate({ commentId: comment.id, liked: Boolean(comment.likedByMe) })}
              >
                <Heart
                  size={14}
                  color={comment.likedByMe ? theme.accent : theme.textSubtle}
                  fill={comment.likedByMe ? theme.accent : 'transparent'}
                />
                <AppText variant="small">{comment.likes}</AppText>
              </Pressable>
            </View>
          </Pressable>
        )}
      />

      {/* Comment input bar pinned at bottom, above keyboard */}
      <View
        style={[
          styles.commentInputContainer,
          {
            borderTopColor: theme.border,
            backgroundColor: theme.background,
            paddingBottom: insets.bottom || spacing.md,
          }
        ]}
      >
        <CommentInput
          postId={route.params.postId}
          profile={profile}
          replyingTo={replyingTo}
          inputRef={commentInputRef}
          disabled={!post}
          onCancelReply={() => setReplyingTo(null)}
          onSubmitted={() => setReplyingTo(null)}
        />
      </View>

      <PostOptionsSheet
        open={optionsSheetOpen}
        post={post}
        currentUserId={profile?.id}
        actionPending={post ? postActions.isPending(post.id) : false}
        onClose={() => setOptionsSheetOpen(false)}
        onViewAuthor={openAuthor}
        onSaveToggle={() => {
          if (post) saveMutation.mutate({ postId: post.id, saved: post.savedByMe });
        }}
        onViewSavedPosts={() => {
          navigation.navigate('SavedPosts');
        }}
        onShare={() => {
          if (post) void postActions.share(post);
        }}
        onReport={() => { if (post) setReportTarget({ type: 'post', id: post.id }); }}
        onEdit={() => {
          if (post) {
            navigation.navigate('CreatePost', {
              editPostId: post.id,
              communityId: post.communityId ?? undefined
            });
          }
        }}
        onDelete={() => {
          if (post) {
            void postActions.deletePost(post.id, navigation.goBack);
          }
        }}
      />
      <ReportSheet
        open={reportTarget !== null}
        entityLabel={reportTarget?.type === 'comment' ? 'comment' : 'post'}
        entityType={reportTarget?.type ?? 'post'}
        entityId={reportTarget?.id ?? ''}
        onClose={() => setReportTarget(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentsHeader: {
    paddingHorizontal: spacing.screen,
    marginBottom: 12,
  },
  loader: {
    paddingVertical: spacing.xl,
  },
  state: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.lg,
  },
  stateText: {
    textAlign: 'center',
  },
  commentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    marginBottom: 14,
  },
  commentReplyRow: {
    paddingLeft: spacing.screen + 32,
  },
  commentHighlighted: {
    borderLeftWidth: 3,
    borderLeftColor: colors.orange[400],
  },
  commentBody: {
    flex: 1,
    backgroundColor: colors.dark[800],
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: 12,
  },
  commentAuthor: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 13,
    marginBottom: 2,
  },
  commentLike: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  commentInputContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
});

