import { useRef, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Heart, Send } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PostCard } from '@/components/feed/PostCard';
import { AppText, Avatar, IconButton, Input, Screen } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import { useComments, useCreateComment, useDeleteComment, useDeletePost, useOptimisticCommentLike, useOptimisticPostLike, useOptimisticPostSave, usePost } from '@/hooks/useFeed';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import { reportReasons, reportService } from '@/services/reportService';
import { openPostMedia, sharePost } from '@/utils/share';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'PostDetail'>;

export function PostDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { data: post, isLoading: postLoading } = usePost(route.params.postId);
  const { data: comments = [] } = useComments(route.params.postId);
  const profile = useAuthStore((state) => state.profile);
  const [commentBody, setCommentBody] = useState('');
  const commentInputRef = useRef<TextInput>(null);
  const createComment = useCreateComment(route.params.postId);
  const likeMutation = useOptimisticPostLike();
  const saveMutation = useOptimisticPostSave();
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
    ]);
  };
  const submitComment = async () => {
    const body = commentBody.trim();
    if (!body) return;

    try {
      setCommentBody('');
      await createComment.mutateAsync(body);
    } catch (error) {
      setCommentBody(body);
      Alert.alert('Could not comment', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <Screen keyboard contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Post</AppText>
        <View style={{ width: 40 }} />
      </View>
      {postLoading ? <ActivityIndicator color={colors.orange[500]} style={styles.loader} /> : null}
      {post ? (
        <PostCard
          post={post}
          onAuthorPress={openAuthor}
          onLike={() => likeMutation.mutate({ postId: post.id, liked: post.likedByMe })}
          onComment={() => commentInputRef.current?.focus()}
          onShare={() => void sharePost(post)}
          onSave={() => saveMutation.mutate({ postId: post.id, saved: post.savedByMe })}
          onMediaPress={() => void openPostMedia(post)}
          onPrimaryAction={() =>
            post.kind === 'stats'
              ? openAuthor()
              : commentInputRef.current?.focus()
          }
          onMore={() => {
            const isOwnPost = post.author.id === profile?.id;
            Alert.alert('Post options', `Choose an action for ${post.author.displayName}'s post.`, [
              { text: post.author.id.startsWith('page-') ? 'View page' : 'View athlete', onPress: openAuthor },
              { text: post.savedByMe ? 'Unsave' : 'Save', onPress: () => saveMutation.mutate({ postId: post.id, saved: post.savedByMe }) },
              { text: 'View Saved Posts', onPress: () => navigation.navigate('SavedPosts') },
              { text: 'Share', onPress: () => void sharePost(post) },
              { text: 'Report Post', onPress: reportPost },
              ...(isOwnPost ? [{
                text: 'Delete',
                style: 'destructive' as const,
                onPress: () => Alert.alert(
                  'Delete Post',
                  'Are you sure you want to delete this post? This action cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => {
                        deletePostMutation.mutate(post.id);
                        navigation.goBack();
                      }
                    }
                  ]
                )
              }] : []),
              { text: 'Cancel', style: 'cancel' }
            ]);
          }}
        />
      ) : null}
      <View style={styles.commentsHeader}>
        <AppText variant="h4">Comments ({comments.length})</AppText>
      </View>
      {comments.map((comment) => (
        <Pressable
          key={comment.id}
          accessibilityRole="button"
          style={styles.commentRow}
          onPress={() => {
            setCommentBody(`@${comment.author.username} `);
            commentInputRef.current?.focus();
          }}
          onLongPress={() => {
            if (comment.author.id !== profile?.id) return;
            Alert.alert('Delete comment', 'Remove your comment?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteCommentMutation.mutate(comment.id) }
            ]);
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
          disabled={!commentBody.trim() || createComment.isPending}
          onPress={() => void submitComment()}
        />
      </View>
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
  commentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    marginBottom: 14
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
  }
});
