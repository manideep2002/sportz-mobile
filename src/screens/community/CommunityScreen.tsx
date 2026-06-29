import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CommunityCard } from '@/components/community/CommunityCard';
import { AppText, Button, IconButton, Screen, SegmentedControl } from '@/components/ui';
import { colors, spacing } from '@/design/tokens';
import { useCommunities } from '@/hooks/useCommunities';
import type { AppStackParamList } from '@/navigation/routes';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Tab = 'Groups' | 'Pages';

export function CommunityScreen() {
  const navigation = useNavigation<Navigation>();
  const [tab, setTab] = useState<Tab>('Groups');
  const { data: communities = [], isLoading, isError, refetch } = useCommunities();
  const filtered = communities.filter((community) => (tab === 'Groups' ? community.type === 'group' : community.type === 'page'));

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h2">
          Community<AppText variant="h2" color={colors.orange[500]}>.</AppText>
        </AppText>
        <Button size="sm" icon={Plus} onPress={() => navigation.navigate('CreateCommunity')}>New</Button>
      </View>
      <SegmentedControl value={tab} options={['Groups', 'Pages']} onChange={setTab} />
      <View style={styles.list}>
        {isLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}
        {isError ? (
          <View style={styles.empty}>
            <AppText variant="bodyMuted">Could not load communities.</AppText>
            <Button size="sm" onPress={() => void refetch()}>Retry</Button>
          </View>
        ) : null}
        {!isLoading && !isError && filtered.length === 0 ? (
          <AppText variant="bodyMuted" style={styles.emptyText}>No {tab.toLowerCase()} yet.</AppText>
        ) : null}
        {filtered.map((community) => (
          <CommunityCard
            key={community.id}
            community={community}
            onPress={() =>
              community.type === 'group'
                ? navigation.navigate('GroupDetail', { communityId: community.id })
                : navigation.navigate('PageDetail', { communityId: community.id })
            }
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  list: {
    gap: spacing.sm
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: spacing.lg
  }
});
