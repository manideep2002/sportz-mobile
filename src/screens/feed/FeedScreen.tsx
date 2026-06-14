import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, MapPin, Search, Users } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LiveMatchBanner } from '@/components/feed/LiveMatchBanner';
import { PostCard } from '@/components/feed/PostCard';
import { StoryRail } from '@/components/feed/StoryRail';
import { AppText, Avatar, Button, Chip, IconButton, SectionHeader } from '@/components/ui';
import { events, sportsFilters } from '@/data/mockData';
import { colors, spacing } from '@/design/tokens';
import { useInfiniteFeed, useOptimisticPostLike } from '@/hooks/useFeed';
import { useStories } from '@/hooks/useStories';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function FeedScreen() {
  const navigation = useNavigation<Navigation>();
  const profile = useAuthStore((state) => state.profile);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteFeed();
  const { data: stories = [] } = useStories();
  const feed = data?.pages.flatMap((page) => page.items) ?? [];
  const likeMutation = useOptimisticPostLike();

  return (
    <View style={styles.root}>
      <FlatList
        data={feed}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        ListHeaderComponent={
          <>
      <View style={styles.topBar}>
        <View>
          <AppText variant="caption">Good morning</AppText>
          <AppText variant="h2">
            {profile?.displayName.split(' ')[0] ?? 'Athlete'} <AppText variant="h2" color={colors.orange[500]}>.</AppText>
          </AppText>
        </View>
        <View style={styles.topActions}>
          <IconButton icon={Bell} onPress={() => navigation.navigate('Notifications')} />
          <Pressable onPress={() => navigation.navigate('MainTabs', { screen: 'ProfileTab' })}>
            <Avatar initials={profile?.initials ?? 'MK'} online size={40} />
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.search} onPress={() => navigation.navigate('Search')}>
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
        {sportsFilters.map((sport, index) => (
          <Chip key={sport} selected={index === 0}>
            {sport}
          </Chip>
        ))}
      </ScrollView>

      <StoryRail
        stories={stories}
        onCreateStory={() => navigation.navigate('CreateStory')}
        onOpenStory={(storyId) => navigation.navigate('StoryViewer', { storyId })}
      />

      <View style={styles.section}>
        <LiveMatchBanner event={events[0]} onPress={() => navigation.navigate('EventDetail', { eventId: events[0].id })} />
      </View>

      <View style={styles.sectionHeader}>
        <SectionHeader title="For You" action="Fresh plays" />
      </View>

      {isLoading ? <ActivityIndicator color={colors.orange[500]} style={styles.loader} /> : null}
          </>
        }
        renderItem={({ item: post }) => (
        <PostCard
          key={post.id}
          post={post}
          onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
          onAuthorPress={() => navigation.navigate('UserProfile', { userId: post.author.id })}
          onLike={() => likeMutation.mutate({ postId: post.id, liked: post.likedByMe })}
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
  section: {
    paddingHorizontal: spacing.screen,
    marginTop: 18,
    marginBottom: 20
  },
  sectionHeader: {
    paddingHorizontal: spacing.screen
  },
  loader: {
    paddingVertical: spacing.xl
  },
  footer: {
    height: 10
  }
});
