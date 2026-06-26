import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

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
  const { data: communities = [], isLoading } = useCommunities();
  const filtered = communities.filter((community) => (tab === 'Groups' ? community.type === 'group' : community.type === 'page'));

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h2">
          Community<AppText variant="h2" color={colors.orange[500]}>.</AppText>
        </AppText>
        <Button size="sm" icon={Plus}>New</Button>
      </View>
      <SegmentedControl value={tab} options={['Groups', 'Pages']} onChange={setTab} />
      <View style={styles.list}>
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
  }
});
