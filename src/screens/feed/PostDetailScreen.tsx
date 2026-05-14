import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Send } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { PostCard } from '@/components/feed/PostCard';
import { AppText, Avatar, IconButton, Input, Screen } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import { useComments, useOptimisticPostLike, usePost } from '@/hooks/useFeed';
import type { AppStackParamList } from '@/navigation/routes';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'PostDetail'>;

export function PostDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { data: post } = usePost(route.params.postId);
  const { data: comments = [] } = useComments(route.params.postId);
  const likeMutation = useOptimisticPostLike();

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Post</AppText>
        <View style={{ width: 40 }} />
      </View>
      {post ? <PostCard post={post} onLike={() => likeMutation.mutate({ postId: post.id, liked: post.likedByMe })} /> : null}
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
        <Avatar initials="MK" size={36} />
        <View style={styles.inputWrap}>
          <Input placeholder="Add a comment..." />
        </View>
        <IconButton icon={Send} filled size={40} />
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
