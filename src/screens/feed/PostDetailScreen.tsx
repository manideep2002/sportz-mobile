import { useRef, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Send } from 'lucide-react-native';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { PostCard } from '@/components/feed/PostCard';
import { AppText, Avatar, IconButton, Input, Screen } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import { useComments, useCreateComment, useOptimisticPostLike, usePost } from '@/hooks/useFeed';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import { openPostMedia, sharePost } from '@/utils/share';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'PostDetail'>;

export function PostDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { data: post } = usePost(route.params.postId);
  const { data: comments = [] } = useComments(route.params.postId);
  const profile = useAuthStore((state) => state.profile);
  const [commentBody, setCommentBody] = useState('');
  const commentInputRef = useRef<TextInput>(null);
  const createComment = useCreateComment(route.params.postId);
  const likeMutation = useOptimisticPostLike();
  const openAuthor = () => {
    if (!post) return;
    if (post.author.id.startsWith('page-')) {
      navigation.navigate('PageDetail', { communityId: post.author.id });
      return;
    }
    navigation.navigate('UserProfile', { userId: post.author.id });
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
      {post ? (
        <PostCard
          post={post}
          onAuthorPress={openAuthor}
          onLike={() => likeMutation.mutate({ postId: post.id, liked: post.likedByMe })}
          onComment={() => commentInputRef.current?.focus()}
          onShare={() => void sharePost(post)}
          onMediaPress={() => void openPostMedia(post)}
          onPrimaryAction={() =>
            post.kind === 'stats'
              ? openAuthor()
              : commentInputRef.current?.focus()
          }
          onMore={() =>
            Alert.alert('Post options', `Choose an action for ${post.author.displayName}'s post.`, [
              { text: post.author.id.startsWith('page-') ? 'View page' : 'View athlete', onPress: openAuthor },
              { text: 'Share', onPress: () => void sharePost(post) },
              { text: 'Cancel', style: 'cancel' }
            ])
          }
        />
      ) : null}
      <View style={styles.commentsHeader}>
        <AppText variant="h4">Comments ({comments.length})</AppText>
      </View>
      {comments.map((comment) => (
        <View key={comment.id} style={styles.commentRow}>
          <Avatar initials={comment.author.initials} size={36} tone="green" />
          <View style={styles.commentBody}>
            <AppText style={styles.commentAuthor}>{comment.author.displayName}</AppText>
            <AppText variant="bodyMuted">{comment.body}</AppText>
          </View>
        </View>
      ))}
      <View style={styles.commentInput}>
        <Avatar initials={profile?.initials ?? 'MK'} size={36} />
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
