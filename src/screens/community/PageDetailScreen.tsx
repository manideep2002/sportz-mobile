import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, MoreHorizontal, Share2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Alert, RefreshControl, Share, StyleSheet, View } from 'react-native';

import { PostCard } from '@/components/feed/PostCard';
import { AppText, Badge, Button, IconButton, Screen } from '@/components/ui';
import { colors, spacing } from '@/design/tokens';
import { useCommunity, useJoinCommunity, useLeaveCommunity } from '@/hooks/useCommunities';
import { useCommunityPosts } from '@/hooks/useFeed';
import type { AppStackParamList } from '@/navigation/routes';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'PageDetail'>;

export function PageDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { data: community, isLoading, isError, isRefetching, error, refetch } = useCommunity(route.params.communityId);
  const {
    data: posts = [],
    isLoading: postsLoading,
    isError: postsIsError,
    isRefetching: postsRefetching,
    refetch: refetchPosts
  } = useCommunityPosts(route.params.communityId);
  const followPage = useJoinCommunity(route.params.communityId);
  const unfollowPage = useLeaveCommunity(route.params.communityId);

  if (isLoading) {
    return (
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.orange[500]}
            colors={[colors.orange[500]]}
          />
        }
      >
        <View style={styles.fallback}>
          <ActivityIndicator color={colors.orange[500]} />
        </View>
      </Screen>
    );
  }

  if (isError || !community) {
    return (
      <Screen contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        </View>
        <View style={styles.fallback}>
          <AppText variant="h4">{isError ? 'Could not load page' : 'Page not found'}</AppText>
          <AppText variant="bodyMuted" style={styles.fallbackText}>
            {error instanceof Error ? error.message : 'This community page may have been removed.'}
          </AppText>
          {isError ? (
            <Button size="sm" onPress={() => void refetch()}>Retry</Button>
          ) : (
            <Button size="sm" onPress={() => navigation.goBack()}>Go Back</Button>
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching || postsRefetching}
          onRefresh={() => void Promise.all([refetch(), refetchPosts()])}
          tintColor={colors.orange[500]}
          colors={[colors.orange[500]]}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }} />
        <IconButton
          icon={MoreHorizontal}
          accessibilityLabel="Page options"
          onPress={() => void Share.share({ message: `Follow ${community.name} on SPORTZ.` })}
        />
      </View>
      <LinearGradient colors={['#1A0800', colors.orange[600], '#1A0800']} style={styles.cover}>
        <AppText variant="h1" color={colors.light[0]}>
          {community.name.substring(0, 4).toUpperCase()}
        </AppText>
      </LinearGradient>
      <View style={styles.body}>
        <AppText variant="h2">{community.name}</AppText>
        <AppText variant="bodyMuted">Official Page - {community.sport}</AppText>
        <View style={styles.badges}>
          {community.isVerified && <Badge tone="blue">Verified</Badge>}
          <Badge>{community.followerCount} followers</Badge>
        </View>
        <AppText variant="bodyMuted">{community.description}</AppText>
        <View style={styles.actions}>
          <Button
            variant={community.isMember ? 'dark' : 'primary'}
            style={styles.actionButton}
            loading={followPage.isPending || unfollowPage.isPending}
            onPress={() => {
              if (community.isMember) {
                unfollowPage.mutate(undefined, {
                  onError: (error) => {
                    Alert.alert('Unfollow failed', error instanceof Error ? error.message : 'Please try again.');
                  }
                });
              } else {
                followPage.mutate('follower', {
                  onError: (error) => {
                    Alert.alert('Follow failed', error instanceof Error ? error.message : 'Please try again.');
                  }
                });
              }
            }}
          >
            {community.isMember ? 'Following' : 'Follow'}
          </Button>
          {community.isAdmin ? (
            <Button style={styles.actionButton} onPress={() => navigation.navigate('CreatePost', { communityId: community.id })}>New Post</Button>
          ) : null}
          <IconButton icon={Share2} onPress={() => void Share.share({ message: `Follow ${community.name} on SPORTZ.` })} />
        </View>
        <AppText variant="h4">Latest Posts</AppText>
        {postsLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}
        {postsIsError ? (
          <View style={styles.fallbackInline}>
            <AppText variant="bodyMuted">Could not load posts.</AppText>
            <Button size="sm" onPress={() => void refetchPosts()}>Retry</Button>
          </View>
        ) : null}
        {!postsLoading && !postsIsError && posts.length === 0 ? (
          <AppText variant="bodyMuted">No page posts yet.</AppText>
        ) : null}
      </View>
      {posts.slice(0, 3).map((post) => (
        <PostCard key={post.id} post={post} onPress={() => navigation.navigate('PostDetail', { postId: post.id })} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screen,
    gap: spacing.sm,
    zIndex: 2
  },
  cover: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -52
  },
  body: {
    padding: spacing.screen,
    gap: spacing.sm
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl
  },
  fallbackInline: {
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.md
  },
  fallbackText: {
    textAlign: 'center'
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap'
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center'
  },
  actionButton: {
    flex: 1
  }
});
