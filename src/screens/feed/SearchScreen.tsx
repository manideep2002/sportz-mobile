import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Search } from 'lucide-react-native';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';


import { AppRefreshControl, AppText, Avatar, Badge, Chip, IconButton, Input, Screen, SectionHeader, VerifiedName } from '@/components/ui';

import { colors, spacing, typography } from '@/design/tokens';
import { useSearch, useTrendingTags } from '@/hooks/useSearch';
import { blockService, toBlockedIdSet } from '@/services/blockService';
import { useQuery } from '@tanstack/react-query';
import type { AppStackParamList } from '@/navigation/routes';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const filters = ['All', 'Players', 'Events', 'Groups', 'Pages', 'Courts'];
const filterTypes: Record<string, string | undefined> = {
  All: undefined,
  Players: 'player',
  Events: 'event',
  Groups: 'group',
  Pages: 'page',
  Courts: 'court'
};

export function SearchScreen() {
  const navigation = useNavigation<Navigation>();
  const [query, setQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const { data = [], isRefetching: searchRefetching, refetch: refetchSearch } = useSearch(query);
  const {
    data: trendingTags = [],
    isRefetching: trendingRefetching,
    refetch: refetchTrending
  } = useTrendingTags();
  const {
    data: blockedIds = [],
    isRefetching: blockedRefetching,
    refetch: refetchBlocked
  } = useQuery({ queryKey: ['blocks', 'ids'], queryFn: blockService.listBlockedIds });
  const selectedType = filterTypes[selectedFilter];
  const blockedIdSet = toBlockedIdSet(blockedIds);
  const visibleData = data.filter((result) => !(result.type === 'player' && blockedIdSet.has(result.id)));
  const filteredData = selectedType ? visibleData.filter((result) => result.type === selectedType) : visibleData;

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl
          refreshing={searchRefetching || trendingRefetching || blockedRefetching}
          onRefresh={() => void Promise.all([refetchSearch(), refetchTrending(), refetchBlocked()])}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <View style={styles.searchBox}>
          <Input icon={Search} value={query} onChangeText={setQuery} placeholder="Search everything..." autoFocus />
        </View>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={filters}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <Chip selected={item === selectedFilter} onPress={() => setSelectedFilter(item)}>
            {item}
          </Chip>
        )}
      />
      <View style={styles.section}>
        <SectionHeader title="Trending" />
        <View style={styles.trending}>
          {trendingTags.map((tag) => (
            <Pressable key={tag} accessibilityRole="button" onPress={() => setQuery(tag.replace('#', ''))}>
              <Badge>{tag}</Badge>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.section}>
        <SectionHeader
          title={`Results (${filteredData.length})`}
          action={query || selectedFilter !== 'All' ? 'Clear' : undefined}
          onAction={() => {
            setQuery('');
            setSelectedFilter('All');
          }}
        />
      </View>
      {filteredData.map((result, index) => (
        <Pressable
          key={`${result.type}-${result.id}`}
          style={styles.result}
          onPress={() => {
            if (result.type === 'player') navigation.navigate('UserProfile', { userId: result.id });
            if (result.type === 'event') navigation.navigate('EventDetail', { eventId: result.id });
            if (result.type === 'group') navigation.navigate('GroupDetail', { communityId: result.id });
            if (result.type === 'page') navigation.navigate('PageDetail', { communityId: result.id });
            if (result.type === 'court') navigation.navigate('Courts');
          }}
        >
          <Avatar initials={result.title.slice(0, 2).toUpperCase()} size={46} tone={index % 2 === 0 ? 'orange' : 'green'} />
          <View style={styles.resultMeta}>
            {result.type === 'player' ? (
              <VerifiedName
                profile={{ displayName: result.title, skillLevel: result.skillLevel ?? 'Intermediate' }}
                style={styles.resultTitle}
                numberOfLines={1}
              />
            ) : (
              <AppText style={styles.resultTitle} numberOfLines={1}>{result.title}</AppText>
            )}
            <AppText variant="small">{result.subtitle}</AppText>
          </View>
          <Badge tone={result.type === 'event' ? 'green' : 'dark'}>{result.type}</Badge>
        </Pressable>
      ))}
      {filteredData.length === 0 ? (
        <View style={styles.empty}>
          <AppText variant="bodyMuted">No results match your search and filter.</AppText>
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
  empty: {
    alignItems: 'center',
    padding: spacing.xl
  }
});
