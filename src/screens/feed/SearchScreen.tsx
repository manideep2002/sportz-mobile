import { useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Search } from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View
} from 'react-native';

import {
  AppRefreshControl,
  AppText,
  Avatar,
  Badge,
  Button,
  Chip,
  IconButton,
  Input,
  Screen,
  SectionHeader,
  VerifiedName
} from '@/components/ui';

import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import { useSearch, useTrendingTags } from '@/hooks/useSearch';
import type { AppStackParamList } from '@/navigation/routes';
import type { SearchResult } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const filters = ['All', 'Players', 'Events', 'Groups', 'Pages', 'Courts'] as const;
type FilterLabel = (typeof filters)[number];

const filterTypes: Record<FilterLabel, SearchResult['type'] | undefined> = {
  All: undefined,
  Players: 'player',
  Events: 'event',
  Groups: 'group',
  Pages: 'page',
  Courts: 'court'
};

function navigateToResult(navigation: Navigation, result: SearchResult) {
  switch (result.type) {
    case 'player':
      navigation.navigate('UserProfile', { userId: result.id });
      break;
    case 'event':
      navigation.navigate('EventDetail', { eventId: result.id });
      break;
    case 'group':
      navigation.navigate('GroupDetail', { communityId: result.id });
      break;
    case 'page':
      navigation.navigate('PageDetail', { communityId: result.id });
      break;
    case 'court':
      navigation.navigate('CourtDetail', { courtId: result.id });
      break;
  }
}

export function SearchScreen() {
  const navigation = useNavigation<Navigation>();
  const { colors: theme } = useAppTheme();
  const [query, setQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterLabel>('All');
  const selectedType = filterTypes[selectedFilter];

  const {
    data,
    isFetching,
    isFetchingNextPage,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage
  } = useSearch(query, selectedType);

  const {
    data: trendingTags = [],
    refetch: refetchTrending
  } = useTrendingTags();

  // Flatten pages and deduplicate by id (handles cursor-boundary overlaps).
  const seenIds = new Set<string>();
  const allResults: SearchResult[] = [];
  for (const page of data?.pages ?? []) {
    for (const item of page.items) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        allResults.push(item);
      }
    }
  }

  const isInitialLoading = isFetching && !data;
  const isLoadingMore = isFetchingNextPage;

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRefresh = useCallback(() => {
    void Promise.all([refetch(), refetchTrending()]);
  }, [refetch, refetchTrending]);

  const handleClear = useCallback(() => {
    setQuery('');
    setSelectedFilter('All');
  }, []);

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl
          refreshing={isFetching && Boolean(data) && !isFetchingNextPage}
          onRefresh={handleRefresh}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <View style={styles.searchBox}>
          <Input
            icon={Search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search everything..."
            autoFocus
          />
        </View>
      </View>

      <FlatList
        horizontal
        style={styles.horizontalScroller}
        showsHorizontalScrollIndicator={false}
        data={filters}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <Chip
            selected={item === selectedFilter}
            onPress={() => setSelectedFilter(item)}
          >
            {item}
          </Chip>
        )}
      />

      <View style={styles.section}>
        <SectionHeader title="Trending" />
        <View style={styles.trending}>
          {trendingTags.map((tag) => (
            <Pressable
              key={tag}
              accessibilityRole="button"
              onPress={() => setQuery(tag.replace('#', ''))}
            >
              <Badge>{tag}</Badge>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title={
            isInitialLoading
              ? 'Searching…'
              : `Results (${allResults.length}${hasNextPage ? '+' : ''})`
          }
          action={query || selectedFilter !== 'All' ? 'Clear' : undefined}
          onAction={handleClear}
        />
      </View>

      {/* Loading state */}
      {isInitialLoading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : null}

      {/* Error state */}
      {isError && !isInitialLoading ? (
        <View style={styles.stateBox}>
          <AppText variant="bodyMuted" style={styles.stateText}>
            {error instanceof Error
              ? error.message
              : 'Search failed. Please try again.'}
          </AppText>
          <Button size="sm" onPress={() => void refetch()}>
            Retry
          </Button>
        </View>
      ) : null}

      {/* Results */}
      {!isInitialLoading && !isError
        ? allResults.map((result, index) => (
            <Pressable
              key={`${result.type}-${result.id}`}
              style={[styles.result, { borderBottomColor: theme.border }]}
              onPress={() => navigateToResult(navigation, result)}
            >
              <Avatar
                initials={result.title.slice(0, 2).toUpperCase()}
                size={46}
                tone={index % 2 === 0 ? 'orange' : 'green'}
              />
              <View style={styles.resultMeta}>
                {result.type === 'player' ? (
                  <VerifiedName
                    profile={{
                      displayName: result.title,
                      skillLevel: result.skillLevel ?? 'Intermediate'
                    }}
                    style={styles.resultTitle}
                    numberOfLines={1}
                  />
                ) : (
                  <AppText style={styles.resultTitle} numberOfLines={1}>
                    {result.title}
                  </AppText>
                )}
                <AppText variant="small">{result.subtitle}</AppText>
              </View>
              <Badge tone={result.type === 'event' ? 'green' : 'dark'}>
                {result.type}
              </Badge>
            </Pressable>
          ))
        : null}

      {/* Empty state — only when query has settled and server returned no results */}
      {!isInitialLoading && !isError && allResults.length === 0 ? (
        <View style={styles.stateBox}>
          <AppText variant="bodyMuted">No results match your search.</AppText>
        </View>
      ) : null}

      {/* Load more */}
      {hasNextPage && !isLoadingMore ? (
        <Pressable
          style={styles.loadMore}
          onPress={handleLoadMore}
          accessibilityRole="button"
        >
          <AppText variant="small" style={{ color: theme.accent }}>
            Load more results
          </AppText>
        </Pressable>
      ) : null}

      {isLoadingMore ? (
        <View style={styles.loadMoreLoading}>
          <ActivityIndicator color={theme.accent} size="small" />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    marginBottom: 16
  },
  searchBox: {
    flex: 1
  },
  filterRow: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 16
  },
  horizontalScroller: {
    flexGrow: 0
  },
  section: {
    paddingHorizontal: spacing.screen,
    marginBottom: 12
  },
  trending: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dark[700]
  },
  resultMeta: {
    flex: 1
  },
  resultTitle: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  stateBox: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm
  },
  stateText: {
    textAlign: 'center'
  },
  loadMore: {
    alignItems: 'center',
    paddingVertical: spacing.md
  },
  loadMoreLoading: {
    alignItems: 'center',
    paddingVertical: spacing.md
  }
});
