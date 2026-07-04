import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { Bookmark, Heart, MessageCircle, MessageSquare, Settings, Trophy } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';


import { AppRefreshControl, AppText, Avatar, Badge, Button, IconButton, Screen, SegmentedControl, StatCard, VerifiedName } from '@/components/ui';


import { colors, spacing, typography } from '@/design/tokens';
import { useUserPosts } from '@/hooks/useFeed';
import type { AppStackParamList } from '@/navigation/routes';
import type { UserProfile } from '@/types/domain';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';
import { compactNumber } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Tab = 'Posts' | 'Stats' | 'Highlights';

export function ProfileScreen() {
  const navigation = useNavigation<Navigation>();
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);
  const setProfile = useAuthStore((state) => state.setProfile);
  const [tab, setTab] = useState<Tab>('Posts');
  const [refreshing, setRefreshing] = useState(false);

  const refreshProfile = async () => {
    if (!profile) return;
    setRefreshing(true);
    try {
      const freshProfile = await authService.getCurrentProfile();
      setProfile(freshProfile);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['feed', 'user', profile.id] }),
        queryClient.invalidateQueries({ queryKey: ['profile', profile.id] })
      ]);
    } catch (error) {
      Alert.alert('Refresh failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  if (!profile) {
    return (
      <Screen withTabPadding contentContainerStyle={styles.content}>
        <View style={styles.settings}>
          <IconButton icon={Settings} onPress={() => navigation.navigate('Settings')} />
        </View>
        <ActivityIndicator color={colors.orange[500]} style={{ marginTop: 120 }} />
      </Screen>
    );
  }

  return (
    <Screen
      withTabPadding
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl
          refreshing={refreshing}
          onRefresh={() => void refreshProfile()}
        />
      }
    >
      <View style={styles.settings}>
        <IconButton icon={Settings} onPress={() => navigation.navigate('Settings')} />
      </View>
      <LinearGradient colors={['#0A0D1A', '#101629']} style={styles.cover}>
        <View style={styles.coverLines} />
      </LinearGradient>
      <View style={styles.avatarWrap}>
        <Avatar initials={profile.initials} uri={profile.avatarUrl} size={84} online />
      </View>
      <View style={styles.profileInfo}>
        <View style={styles.nameRow}>
          <View style={{ flex: 1 }}>
            <VerifiedName profile={profile} variant="h1" style={styles.name} badgeSize={19} />
            <AppText variant="bodyMuted">@{profile.username} · {profile.city}, {profile.country}</AppText>
          </View>
          <Button size="sm" onPress={() => navigation.navigate('EditProfile')}>Edit Profile</Button>
        </View>
        <AppText variant="bodyMuted">{profile.bio}</AppText>
        <View style={styles.badges}>
          {profile.sports.map((sport) => (
            <Badge key={sport}>{sport}</Badge>
          ))}
          <Badge tone="dark">{profile.skillLevel}</Badge>
          {profile.badges.map((badge) => (
            <Badge key={badge} tone="orange">{badge}</Badge>
          ))}
          {profile.isHireable && <Badge tone="green">Hireable</Badge>}
        </View>
        <View style={styles.stats}>
          <Pressable style={styles.statTap} onPress={() => navigation.navigate('Followers', { userId: profile.id, mode: 'followers' })}>
            <StatCard value={compactNumber(profile.stats.followers)} label="Followers" tone="orange" />
          </Pressable>
          <Pressable style={styles.statTap} onPress={() => navigation.navigate('Followers', { userId: profile.id, mode: 'following' })}>
            <StatCard value={profile.stats.following} label="Following" />
          </Pressable>
          <StatCard value={profile.stats.posts} label="Posts" />
          <StatCard value={`${profile.stats.winRate}%`} label="Win %" tone="green" />
        </View>
        <Button variant="dark" size="sm" icon={Bookmark} onPress={() => navigation.navigate('SavedPosts')}>
          Saved Posts
        </Button>
      </View>
      <View style={styles.tabs}>
        <SegmentedControl value={tab} options={['Posts', 'Stats', 'Highlights']} onChange={setTab} />
      </View>
      {tab === 'Posts' ? <ProfileGrid userId={profile.id} /> : null}
      {tab === 'Stats' ? <StatsPanel profile={profile} /> : null}
      {tab === 'Highlights' ? <HighlightsPanel userId={profile.id} /> : null}
    </Screen>
  );
}

function ProfileGrid({ userId }: { userId: string }) {
  const navigation = useNavigation<Navigation>();
  const { data: postsList = [], isLoading } = useUserPosts(userId);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.orange[500]} size="small" />
      </View>
    );
  }

  if (postsList.length === 0) {
    return (
      <View style={styles.emptyState}>
        <MessageSquare size={32} color={colors.text.tertiary} style={{ marginBottom: 8 }} />
        <AppText variant="bodyMuted" style={{ textAlign: 'center', marginBottom: 12 }}>
          No posts shared yet.
        </AppText>
        <Button size="sm" onPress={() => navigation.navigate('CreatePost')}>
          Share Your First Update
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {postsList.map((post) => {
        const isStats = post.kind === 'stats';
        return (
          <Pressable
            key={post.id}
            onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
            style={({ pressed }) => [
              styles.gridItem,
              isStats ? styles.gridItemStats : null,
              pressed ? styles.gridItemPressed : null,
            ]}
          >
            {isStats ? (
              <LinearGradient
                colors={['#FF5A1F', '#FF7A45']}
                style={styles.gridGradient}
              >
                <View style={styles.gridHeader}>
                  <Trophy size={14} color="#0A0907" />
                  <AppText style={styles.gridSportTextStats}>{post.sport}</AppText>
                </View>
                <AppText style={styles.gridBodyTextStats} numberOfLines={2}>
                  {post.statsLine || post.body}
                </AppText>
                <View style={styles.gridFooter}>
                  <Heart size={10} color="#0A0907" />
                  <AppText style={styles.gridStatTextStats}>{post.likes}</AppText>
                  <MessageCircle size={10} color="#0A0907" style={{ marginLeft: 6 }} />
                  <AppText style={styles.gridStatTextStats}>{post.comments}</AppText>
                </View>
              </LinearGradient>
            ) : (
              <View style={styles.gridInner}>
                <View style={styles.gridHeader}>
                  <AppText style={styles.gridSportText}>{post.sport}</AppText>
                  {post.mediaKind === 'court-card' && <AppText style={styles.courtBadge}>COURT</AppText>}
                </View>
                <AppText style={styles.gridBodyText} numberOfLines={3}>
                  {post.body}
                </AppText>
                <View style={styles.gridFooter}>
                  <Heart size={10} color={colors.text.secondary} />
                  <AppText style={styles.gridStatText}>{post.likes}</AppText>
                  <MessageCircle size={10} color={colors.text.secondary} style={{ marginLeft: 6 }} />
                  <AppText style={styles.gridStatText}>{post.comments}</AppText>
                </View>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function StatsPanel({ profile }: { profile: UserProfile }) {
  const statLines = [
    ['Games Played', profile.stats.games],
    ['Win Rate', profile.stats.winRate],
    ['Best Points', profile.stats.bestPoints ?? 0],
    ['Avg Rebounds', profile.stats.avgRebounds ?? 0]
  ] as const;

  const maxVal = Math.max(...statLines.map(([, v]) => v), 1);

  return (
    <View style={styles.panel}>
      <AppText variant="h4">Season Stats — 2026</AppText>
      {statLines.map(([label, value]) => (
        <View key={label} style={styles.statLine}>
          <View style={styles.statLineTop}>
            <AppText variant="small">{label}</AppText>
            <AppText style={styles.statValue}>{value}</AppText>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round((value / maxVal) * 100)}%` }]} />
          </View>
        </View>
      ))}
      <View style={styles.threeStats}>
        <StatCard value={profile.stats.bestPoints?.toString() ?? '—'} label="Best PTS" tone="orange" />
        <StatCard value={profile.stats.avgRebounds?.toString() ?? '—'} label="Avg REB" />
        <StatCard value={profile.stats.games.toString()} label="Games" tone="green" />
      </View>
    </View>
  );
}

function currentPostStreak(posts: { createdAt: string }[]) {
  const dates = new Set(posts.map((post) => post.createdAt.slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function HighlightsPanel({ userId }: { userId: string }) {
  const navigation = useNavigation<Navigation>();
  const { data: postsList = [] } = useUserPosts(userId);
  const [filterKind, setFilterKind] = useState<'stats' | 'highlight' | null>(null);
  const topStats = postsList
    .filter((post) => post.kind === 'stats')
    .sort((a, b) => b.likes + b.comments - (a.likes + a.comments))[0];
  const streak = currentPostStreak(postsList);
  const filteredPosts = filterKind ? postsList.filter((post) => post.kind === filterKind) : postsList.filter((post) => post.kind === 'highlight');

  return (
    <View style={styles.panel}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {[
          { label: 'Add', kind: null },
          { label: 'Season', kind: 'stats' as const },
          { label: 'Best Plays', kind: 'highlight' as const }
        ].map((item, index) => (
          <Pressable
            key={item.label}
            style={styles.highlightPill}
            onPress={() => {
              if (item.label === 'Add') navigation.navigate('CreatePost', { initialKind: 'highlight' });
              else setFilterKind(item.kind);
            }}
          >
            <View style={[styles.highlightCircle, index === 0 ? styles.highlightAdd : null]}>
              <AppText variant="h3">{index === 0 ? '+' : item.label.slice(0, 1)}</AppText>
            </View>
            <AppText variant="small">{item.label}</AppText>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.highlightCards}>
        <LinearGradient colors={['#1A0800', '#2A1200']} style={styles.highlightCard}>
          <AppText variant="h2" color={colors.orange[500]}>{topStats ? 'TOP' : 'ADD'}</AppText>
          <AppText style={styles.highlightTitle}>{topStats?.body || 'Share a stats post'}</AppText>
          <Badge tone="orange">{topStats?.statsLine ?? 'STATS'}</Badge>
        </LinearGradient>
        <LinearGradient colors={['#0A1A1A', '#0F2A2A']} style={styles.highlightCard}>
          <AppText variant="h2" color={colors.semantic.success}>{streak}</AppText>
          <AppText style={styles.highlightTitle}>Day Activity Streak</AppText>
          <Badge tone="green">STREAK</Badge>
        </LinearGradient>
      </View>
      {filteredPosts.slice(0, 4).map((post) => (
        <Pressable key={post.id} style={styles.highlightListItem} onPress={() => navigation.navigate('PostDetail', { postId: post.id })}>
          <AppText style={styles.highlightTitle}>{post.body}</AppText>
          <Badge>{post.kind}</Badge>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0
  },
  settings: {
    position: 'absolute',
    top: 54,
    right: spacing.screen,
    zIndex: 5
  },
  cover: {
    height: 200
  },
  coverLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,90,31,0.25)'
  },
  avatarWrap: {
    marginTop: -42,
    marginLeft: spacing.screen,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: colors.dark[950],
    width: 92
  },
  profileInfo: {
    padding: spacing.screen,
    gap: spacing.sm
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  name: {
    fontSize: 28,
    lineHeight: 31
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
  statTap: {
    flexGrow: 1,
    flexShrink: 1
  },
  tabs: {
    paddingHorizontal: spacing.screen,
    marginBottom: 16
  },
  center: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark[800],
    marginHorizontal: spacing.screen,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700]
  },
  grid: {
    paddingHorizontal: spacing.screen,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12
  },
  gridItem: {
    width: '48.5%',
    aspectRatio: 1.1,
    backgroundColor: colors.dark[800],
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    overflow: 'hidden'
  },
  gridItemStats: {
    borderColor: colors.orange[500],
    borderWidth: 1
  },
  gridItemPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }]
  },
  gridGradient: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between'
  },
  gridInner: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between'
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  gridSportText: {
    color: colors.orange[400],
    fontFamily: typography.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  gridSportTextStats: {
    color: '#0A0907',
    fontFamily: typography.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  gridBodyText: {
    color: colors.text.primary,
    fontSize: 12,
    lineHeight: 16,
    marginVertical: 4
  },
  gridBodyTextStats: {
    color: '#0A0907',
    fontFamily: typography.headingBold,
    fontSize: 14,
    lineHeight: 18,
    marginVertical: 4
  },
  gridFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto'
  },
  gridStatText: {
    color: colors.text.secondary,
    fontSize: 10,
    marginLeft: 4
  },
  gridStatTextStats: {
    color: '#0A0907',
    fontSize: 10,
    marginLeft: 4,
    fontFamily: typography.bodyBold
  },
  courtBadge: {
    color: colors.semantic.info,
    fontSize: 9,
    fontFamily: typography.bodyBold,
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: colors.semantic.info,
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1
  },
  panel: {
    marginHorizontal: spacing.screen,
    backgroundColor: colors.dark[800],
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700]
  },
  statLine: {
    gap: 4
  },
  statLineTop: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  statValue: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 12
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.dark[700],
    overflow: 'hidden'
  },
  fill: {
    height: 3,
    backgroundColor: colors.orange[500]
  },
  threeStats: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  highlightPill: {
    alignItems: 'center',
    gap: 6,
    marginRight: 12
  },
  highlightCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.dark[700],
    alignItems: 'center',
    justifyContent: 'center'
  },
  highlightAdd: {
    borderStyle: 'dashed',
    borderColor: colors.orange[400]
  },
  highlightCards: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  highlightCard: {
    flex: 1,
    aspectRatio: 0.8,
    borderRadius: 14,
    padding: 12,
    justifyContent: 'flex-end',
    gap: spacing.xs
  },
  highlightTitle: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 13
  },
  highlightListItem: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.sm,
    gap: spacing.xs
  }
});
