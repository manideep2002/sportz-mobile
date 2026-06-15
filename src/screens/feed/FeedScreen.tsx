import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, MapPin, Search, Users } from 'lucide-react-native';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { PostCard } from '@/components/feed/PostCard';
import { StoryRail } from '@/components/feed/StoryRail';
import { AppText, Avatar, Button, Chip, IconButton, SectionHeader } from '@/components/ui';
import { sportsFilters } from '@/data/mockData';
import { colors, spacing } from '@/design/tokens';
import { useDeletePost, useInfiniteFeed, useOptimisticPostLike, useOptimisticPostSave } from '@/hooks/useFeed';
import { useStories } from '@/hooks/useStories';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import { openPostMedia, sharePost } from '@/utils/share';
import type { Post } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function FeedScreen() {
  const navigation = useNavigation<Navigation>();
  const profile = useAuthStore((state) => state.profile);
  const [selectedSport, setSelectedSport] = useState<(typeof sportsFilters)[number]>('All');
  const { data, isLoading, isRefetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteFeed();
  const { data: stories = [], refetch: refetchStories } = useStories();
  const feed = data?.pages.flatMap((page) => page.items) ?? [];
  const filteredFeed = selectedSport === 'All' ? feed : feed.filter((post) => post.sport === selectedSport);
  const likeMutation = useOptimisticPostLike();
  const saveMutation = useOptimisticPostSave();
  const deletePostMutation = useDeletePost();
  const refreshFeed = () => void Promise.all([refetch(), refetchStories()]);
  
  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Good night';
  };
  const openPost = (postId: string) => navigation.navigate('PostDetail', { postId });
  const openAuthor = (post: Post) => {
    if (post.author.id.startsWith('page-')) {
      navigation.navigate('PageDetail', { communityId: post.author.id });
      return;
    }
    navigation.navigate('UserProfile', { userId: post.author.id });
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={filteredFeed}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refreshFeed}
            tintColor={colors.orange[500]}
            colors={[colors.orange[500]]}
          />
        }
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        ListHeaderComponent={
          <>
      <View style={styles.topBar}>
        <View>
          <AppText variant="caption">{getGreeting()}</AppText>
          <AppText variant="h2">
            {profile?.displayName.split(' ')[0] ?? 'Athlete'} <AppText variant="h2" color={colors.orange[500]}>.</AppText>
          </AppText>
        </View>
        <View style={styles.topActions}>
          <IconButton icon={Bell} accessibilityLabel="Notifications" onPress={() => navigation.navigate('Notifications')} />
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => navigation.navigate('MainTabs', { screen: 'ProfileTab' })}>
            <Avatar initials={profile?.initials ?? 'MK'} online size={40} />
          </Pressable>
        </View>
      </View>

      <Pressable accessibilityRole="button" style={styles.search} onPress={() => navigation.navigate('Search')}>
        <Search size={16} color={colors.text.tertiary} />
        <AppText style={styles.searchText}>Search players, events, courts...</AppText>
      </Pressable>

      <View style={styles.quickRow}>
        <Button variant="dark" size="sm" icon={MapPin} onPress={() => navigation.navigate('Courts')}>
          Courts
        </Button>
        <Button variant="dark" size="sm" icon={Users} onPress={() => navigation.navigate('Community')}>
          Community
        </Button>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {sportsFilters.map((sport) => (
          <Chip key={sport} selected={sport === selectedSport} onPress={() => setSelectedSport(sport)}>
            {sport}
          </Chip>
        ))}
      </ScrollView>

      <StoryRail
        stories={stories}
        onCreateStory={() => navigation.navigate('CreateStory')}
        onOpenStory={(storyId) => navigation.navigate('StoryViewer', { storyId })}
      />

      <View style={styles.sectionHeader}>
        <SectionHeader title={selectedSport === 'All' ? 'For You' : selectedSport} action="Refresh" onAction={refreshFeed} />
      </View>

      {isLoading ? <ActivityIndicator color={colors.orange[500]} style={styles.loader} /> : null}
      {!isLoading && filteredFeed.length === 0 ? (
        <View style={styles.empty}>
          <AppText variant="h4">No {selectedSport} posts yet</AppText>
          <AppText variant="bodyMuted">Try another sport or refresh the feed.</AppText>
        </View>
      ) : null}
          </>
        }
        renderItem={({ item: post }) => (
        <PostCard
          key={post.id}
          post={post}
          onPress={() => openPost(post.id)}
          onAuthorPress={() => openAuthor(post)}
          onLike={() => likeMutation.mutate({ postId: post.id, liked: post.likedByMe })}
          onComment={() => openPost(post.id)}
          onShare={() => void sharePost(post)}
          onSave={() => saveMutation.mutate({ postId: post.id, saved: post.savedByMe })}
          onMediaPress={() => void openPostMedia(post)}
          onPrimaryAction={() =>
            post.kind === 'stats'
              ? openAuthor(post)
              : openPost(post.id)
          }
          onMore={() => {
            const isOwnPost = post.author.id === profile?.id;
            Alert.alert('Post options', `Choose an action for ${post.author.displayName}'s post.`, [
              { text: post.author.id.startsWith('page-') ? 'View page' : 'View athlete', onPress: () => openAuthor(post) },
              { text: post.savedByMe ? 'Unsave' : 'Save', onPress: () => saveMutation.mutate({ postId: post.id, saved: post.savedByMe }) },
              { text: 'Share', onPress: () => void sharePost(post) },
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
                      onPress: () => deletePostMutation.mutate(post.id)
                    }
                  ]
                )
              }] : []),
              { text: 'Cancel', style: 'cancel' }
            ]);
          }}
        />
        )}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.orange[500]} style={styles.loader} /> : <View style={styles.footer} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.dark[950]
  },
  listContent: {
    paddingTop: 52,
    paddingBottom: 104
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingTop: 4,
    paddingBottom: 10
  },
  topActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center'
  },
  search: {
    marginHorizontal: spacing.screen,
    marginBottom: 14,
    backgroundColor: colors.dark[800],
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700]
  },
  searchText: {
    color: colors.text.tertiary,
    fontSize: 14
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    marginBottom: 14
  },
  chips: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 18
  },
  sectionHeader: {
    paddingHorizontal: spacing.screen
  },
  loader: {
    paddingVertical: spacing.xl
  },
  empty: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.xl
  },
  footer: {
    height: 10
  }
});
