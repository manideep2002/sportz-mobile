import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Bookmark, ChevronLeft } from 'lucide-react-native';

import { PostCard } from '@/components/feed/PostCard';

import { AppRefreshControl, AppText, Button, IconButton, Screen } from '@/components/ui';

import { colors, spacing } from '@/design/tokens';
import { useOptimisticPostLike, useOptimisticPostSave, useSavedPosts } from '@/hooks/useFeed';
import type { AppStackParamList } from '@/navigation/routes';
import { openPostMedia, sharePost } from '@/utils/share';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function SavedPostsScreen() {
  const navigation = useNavigation<Navigation>();
  const { data: posts = [], isLoading, isError, isRefetching, refetch } = useSavedPosts();
  const likeMutation = useOptimisticPostLike();
  const saveMutation = useOptimisticPostSave();

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Saved Posts</AppText>
        <View style={{ width: 40 }} />
      </View>
      {isLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}
      {isError ? (
        <View style={styles.empty}>
          <AppText variant="h4">Could not load saved posts</AppText>
          <Button size="sm" onPress={() => void refetch()}>Retry</Button>
        </View>
      ) : null}
      {!isLoading && !isError && posts.length === 0 ? (
        <View style={styles.empty}>
          <Bookmark size={34} color={colors.text.tertiary} />
          <AppText variant="h4">No saved posts yet</AppText>
          <AppText variant="bodyMuted" style={styles.centerText}>Save posts from the feed to revisit them here.</AppText>
        </View>
      ) : null}
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
          onAuthorPress={() => navigation.navigate('UserProfile', { userId: post.author.id })}
          onLike={() => likeMutation.mutate({ postId: post.id, liked: post.likedByMe })}
          onComment={() => navigation.navigate('PostDetail', { postId: post.id })}
          onShare={() => void sharePost(post)}
          onSave={() => saveMutation.mutate({ postId: post.id, saved: post.savedByMe })}
          onMediaPress={() => void openPostMedia(post)}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0,
    gap: spacing.md
  },
  header: {
    paddingHorizontal: spacing.screen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl
  },
  centerText: {
    textAlign: 'center'
  }
});
