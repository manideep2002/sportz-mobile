import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Search } from 'lucide-react-native';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge, Chip, IconButton, Input, Screen, SectionHeader } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import { useSearch } from '@/hooks/useSearch';
import type { AppStackParamList } from '@/navigation/routes';
import { searchService } from '@/services/searchService';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const filters = ['All', 'Players', 'Events', 'Groups', 'Pages', 'Courts'];

export function SearchScreen() {
  const navigation = useNavigation<Navigation>();
  const [query, setQuery] = useState('');
  const { data = [] } = useSearch(query);

  return (
    <Screen contentContainerStyle={styles.content}>
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
        renderItem={({ item, index }) => <Chip selected={index === 0}>{item}</Chip>}
      />
      <View style={styles.section}>
        <SectionHeader title="Trending" />
        <View style={styles.trending}>
          {searchService.getTrending().map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </View>
      </View>
      <View style={styles.section}>
        <SectionHeader title="Results" action="Filter" />
      </View>
      {data.map((result, index) => (
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
            <AppText style={styles.resultTitle}>{result.title}</AppText>
            <AppText variant="small">{result.subtitle}</AppText>
          </View>
          <Badge tone={result.type === 'event' ? 'green' : 'dark'}>{result.type}</Badge>
        </Pressable>
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
  }
});
