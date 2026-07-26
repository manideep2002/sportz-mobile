import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { Bookmark, Heart, MessageCircle, MessageSquare, Settings, Trophy } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAppTranslation } from '@/i18n';

import { ProfileCover } from '@/components/profile/ProfileCover';
import { StructuredStatsPanel } from '@/components/profile/StructuredStatsPanel';
import { AppRefreshControl, AppText, Avatar, Badge, Button, IconButton, Screen, SegmentedControl, SportBadge, StatCard, VerifiedName } from '@/components/ui';

import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import { useUserPosts } from '@/hooks/useFeed';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';
import { compactNumber } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Tab = 'Posts' | 'Stats' | 'Highlights';

export function ProfileScreen() {
  const navigation = useNavigation<Navigation>();
  const { t } = useAppTranslation();
  const { colors: theme } = useAppTheme();
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
        <ActivityIndicator color={theme.accent} style={{ marginTop: 120 }} />
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
      <ProfileCover uri={profile.coverUrl} style={styles.cover} testID="own-profile-cover" />
      <View style={[styles.avatarWrap, { borderColor: theme.background }]}>
        <Avatar initials={profile.initials} uri={profile.avatarUrl} size={84} online />
      </View>
      <View style={styles.profileInfo}>
        <View style={styles.nameRow}>
          <View style={{ flex: 1 }}>
            <VerifiedName profile={profile} variant="h1" style={styles.name} badgeSize={19} />
            <AppText variant="bodyMuted">@{profile.username} · {profile.city}, {profile.country}</AppText>
          </View>
          <Button size="sm" onPress={() => navigation.navigate('EditProfile')}>{t('profile.edit')}</Button>
        </View>
        <AppText variant="bodyMuted">{profile.bio}</AppText>
        <View style={styles.badges}>
          {profile.sports.map((sport) => (
            sport === profile.primarySport
              ? <SportBadge key={sport} sport={sport} />
              : <Badge key={sport}>{sport}</Badge>
          ))}
          <Badge tone="dark">{profile.skillLevel}</Badge>
          {profile.badges.map((badge) => (
            <Badge key={badge} tone="orange">{badge}</Badge>
          ))}
          {profile.isHireable && <Badge tone="green">{t('profile.hireable')}</Badge>}
        </View>
        <View style={styles.stats}>
          <Pressable accessibilityRole="button" accessibilityLabel={`View ${compactNumber(profile.stats.followers)} followers`} style={styles.statTap} onPress={() => navigation.navigate('Followers', { userId: profile.id, mode: 'followers' })}>
            <StatCard value={compactNumber(profile.stats.followers)} label={t('profile.followers')} tone="orange" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`View ${profile.stats.following} following`} style={styles.statTap} onPress={() => navigation.navigate('Followers', { userId: profile.id, mode: 'following' })}>
            <StatCard value={profile.stats.following} label={t('profile.following')} />
          </Pressable>
          <StatCard value={profile.stats.posts} label={t('profile.posts')} />
          <StatCard value={`${profile.stats.winRate}%`} label={t('profile.winRate')} tone="green" />
        </View>
        <View style={styles.profileActions}>
          <Button style={styles.profileAction} variant="dark" size="sm" icon={Bookmark} onPress={() => navigation.navigate('SavedPosts')}>
            {t('profile.savedPosts')}
          </Button>
          <Button style={styles.profileAction} variant="ghost" size="sm" onPress={() => navigation.navigate('Offers')}>
            Team Offers
          </Button>
        </View>
      </View>
      <View style={styles.tabs}>
        <SegmentedControl
          value={tab}
          options={['Posts', 'Stats', 'Highlights']}
          getLabel={(value) => t(`profile.${value.toLowerCase()}`)}
          onChange={setTab}
        />
      </View>
      {tab === 'Posts' ? <ProfileGrid userId={profile.id} /> : null}
      {tab === 'Stats' ? <StructuredStatsPanel profile={profile} /> : null}
      {tab === 'Highlights' ? <HighlightsPanel userId={profile.id} /> : null}
    </Screen>
  );
}

function ProfileGrid({ userId }: { userId: string }) {
  const navigation = useNavigation<Navigation>();
  const { t } = useAppTranslation();
  const { colors: theme } = useAppTheme();
  const { data: postsList = [], isLoading } = useUserPosts(userId);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} size="small" />
      </View>
    );
  }

  if (postsList.length === 0) {
    return (
      <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <MessageSquare size={32} color={theme.textSubtle} style={{ marginBottom: 8 }} />
        <AppText variant="bodyMuted" style={{ textAlign: 'center', marginBottom: 12 }}>
          {t('profile.noPosts')}
        </AppText>
        <Button size="sm" onPress={() => navigation.navigate('CreatePost')}>
          {t('profile.shareFirst')}
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
            accessibilityRole="button"
            accessibilityLabel={`Open ${isStats ? "stats" : "post"} by ${post.author.displayName}`}
            onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
            style={({ pressed }) => [
              styles.gridItem,
              {
                backgroundColor: theme.surface,
                borderColor: isStats ? theme.accent : theme.border,
                borderWidth: isStats ? 1 : StyleSheet.hairlineWidth
              },
              pressed ? styles.gridItemPressed : null,
            ]}
          >
            {isStats ? (
              <LinearGradient
                colors={[theme.accent, theme.accentPressed]}
                style={styles.gridGradient}
              >
                <View style={styles.gridHeader}>
                  <Trophy size={14} color={theme.onAccent} />
                  <AppText style={[styles.gridSportTextStats, { color: theme.onAccent }]}>{post.sport}</AppText>
                </View>
                <AppText style={[styles.gridBodyTextStats, { color: theme.onAccent }]} numberOfLines={2}>
                  {post.statsLine || post.body}
                </AppText>
                <View style={styles.gridFooter}>
                  <Heart size={10} color={theme.onAccent} />
                  <AppText style={[styles.gridStatTextStats, { color: theme.onAccent }]}>{post.likes}</AppText>
                  <MessageCircle size={10} color={theme.onAccent} style={{ marginLeft: 6 }} />
                  <AppText style={[styles.gridStatTextStats, { color: theme.onAccent }]}>{post.comments}</AppText>
                </View>
              </LinearGradient>
            ) : (
              <View style={styles.gridInner}>
                <View style={styles.gridHeader}>
                  <AppText style={[styles.gridSportText, { color: theme.accent }]}>{post.sport}</AppText>
                  {post.mediaKind === 'court-card' && <AppText style={styles.courtBadge}>COURT</AppText>}
                </View>
                <AppText style={[styles.gridBodyText, { color: theme.text }]} numberOfLines={3}>
                  {post.body}
                </AppText>
                <View style={styles.gridFooter}>
                  <Heart size={10} color={theme.textMuted} />
                  <AppText style={[styles.gridStatText, { color: theme.textMuted }]}>{post.likes}</AppText>
                  <MessageCircle size={10} color={theme.textMuted} style={{ marginLeft: 6 }} />
                  <AppText style={[styles.gridStatText, { color: theme.textMuted }]}>{post.comments}</AppText>
                </View>
              </View>
            )}
          </Pressable>
        );
      })}
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
  const { t } = useAppTranslation();
  const { colors: theme, isDark } = useAppTheme();
  const { data: postsList = [] } = useUserPosts(userId);
  const [filterKind, setFilterKind] = useState<'stats' | 'highlight' | null>(null);
  const topStats = postsList
    .filter((post) => post.kind === 'stats')
    .sort((a, b) => b.likes + b.comments - (a.likes + a.comments))[0];
  const streak = currentPostStreak(postsList);
  const filteredPosts = filterKind ? postsList.filter((post) => post.kind === filterKind) : postsList.filter((post) => post.kind === 'highlight');

  return (
    <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.highlightScroll}>
        {[
          { label: t('profile.add'), kind: null },
          { label: t('profile.season'), kind: 'stats' as const },
          { label: t('profile.bestPlays'), kind: 'highlight' as const }
        ].map((item, index) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={index === 0 ? "Create highlight" : `Show ${item.label} highlights`}
            style={styles.highlightPill}
            onPress={() => {
              if (index === 0) navigation.navigate('CreatePost', { initialKind: 'highlight' });
              else setFilterKind(item.kind);
            }}
          >
            <View style={[styles.highlightCircle, index === 0 ? styles.highlightAdd : null, { borderColor: index === 0 ? theme.accent : theme.border }]}>
              <AppText variant="h3">{index === 0 ? '+' : item.label.slice(0, 1)}</AppText>
            </View>
            <AppText variant="small">{item.label}</AppText>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.highlightCards}>
        <LinearGradient colors={[theme.accentSoft, theme.surfaceMuted]} style={styles.highlightCard}>
          <AppText variant="h2" color={theme.accent}>{topStats ? t('profile.top') : t('profile.add').toLocaleUpperCase()}</AppText>
          <AppText style={[styles.highlightTitle, { color: theme.text }]} numberOfLines={2}>{topStats?.body || t('profile.shareStats')}</AppText>
          <Badge tone="orange">{topStats?.statsLine ?? t('profile.stats').toLocaleUpperCase()}</Badge>
        </LinearGradient>
        <LinearGradient colors={isDark ? ['#0A1A1A', '#0F2A2A'] : ['#ECFDF5', '#D1FAE5']} style={styles.highlightCard}>
          <AppText variant="h2" color={theme.success}>{streak}</AppText>
          <AppText style={[styles.highlightTitle, { color: theme.text }]} numberOfLines={2}>{t('profile.activityStreak')}</AppText>
          <Badge tone="green">STREAK</Badge>
        </LinearGradient>
      </View>
      {filteredPosts.slice(0, 4).map((post) => (
        <Pressable key={post.id} accessibilityRole="button" accessibilityLabel={`Open highlight: ${post.body}`} style={[styles.highlightListItem, { borderColor: theme.border }]} onPress={() => navigation.navigate('PostDetail', { postId: post.id })}>
          <AppText style={[styles.highlightTitle, { color: theme.text }]} numberOfLines={2}>{post.body}</AppText>
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
  profileActions: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  profileAction: {
    flex: 1
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
  highlightScroll: {
    flexGrow: 0,
    minHeight: 90
  },
  highlightPill: {
    alignItems: 'center',
    gap: 6,
    marginRight: 12
  },
  horizontalScroller: {
    flexGrow: 0
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
    overflow: 'hidden',
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
