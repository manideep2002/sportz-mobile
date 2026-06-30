import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, MoreHorizontal, Share2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Share, StyleSheet, View } from 'react-native';

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
  const { data: community, isLoading } = useCommunity(route.params.communityId);
  const { data: posts = [] } = useCommunityPosts(route.params.communityId);
  const followPage = useJoinCommunity(route.params.communityId);
  const unfollowPage = useLeaveCommunity(route.params.communityId);

  if (isLoading || !community) {
    return (
      <Screen contentContainerStyle={styles.content}>
        <AppText>Loading...</AppText>
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.content}>
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
              if (community.isMember) unfollowPage.mutate();
              else followPage.mutate('follower');
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
