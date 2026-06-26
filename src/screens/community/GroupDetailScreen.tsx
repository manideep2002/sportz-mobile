import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalendarDays, ChevronLeft, MoreHorizontal, Plus, UserPlus, type LucideIcon } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { PostCard } from '@/components/feed/PostCard';
import { AppText, Badge, IconButton, Screen } from '@/components/ui';
import { colors, spacing } from '@/design/tokens';
import { useCommunity } from '@/hooks/useCommunities';
import { useCommunityPosts } from '@/hooks/useFeed';
import type { AppStackParamList } from '@/navigation/routes';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'GroupDetail'>;

export function GroupDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { data: community, isLoading } = useCommunity(route.params.communityId);
  const { data: posts = [] } = useCommunityPosts(route.params.communityId);

  if (isLoading || !community) {
    return (
      <Screen contentContainerStyle={styles.content}>
        <AppText>Loading...</AppText>
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }} />
        <IconButton icon={MoreHorizontal} />
      </View>
      <LinearGradient colors={['#0A1A08', '#1a3a18', '#0A1A08']} style={styles.cover}>
        <AppText variant="hero" style={styles.coverMark}>
          {community.name.charAt(0).toUpperCase()}
        </AppText>
      </LinearGradient>
      <View style={styles.body}>
        <AppText variant="h2">{community.name}</AppText>
        <AppText variant="bodyMuted">
          {community.sport} - Public Group - {community.city}
        </AppText>
        <View style={styles.badges}>
          <Badge tone="orange">Admin</Badge>
          <Badge>{community.memberCount} Members</Badge>
          <Badge tone="green">Active</Badge>
        </View>
        <AppText variant="bodyMuted">{community.description}</AppText>
        <View style={styles.quickActions}>
          <Action icon={CalendarDays} label="Schedule" />
          <Action icon={Plus} label="New Post" primary />
          <Action icon={UserPlus} label="Invite" />
        </View>
        <AppText variant="h4">Recent Posts</AppText>
      </View>
      {posts.slice(0, 3).map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
        />
      ))}
    </Screen>
  );
}

function Action({ icon: Icon, label, primary = false }: { icon: LucideIcon; label: string; primary?: boolean }) {
  return (
    <View style={[styles.action, primary ? styles.actionPrimary : null]}>
      <Icon size={18} color={primary ? colors.light[0] : colors.orange[500]} />
      <AppText style={[styles.actionLabel, primary ? styles.actionPrimaryLabel : null]}>{label}</AppText>
    </View>
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
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -52
  },
  coverMark: {
    fontSize: 56
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
  quickActions: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dark[800],
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: 12
  },
  actionPrimary: {
    backgroundColor: colors.orange[500],
    borderColor: colors.orange[500]
  },
  actionLabel: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '700'
  },
  actionPrimaryLabel: {
    color: colors.light[0]
  }
});