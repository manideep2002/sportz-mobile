import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Search, SlidersHorizontal } from 'lucide-react-native';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';


import { AppRefreshControl, AppText, Avatar, Badge, BottomSheet, Button, Chip, IconButton, Input, Screen, SportIcon, VerifiedName } from '@/components/ui';

import { allSports } from '@/constants/sports';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import { usePlayerSearch } from '@/hooks/usePlayerSearch';
import type { AppStackParamList } from '@/navigation/routes';
import { messageService } from '@/services/messageService';
import type { Sport, UserProfile } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export const playerSportFilters: readonly ('All Sports' | Sport)[] = ['All Sports', ...allSports];
export const playerSportQueryValue = (sport: 'All Sports' | Sport) => sport === 'All Sports' ? undefined : sport;
const PAGE_SIZE = 30;

export function FindPlayersScreen() {
  const navigation = useNavigation<Navigation>();
  const { colors: theme } = useAppTheme();
  const [sport, setSport] = useState<'All Sports' | Sport>('All Sports');
  const [refreshing, setRefreshing] = useState(false);
  const [messageLoadingId, setMessageLoadingId] = useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const {
    query,
    setQuery,
    results: players,
    isLoading: loading,
    isError,
    retry,
    hasMore,
    loadMore
  } = usePlayerSearch({
    sport: playerSportQueryValue(sport),
    pageSize: PAGE_SIZE,
    minQueryLength: 0
  });

  const refreshPlayers = async () => {
    setRefreshing(true);
    try {
      await retry();
    } finally {
      setRefreshing(false);
    }
  };

  const resetFilters = () => {
    setQuery('');
    setSport('All Sports');
    setFilterSheetOpen(false);
  };

  const applyFilter = (selected: 'All Sports' | Sport) => {
    setSport(selected);
    setFilterSheetOpen(false);
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
        <AppRefreshControl
          refreshing={refreshing}
          onRefresh={() => void refreshPlayers()}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Find Players</AppText>
        <IconButton icon={SlidersHorizontal} accessibilityLabel="Open player filters" onPress={() => setFilterSheetOpen(true)} filled={sport !== 'All Sports' || query.length > 0} />
      </View>
      <Input icon={Search} value={query} onChangeText={setQuery} placeholder="Search by name, sport..." />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContent}
        style={styles.filterScroller}
      >
        {playerSportFilters.map((item) => (
          <Chip
            key={item}
            selected={item === sport}
            onPress={() => setSport(item)}
          >
            {item}
          </Chip>
        ))}
      </ScrollView>
      <View style={[styles.hireBanner, { backgroundColor: theme.accentSoft, borderColor: theme.accentBorder }]}>
        <View style={[styles.handshake, { backgroundColor: theme.accentSoft }]}><AppText variant="h2" color={theme.accent}>H</AppText></View>
        <View style={{ flex: 1 }}>
          <AppText style={styles.bannerTitle}>Hire for Your Team</AppText>
          <AppText variant="small">Browse available athletes and send offers</AppText>
        </View>
        <Button size="sm" onPress={() => navigation.navigate('Offers')}>Offers</Button>
      </View>
      {players.map((player) => (
        <View key={player.id} style={[styles.playerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.playerTop}>
            <Avatar
              initials={player.initials}
              uri={player.avatarUrl}
              size={54}
              online={player.isOnline}
              accessibilityLabel={`View ${player.displayName}'s profile`}
              onPress={() => navigation.navigate('UserProfile', { userId: player.id })}
            />
            <View style={{ flex: 1 }}>
              <VerifiedName
                profile={player}
                style={styles.playerName}
                numberOfLines={1}
                onPress={() => navigation.navigate('UserProfile', { userId: player.id })}
              />
              <View style={styles.sportLine}>
                <SportIcon sport={player.primarySport} size={15} />
                <AppText variant="small">{player.primarySport} - {player.position}</AppText>
              </View>
              <View style={styles.badges}>
                <Badge tone={player.skillLevel === 'Pro' ? 'orange' : 'dark'}>{player.skillLevel}</Badge>
                {player.isHireable ? <Badge tone="green">Available</Badge> : null}
              </View>
            </View>
            <View style={styles.winRate}>
              <AppText variant="h2" color={theme.accent}>{player.stats.winRate}%</AppText>
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
            {player.isHireable ? (
              <Button
                style={styles.actionButton}
                size="sm"
                variant="ghost"
                onPress={() => navigation.navigate('CreateOffer', { recipientId: player.id })}
              >
                Offer
              </Button>
            ) : null}
          </View>
        </View>
      ))}
      {loading ? <ActivityIndicator color={theme.accent} /> : null}
      {isError ? (
        <View style={styles.errorRow}>
          <AppText variant="bodyMuted">Could not load players.</AppText>
          <Button size="sm" onPress={() => void retry()}>Retry</Button>
        </View>
      ) : null}
      {!loading && !isError && players.length === 0 ? (
        <AppText variant="bodyMuted" style={styles.empty}>No players match your search.</AppText>
      ) : null}
      {hasMore && players.length > 0 ? (
        <Button variant="dark" onPress={() => void loadMore()}>
          Load more
        </Button>
      ) : null}
      <BottomSheet open={filterSheetOpen} title="Filter Players" onClose={() => setFilterSheetOpen(false)}>
        <View style={styles.sheetContent}>
          <AppText variant="bodyMuted" style={styles.sheetLabel}>Sport</AppText>
          <View style={styles.sheetChips}>
            {playerSportFilters.map((item) => (
              <Chip
                key={item}
                selected={item === sport}
                onPress={() => applyFilter(item)}
              >
                {item}
              </Chip>
            ))}
          </View>
          <Button variant="dark" onPress={resetFilters}>Reset Filters</Button>
        </View>
      </BottomSheet>
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
  filterScroller: {
    flexGrow: 0,
    marginVertical: spacing.xs
  },
  filterContent: {
    paddingBottom: spacing.sm,
    alignItems: 'center'
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
  sportLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
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
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  sheetContent: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md
  },
  sheetLabel: {
    marginBottom: spacing.xs
  },
  sheetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  }
});
