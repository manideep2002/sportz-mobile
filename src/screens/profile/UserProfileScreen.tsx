import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, MoreHorizontal } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge, Button, IconButton, Screen, SegmentedControl, StatCard } from '@/components/ui';
import { users } from '@/data/mockData';
import { colors, spacing } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { messageService } from '@/services/messageService';
import { compactNumber } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'UserProfile'>;

export function UserProfileScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const profile = users.find((user) => user.id === route.params.userId) ?? users[1];
  const conversationId = messageService.getConversationIdForUser(profile.id);

  const openChat = () => {
    if (!conversationId) return;
    navigation.navigate('Chat', { conversationId });
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }} />
        <IconButton icon={MoreHorizontal} />
      </View>
      <LinearGradient colors={['#0A1A08', '#18381A']} style={styles.cover} />
      <View style={styles.avatarWrap}>
        <Avatar initials={profile.initials} size={80} online={profile.isOnline} />
      </View>
      <View style={styles.body}>
        <AppText variant="h2">{profile.displayName}</AppText>
        <AppText variant="bodyMuted">@{profile.username} - {profile.city}, {profile.country}</AppText>
        <View style={styles.badges}>
          <Badge>{profile.primarySport}</Badge>
          {profile.badges.map((badge) => <Badge key={badge} tone="orange">{badge}</Badge>)}
        </View>
        <AppText variant="bodyMuted">{profile.bio}</AppText>
        <View style={styles.stats}>
          <StatCard value={compactNumber(profile.stats.followers)} label="Followers" tone="orange" />
          <StatCard value={profile.stats.following} label="Following" />
          <StatCard value={`${profile.stats.winRate}%`} label="Win %" tone="green" />
        </View>
        <View style={styles.actions}>
          <Button style={styles.actionButton} onPress={openChat}>Follow</Button>
          <Button style={styles.actionButton} variant="ghost" onPress={openChat} disabled={!conversationId}>
            Message
          </Button>
          <IconButton icon={MoreHorizontal} />
        </View>
        <SegmentedControl value="Posts" options={['Posts', 'Stats', 'Highlights']} onChange={() => undefined} />
        <View style={styles.grid}>
          {['B', 'S', 'T', 'G', 'B', 'H'].map((item, index) => (
            <View key={`${item}-${index}`} style={styles.gridItem}>
              <AppText variant="h2">{item}</AppText>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screen,
    gap: spacing.sm,
    zIndex: 2
  },
  cover: {
    height: 200,
    marginTop: -52
  },
  avatarWrap: {
    marginTop: -40,
    marginLeft: spacing.screen,
    width: 88,
    borderWidth: 4,
    borderColor: colors.dark[950],
    borderRadius: 44
  },
  body: {
    padding: spacing.screen,
    gap: spacing.sm
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap'
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center'
  },
  actionButton: {
    flex: 1
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    marginTop: spacing.sm
  },
  gridItem: {
    width: '32.8%',
    aspectRatio: 1,
    backgroundColor: colors.dark[800],
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
