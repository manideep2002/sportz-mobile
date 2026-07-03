import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Search, SlidersHorizontal } from 'lucide-react-native';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge, Button, Chip, IconButton, Input, Screen } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { messageService } from '@/services/messageService';
import { profileService } from '@/services/profileService';
import type { Sport, UserProfile } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const sports: ('All Sports' | Sport)[] = ['All Sports', 'Basketball', 'Football', 'Cricket', 'Badminton', 'Tennis'];
const PAGE_SIZE = 30;

export function FindPlayersScreen() {
  const navigation = useNavigation<Navigation>();
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState<'All Sports' | Sport>('All Sports');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [messageLoadingId, setMessageLoadingId] = useState<string | null>(null);

  useEffect(() => {
    void loadPlayers(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport]);

  const loadPlayers = async (
    nextPage = 0,
    replace = false,
    nextQuery = query,
    nextSport: 'All Sports' | Sport = sport,
    showLoader = true
  ) => {
    if (showLoader) setLoading(true);
    try {
      const results = await profileService.listPlayers(
        nextQuery,
        nextSport === 'All Sports' ? undefined : nextSport,
        nextPage,
        PAGE_SIZE
      );
      setPlayers((old) => (replace ? results : [...old, ...results]));
      setPage(nextPage);
      setHasMore(results.length === PAGE_SIZE);
    } catch (error) {
      Alert.alert('Could not load players', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const refreshPlayers = async () => {
    setRefreshing(true);
    try {
      await loadPlayers(0, true, query, sport, false);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearch = (value: string) => {
    setQuery(value);
    void loadPlayers(0, true, value);
  };

  const resetFilters = () => {
    setQuery('');
    setSport('All Sports');
    void loadPlayers(0, true, '', 'All Sports');
  };

  const openMessage = async (player: UserProfile) => {
    setMessageLoadingId(player.id);
    try {
      const conversationId = await messageService.createDirectConversation(player.id);
      navigation.navigate('Chat', { conversationId, targetUserId: player.id });
    } catch (error) {
      Alert.alert('Message failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setMessageLoadingId(null);
    }
  };

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refreshPlayers()}
          tintColor={colors.orange[500]}
          colors={[colors.orange[500]]}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Find Players</AppText>
        <IconButton icon={SlidersHorizontal} accessibilityLabel="Reset player filters" onPress={resetFilters} />
      </View>
      <Input icon={Search} value={query} onChangeText={handleSearch} placeholder="Search by name, sport..." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {sports.map((item) => (
          <Chip
            key={item}
            selected={item === sport}
            onPress={() => {
              setSport(item);
              setPlayers([]);
              setHasMore(true);
            }}
          >
            {item}
          </Chip>
        ))}
      </ScrollView>
      <View style={styles.hireBanner}>
        <View style={styles.handshake}><AppText variant="h2">H</AppText></View>
        <View style={{ flex: 1 }}>
          <AppText style={styles.bannerTitle}>Hire for Your Team</AppText>
          <AppText variant="small">Browse available athletes and send offers</AppText>
        </View>
        <Button size="sm" onPress={resetFilters}>Browse</Button>
      </View>
      {players.map((player) => (
        <View key={player.id} style={styles.playerCard}>
          <View style={styles.playerTop}>
            <Avatar initials={player.initials} uri={player.avatarUrl} size={54} online={player.isOnline} />
            <View style={{ flex: 1 }}>
              <AppText style={styles.playerName}>{player.displayName}</AppText>
              <AppText variant="small">{player.primarySport} - {player.position}</AppText>
              <View style={styles.badges}>
                <Badge tone={player.skillLevel === 'Pro' ? 'orange' : 'dark'}>{player.skillLevel}</Badge>
                {player.isHireable ? <Badge tone="green">Available</Badge> : null}
              </View>
            </View>
            <View style={styles.winRate}>
              <AppText variant="h2" color={colors.orange[500]}>{player.stats.winRate}%</AppText>
              <AppText variant="small">Win rate</AppText>
            </View>
          </View>
          <View style={styles.actions}>
            <Button style={styles.actionButton} size="sm" onPress={() => navigation.navigate('UserProfile', { userId: player.id })}>View Profile</Button>
            <Button
              style={styles.actionButton}
              size="sm"
              variant="ghost"
              loading={messageLoadingId === player.id}
              onPress={() => void openMessage(player)}
            >
              Message
            </Button>
          </View>
        </View>
      ))}
      {loading ? <ActivityIndicator color={colors.orange[500]} /> : null}
      {!loading && players.length === 0 ? (
        <AppText variant="bodyMuted" style={styles.empty}>No players match your search.</AppText>
      ) : null}
      {hasMore && players.length > 0 ? (
        <Button variant="dark" onPress={() => void loadPlayers(page + 1)}>
          Load more
        </Button>
      ) : null}
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
  hireBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#1A0800',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.overlays.orangeBorder,
    padding: 16
  },
  handshake: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.overlays.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bannerTitle: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  playerCard: {
    backgroundColor: colors.dark[800],
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: 16,
    gap: spacing.md
  },
  playerTop: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start'
  },
  playerName: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 15
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 5
  },
  winRate: {
    alignItems: 'flex-end'
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  actionButton: {
    flex: 1
  },
  empty: {
    textAlign: 'center',
    paddingVertical: spacing.lg
  }
});
