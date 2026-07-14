import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Bell, MapPin, Search, Users } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LiveMatchBanner } from '@/components/feed/LiveMatchBanner';
import { PostCard } from '@/components/feed/PostCard';
import { PostOptionsSheet } from '@/components/feed/PostOptionsSheet';
import { StoryRail } from '@/components/feed/StoryRail';

import { AppRefreshControl, AppText, Button, Chip, IconButton, SectionHeader } from '@/components/ui';

import { sportsFilters } from '@/constants/sports';
import { colors, spacing } from '@/design/tokens';
import { useDeletePost, useInfiniteFeed, useOptimisticPostSave, useRecordPostShare } from '@/hooks/useFeed';
import { useStories } from '@/hooks/useStories';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import { eventService } from '@/services/eventService';
import { blockService, toBlockedIdSet } from '@/services/blockService';
import { feedDedupeService } from '@/services/feedDedupeService';
import { reportReasons, reportService } from '@/services/reportService';
import { openPostMedia, sharePost } from '@/utils/share';
import type { Post } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function FeedScreen() {
  const navigation = useNavigation<Navigation>();
  const profile = useAuthStore((state) => state.profile);
  const [selectedSport, setSelectedSport] = useState<(typeof sportsFilters)[number]>('All');
  const [activeOptionsPost, setActiveOptionsPost] = useState<Post | null>(null);
  const { data, isLoading, isError, error, isRefetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteFeed();
  const { data: stories = [], refetch: refetchStories, isRefetching: storiesRefetching } = useStories();
  const { data: liveEvents = [], refetch: refetchLiveEvents, isRefetching: liveEventsRefetching } = useQuery({
    queryKey: ['events', 'live'],
    queryFn: eventService.listLiveEvents
  });
  const { data: blockedIds = [], refetch: refetchBlockedIds, isRefetching: blockedIdsRefetching } = useQuery({
    queryKey: ['blocks', 'ids'],
    queryFn: blockService.listBlockedIds
  });
  const blockedIdSet = toBlockedIdSet(blockedIds);
  const feed = feedDedupeService
    .keepUnique(data?.pages.flatMap((page) => page.items) ?? [], (post) => post.id)
    .filter((post) => !blockedIdSet.has(post.author.id));
  const filteredFeed = selectedSport === 'All' ? feed : feed.filter((post) => post.sport === selectedSport);
  const saveMutation = useOptimisticPostSave();
  const shareMutation = useRecordPostShare();
  const deletePostMutation = useDeletePost();
  const refreshFeed = () => void Promise.all([
    refetch(),
    refetchStories(),
    refetchLiveEvents(),
    refetchBlockedIds()
  ]);
  
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
  const reportPost = (post: Post) => {
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
    <View style={styles.root}>
      <FlashList
        data={filteredFeed}
        keyExtractor={(item) => item.id}
        extraData={selectedSport}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        bounces
        overScrollMode="always"
        contentContainerStyle={styles.listContent}
        refreshControl={
          <AppRefreshControl
            refreshing={isRefetching || storiesRefetching || liveEventsRefetching || blockedIdsRefetching}
            onRefresh={refreshFeed}
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

      {liveEvents[0] ? (
        <View style={styles.liveBanner}>
          <LiveMatchBanner event={liveEvents[0]} onPress={() => navigation.navigate('EventDetail', { eventId: liveEvents[0].id })} />
        </View>
      ) : null}

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
      {isError ? (
        <View style={styles.empty}>
          <AppText variant="h4">Could not load posts</AppText>
          <AppText variant="bodyMuted">{error instanceof Error ? error.message : 'Pull down to retry.'}</AppText>
        </View>
      ) : null}
      {!isLoading && !isError && filteredFeed.length === 0 ? (
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
          onComment={() => openPost(post.id)}
          onShare={() => {
            void sharePost(post).then(() => shareMutation.mutate(post.id));
          }}
          onSave={() => saveMutation.mutate({ postId: post.id, saved: post.savedByMe })}
          onMediaPress={() => void openPostMedia(post)}
          onPrimaryAction={() =>
            post.kind === 'stats'
              ? openAuthor(post)
              : openPost(post.id)
          }
          onMore={() => setActiveOptionsPost(post)}
        />
        )}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.orange[500]} style={styles.loader} /> : <View style={styles.footer} />}
      />
      <PostOptionsSheet
        open={activeOptionsPost !== null}
        post={activeOptionsPost}
        currentUserId={profile?.id}
        onClose={() => setActiveOptionsPost(null)}
        onViewAuthor={() => {
          if (activeOptionsPost) openAuthor(activeOptionsPost);
        }}
        onSaveToggle={() => {
          if (activeOptionsPost) {
            saveMutation.mutate({ postId: activeOptionsPost.id, saved: activeOptionsPost.savedByMe });
          }
        }}
        onViewSavedPosts={() => {
          navigation.navigate('SavedPosts');
        }}
        onShare={() => {
          if (activeOptionsPost) {
            void sharePost(activeOptionsPost).then(() => shareMutation.mutate(activeOptionsPost.id));
          }
        }}
        onReport={() => {
          if (activeOptionsPost) reportPost(activeOptionsPost);
        }}
        onEdit={() => {
          if (activeOptionsPost) navigation.navigate('CreatePost', { editPostId: activeOptionsPost.id });
        }}
        onDelete={() => {
          if (activeOptionsPost) deletePostMutation.mutate(activeOptionsPost.id);
        }}
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
    flexGrow: 1,
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
  liveBanner: {
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
