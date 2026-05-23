import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Search, SlidersHorizontal } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge, Button, Chip, IconButton, Input, Screen } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { messageService } from '@/services/messageService';
import { profileService } from '@/services/profileService';
import type { Sport, UserProfile } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const sports: Array<'All Sports' | Sport> = ['All Sports', 'Basketball', 'Football', 'Tennis', 'Cricket'];

export function FindPlayersScreen() {
  const navigation = useNavigation<Navigation>();
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void profileService.listPlayers().then(setPlayers);
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);
    void profileService.listPlayers(value).then(setPlayers);
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Find Players</AppText>
        <IconButton icon={SlidersHorizontal} />
      </View>
      <Input icon={Search} value={query} onChangeText={handleSearch} placeholder="Search by name, sport..." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {sports.map((sport, index) => (
          <Chip key={sport} selected={index === 0}>{sport}</Chip>
        ))}
      </ScrollView>
      <View style={styles.hireBanner}>
        <View style={styles.handshake}><AppText variant="h2">H</AppText></View>
        <View style={{ flex: 1 }}>
          <AppText style={styles.bannerTitle}>Hire for Your Team</AppText>
          <AppText variant="small">Browse available athletes and send offers</AppText>
        </View>
        <Button size="sm">Browse</Button>
      </View>
      {players.map((player) => (
        <View key={player.id} style={styles.playerCard}>
          <View style={styles.playerTop}>
            <Avatar initials={player.initials} size={54} online={player.isOnline} />
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
              disabled={!messageService.getConversationIdForUser(player.id)}
              onPress={() => {
                const conversationId = messageService.getConversationIdForUser(player.id);
                if (conversationId) {
                  navigation.navigate('Chat', { conversationId });
                }
              }}
            >
              Message
            </Button>
          </View>
        </View>
      ))}
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
  }
});
