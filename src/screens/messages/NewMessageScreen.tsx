import { useEffect, useMemo, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, ChevronLeft, Search, Users } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button, IconButton, Input, Screen } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { messageService } from '@/services/messageService';
import { profileService } from '@/services/profileService';
import type { UserProfile } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'NewMessage'>;

export function NewMessageScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const addToConversationId = route.params?.addToConversationId;
  const [query, setQuery] = useState('');
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [selected, setSelected] = useState<UserProfile[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [groupLoading, setGroupLoading] = useState(false);

  const selectedIds = useMemo(() => new Set(selected.map((player) => player.id)), [selected]);
  const isAddMode = Boolean(addToConversationId);

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

  const toggleSelected = (player: UserProfile) => {
    setSelected((current) =>
      current.some((item) => item.id === player.id)
        ? current.filter((item) => item.id !== player.id)
        : [...current, player]
    );
  };

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

  const submitGroupAction = async () => {
    if (selected.length === 0) return;
    if (!isAddMode && selected.length < 2) {
      Alert.alert('Choose more players', 'Select at least two players to create a group chat.');
      return;
    }

    setGroupLoading(true);
    try {
      if (addToConversationId) {
        await messageService.addGroupMembers(addToConversationId, selected.map((player) => player.id));
        Alert.alert('Members added', 'The selected players were added to the chat.');
        navigation.goBack();
        return;
      }

      const fallbackTitle = selected.map((player) => player.displayName).slice(0, 3).join(', ');
      const conversationId = await messageService.createGroupConversation(groupTitle.trim() || fallbackTitle, selected.map((player) => player.id));
      navigation.replace('Chat', { conversationId });
    } catch (error) {
      Alert.alert(isAddMode ? 'Add members failed' : 'Group chat failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setGroupLoading(false);
    }
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <AppText variant="h3">{isAddMode ? 'Add Members' : 'New Message'}</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <Input
        icon={Search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search players"
        autoFocus
      />

      {selected.length ? (
        <View style={styles.selectedPanel}>
          {!isAddMode ? (
            <Input
              icon={Users}
              value={groupTitle}
              onChangeText={setGroupTitle}
              placeholder="Group name"
            />
          ) : null}
          <View style={styles.selectedChips}>
            {selected.map((player) => (
              <Pressable key={player.id} style={styles.chip} onPress={() => toggleSelected(player)}>
                <AppText style={styles.chipText}>{player.displayName}</AppText>
              </Pressable>
            ))}
          </View>
          <Button full loading={groupLoading} onPress={submitGroupAction}>
            {isAddMode ? `Add ${selected.length} member${selected.length === 1 ? '' : 's'}` : 'Create Group Chat'}
          </Button>
        </View>
      ) : null}

      <View style={styles.results}>
        {players.map((player) => {
          const isSelected = selectedIds.has(player.id);
          return (
            <View key={player.id} style={styles.playerRow}>
              <Pressable style={styles.playerPressArea} onPress={() => toggleSelected(player)}>
                <Avatar initials={player.initials} uri={player.avatarUrl} size={44} />
                <View style={styles.playerMeta}>
                  <AppText style={styles.playerName}>{player.displayName}</AppText>
                  <AppText variant="small">@{player.username} - {player.primarySport}</AppText>
                </View>
              </Pressable>
              {!isAddMode ? (
                <Button size="sm" variant="ghost" loading={loadingId === player.id} onPress={() => void startConversation(player)}>
                  Message
                </Button>
              ) : null}
              <Button size="sm" variant={isSelected ? 'dark' : 'primary'} icon={isSelected ? Check : undefined} onPress={() => toggleSelected(player)}>
                {isSelected ? 'Selected' : 'Select'}
              </Button>
            </View>
          );
        })}
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
  selectedPanel: {
    gap: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.md
  },
  selectedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  chip: {
    borderRadius: 8,
    backgroundColor: colors.overlays.orangeSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7
  },
  chipText: {
    color: colors.orange[400],
    fontFamily: typography.bodyBold,
    fontSize: 12
  },
  results: {
    gap: spacing.sm
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.sm
  },
  playerPressArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 0
  },
  playerMeta: {
    flex: 1,
    minWidth: 0
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
