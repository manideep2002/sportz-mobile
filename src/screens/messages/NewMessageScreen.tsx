import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Search } from 'lucide-react-native';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button, IconButton, Input, Screen } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { messageService } from '@/services/messageService';
import { profileService } from '@/services/profileService';
import type { UserProfile } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function NewMessageScreen() {
  const navigation = useNavigation<Navigation>();
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setPlayers([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setPlayers(await profileService.listPlayers(query));
      } catch (error) {
        Alert.alert('Search failed', error instanceof Error ? error.message : 'Please try again.');
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const startConversation = async (player: UserProfile) => {
    setLoadingId(player.id);
    try {
      const conversationId = await messageService.createDirectConversation(player.id);
      navigation.replace('Chat', { conversationId, targetUserId: player.id });
    } catch (error) {
      Alert.alert('Message failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <AppText variant="h3">New Message</AppText>
        <View style={styles.headerSpacer} />
      </View>
      <Input
        icon={Search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search people and groups..."
        autoFocus
      />
      <View style={styles.results}>
        {players.map((player) => (
          <View key={player.id} style={styles.playerRow}>
            <Avatar initials={player.initials} uri={player.avatarUrl} size={44} />
            <View style={styles.playerMeta}>
              <AppText style={styles.playerName}>{player.displayName}</AppText>
              <AppText variant="small">@{player.username} - {player.primarySport}</AppText>
            </View>
            <Button size="sm" loading={loadingId === player.id} onPress={() => void startConversation(player)}>Message</Button>
          </View>
        ))}
        {query.trim() && players.length === 0 ? (
          <AppText variant="bodyMuted" style={styles.empty}>No players found.</AppText>
        ) : null}
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
  headerSpacer: {
    width: 40
  },
  results: {
    gap: spacing.sm
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.sm
  },
  playerMeta: {
    flex: 1
  },
  playerName: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  empty: {
    textAlign: 'center',
    paddingVertical: spacing.lg
  }
});
