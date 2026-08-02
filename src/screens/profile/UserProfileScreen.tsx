import { useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, ChevronLeft, Heart, MessageCircle, MessageSquare, MoreHorizontal, Trophy, UserCheck, UserPlus, UserX } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ActionSheetIOS, Alert, Platform, Pressable, ScrollView, StyleSheet, View, ActivityIndicator } from 'react-native';

import { ProfileCover } from '@/components/profile/ProfileCover';
import { StructuredStatsPanel } from '@/components/profile/StructuredStatsPanel';
import { AppRefreshControl, AppText, Avatar, Badge, Button, IconButton, Screen, SegmentedControl, SportBadge, StatCard, VerifiedName } from '@/components/ui';

import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import { useProfile, useFollowRequestStatus, useIsBlocked, useIsFollowing, useToggleBlock, useToggleFollow } from '@/hooks/useProfile';
import { useUserPosts } from '@/hooks/useFeed';
import type { AppStackParamList } from '@/navigation/routes';
import { shareCanonicalEntity } from '@/services/canonicalLinkService';
import { messageService } from '@/services/messageService';
import { reportReasons, reportService } from '@/services/reportService';
import { sportKeyFor } from '@/services/athleteStatsService';
import type { StructuredSport } from '@/types/domain';
import { compactNumber } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'UserProfile'>;

export function UserProfileScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { colors: theme } = useAppTheme();
  const queryClient = useQueryClient();
  const { userId } = route.params;

  const { data: profile, isLoading, isError, isRefetching, refetch } = useProfile(userId);
  const { data: isFollowing = false, refetch: refetchFollowing } = useIsFollowing(userId);
  const { data: followRequestStatus = null, refetch: refetchFollowRequestStatus } = useFollowRequestStatus(userId);
  const { data: isBlocked = false, isLoading: isBlockedLoading, refetch: refetchBlocked } = useIsBlocked(userId);
  const toggleFollow = useToggleFollow(userId);
  const toggleBlock = useToggleBlock(userId);
  const [tab, setTab] = useState<'Posts' | 'Stats' | 'Highlights'>('Posts');
  const [selectedSport, setSelectedSport] = useState<StructuredSport | undefined>();
  const [messageLoading, setMessageLoading] = useState(false);
  const blockActionLoading = isBlockedLoading || toggleBlock.isPending;

  const handleSportPress = (sportName: string) => {
    const key = sportKeyFor(sportName);
    if (key) {
      setSelectedSport(key);
      setTab('Stats');
    }
  };

  const refreshProfile = async () => {
    await Promise.all([
      refetch(),
      refetchFollowing(),
      refetchFollowRequestStatus(),
      refetchBlocked(),
      queryClient.invalidateQueries({ queryKey: ['feed', 'user', userId] })
    ]);
  };

  const handleFollow = () => {
    if (followRequestStatus === 'pending' && !isFollowing) {
      Alert.alert('Request pending', `${profile?.displayName ?? 'This player'} has not approved your follow request yet.`);
      return;
    }
    if (isBlocked) {
      Alert.alert('Profile blocked', `Unblock ${profile?.displayName ?? 'this profile'} before following.`);
      return;
    }
    toggleFollow.mutate(isFollowing, {
      onError: () => {
        Alert.alert('Error', 'Could not update follow status. Please try again.');
      }
    });
  };

  const openChat = async () => {
    if (!profile) return;
    if (isBlocked) {
      Alert.alert('Profile blocked', `Unblock ${profile.displayName} before messaging.`);
      return;
    }
    setMessageLoading(true);
    try {
      const conversationId = await messageService.createDirectConversation(profile.id);
      navigation.navigate('Chat', { conversationId, targetUserId: profile.id });
    } catch (error) {
      Alert.alert('Message failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setMessageLoading(false);
    }
  };

  const reportProfile = () => {
    if (!profile) return;
    Alert.alert('Report User', 'Choose a reason.', [
      ...reportReasons.map((reason) => ({
        text: reason,
        onPress: async () => {
          try {
            await reportService.reportEntity('user', profile.id, reason);
            Alert.alert('Report submitted', 'Thank you. We will review this profile.');
          } catch (error) {
            Alert.alert('Report failed', error instanceof Error ? error.message : 'Please try again.');
          }
        }
      })),
      { text: 'Cancel', style: 'cancel' as const }
    ], { cancelable: true });
  };

  const runBlockToggle = (currentlyBlocked: boolean) => {
    if (!profile) return;
    toggleBlock.mutate(currentlyBlocked, {
      onSuccess: (nextBlocked) => {
        Alert.alert(
          nextBlocked ? 'Blocked' : 'Unblocked',
          nextBlocked
            ? `${profile.displayName} has been blocked.`
            : `${profile.displayName} has been unblocked.`
        );
      },
      onError: (error) => {
        Alert.alert(
          currentlyBlocked ? 'Unblock failed' : 'Block failed',
          error instanceof Error ? error.message : 'Please try again.'
        );
      }
    });
  };

  const handleBlockToggle = () => {
    if (!profile) return;
    if (isBlocked) {
      runBlockToggle(true);
      return;
    }

    Alert.alert('Block User', `Block ${profile.displayName}? Their posts will be hidden from your feed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => runBlockToggle(false) }
    ], { cancelable: true });
  };

  const openMore = () => {
    const blockOption = isBlocked ? 'Unblock User' : 'Block User';
    const options = ['Share Profile', 'Report User', blockOption, 'Cancel'];
    const destructiveIndex = 2;
    const cancelIndex = 3;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancelIndex,
          ...(isBlocked ? {} : { destructiveButtonIndex: destructiveIndex })
        },
        (index) => {
          if (index === 0) {
            if (profile) void shareCanonicalEntity('profile', profile.id, {
              title: profile.isPrivate ? 'SPORTZ athlete' : profile.displayName,
              message: profile.isPrivate
                ? 'Open this private athlete profile on SPORTZ. Follow access rules apply.'
                : `Check out ${profile.displayName}'s profile on SPORTZ.`
            });
          } else if (index === 1) {
            reportProfile();
          } else if (index === 2) {
            handleBlockToggle();
          }
        }
      );
    } else {
      Alert.alert('Options', undefined, [
        {
          text: 'Share Profile',
          onPress: () => profile ? shareCanonicalEntity('profile', profile.id, {
            title: profile.isPrivate ? 'SPORTZ athlete' : profile.displayName,
            message: profile.isPrivate
              ? 'Open this private athlete profile on SPORTZ. Follow access rules apply.'
              : `Check out ${profile.displayName}'s profile on SPORTZ.`
          }) : undefined
        },
        { text: 'Report User', onPress: reportProfile },
        { text: blockOption, style: isBlocked ? 'default' : 'destructive', onPress: handleBlockToggle },
        { text: 'Cancel', style: 'cancel' }
      ], { cancelable: true });
    }
  };

  // -- Loading state ----------------------------------------------------------
  if (isLoading) {
    return (
      <Screen
        contentContainerStyle={styles.centered}
        refreshControl={
          <AppRefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
          />
        }
      >
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        </View>
        <ActivityIndicator color={theme.accent} size="large" style={{ marginTop: 80 }} />
      </Screen>
    );
  }

  // -- Error / not found ------------------------------------------------------
  if (isError || !profile) {
    return (
      <Screen
        contentContainerStyle={styles.centered}
        refreshControl={
          <AppRefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
          />
        }
      >
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        </View>
        <AppText variant="bodyMuted" style={{ textAlign: 'center', marginTop: 80 }}>
          Could not load this profile. Please try again.
        </AppText>
        <Button size="sm" onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          Go Back
        </Button>
      </Screen>
    );
  }

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refreshProfile()}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }} />
        <IconButton icon={MoreHorizontal} onPress={openMore} accessibilityLabel="More options" />
      </View>
      <ProfileCover
        uri={profile.coverUrl}
        style={styles.cover}
        testID="public-profile-cover"
      />
      <View style={[styles.avatarWrap, { borderColor: theme.background }]}>
        <Avatar initials={profile.initials} uri={profile.avatarUrl} size={80} online={profile.isOnline} />
      </View>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <View style={{ flex: 1 }}>
            <VerifiedName profile={profile} variant="h2" badgeSize={17} />
            <AppText variant="bodyMuted">
              @{profile.username} - {profile.city}
              {profile.country ? `, ${profile.country}` : ''}
            </AppText>
          </View>
          <View style={styles.nameBadges}>
            {isBlocked ? <Badge tone="red">Blocked</Badge> : null}
            {profile.isVerified ? <Badge tone="blue">Verified</Badge> : null}
          </View>
        </View>

        <View style={styles.badges}>
          {((profile.sports && profile.sports.length ? profile.sports : [profile.primarySport])).map((sport) => {
            const primaryKey = sportKeyFor(profile.primarySport) ?? sportKeyFor(profile.sports[0]);
            const activeSportKey = selectedSport ?? primaryKey;
            const key = sportKeyFor(sport);
            const isSelected = Boolean(key && key === activeSportKey);
            return (
              <SportBadge
                key={sport}
                sport={sport}
                selected={isSelected}
                onPress={() => handleSportPress(sport)}
              />
            );
          })}
          <Badge tone="dark">{profile.skillLevel}</Badge>
          {profile.badges.map((badge) => (
            <Badge key={badge} tone="orange">{badge}</Badge>
          ))}
          {profile.isHireable && <Badge tone="green">Hireable</Badge>}
        </View>

        <AppText variant="bodyMuted">{profile.bio}</AppText>

        {isBlocked ? (
          <View style={[styles.blockedNotice, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]}>
            <Ban size={16} color={theme.danger} />
            <AppText variant="bodyMuted" style={styles.blockedNoticeText}>
              You have blocked this profile. Unblock to follow or message.
            </AppText>
          </View>
        ) : null}

        <View style={styles.stats}>
          <Pressable style={styles.statTap} onPress={() => navigation.navigate('Followers', { userId: profile.id, mode: 'followers' })}>
            <StatCard value={compactNumber(profile.stats.followers)} label="Followers" tone="orange" />
          </Pressable>
          <Pressable style={styles.statTap} onPress={() => navigation.navigate('Followers', { userId: profile.id, mode: 'following' })}>
            <StatCard value={profile.stats.following} label="Following" />
          </Pressable>
          <StatCard value={`${profile.stats.winRate}%`} label="Win %" tone="green" />
        </View>

        <View style={styles.actions}>
          {isBlocked ? (
            <Button
              style={styles.actionButton}
              icon={UserX}
              variant="danger"
              disabled={blockActionLoading}
              loading={blockActionLoading}
              onPress={handleBlockToggle}
            >
              Unblock
            </Button>
          ) : (
            <Button
              style={styles.actionButton}
              icon={isFollowing ? UserCheck : UserPlus}
              variant={isFollowing || followRequestStatus === 'pending' ? 'ghost' : 'primary'}
              disabled={toggleFollow.isPending || blockActionLoading}
              loading={toggleFollow.isPending}
              onPress={handleFollow}
            >
              {isFollowing ? 'Unfollow' : followRequestStatus === 'pending' ? 'Requested' : 'Follow'}
            </Button>
          )}
          <Button
            style={styles.actionButton}
            variant="ghost"
            loading={messageLoading}
            disabled={isBlocked || messageLoading}
            onPress={() => void openChat()}
          >
            Message
          </Button>
          {profile.isHireable && !isBlocked ? (
            <Button
              style={styles.actionButton}
              variant="ghost"
              onPress={() => navigation.navigate('CreateOffer', { recipientId: profile.id })}
            >
              Offer
            </Button>
          ) : null}
          <IconButton icon={MoreHorizontal} onPress={openMore} accessibilityLabel="More options" />
        </View>

        <SegmentedControl value={tab} options={['Posts', 'Stats', 'Highlights']} onChange={setTab} />
        {tab === 'Posts' ? <ProfileGrid userId={profile.id} /> : null}
        {tab === 'Stats' ? (
          <StructuredStatsPanel
            profile={profile}
            selectedSport={selectedSport}
            onSelectSport={setSelectedSport}
          />
        ) : null}
        {tab === 'Highlights' ? <HighlightsPanel userId={profile.id} /> : null}
      </View>
    </Screen>
  );
}

// -- ProfileGrid --------------------------------------------------------------

function ProfileGrid({ userId }: { userId: string }) {
  const navigation = useNavigation<Navigation>();
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
        <AppText variant="bodyMuted" style={{ textAlign: 'center' }}>
          No posts shared yet.
        </AppText>
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
              {
                backgroundColor: theme.surface,
                borderColor: isStats ? theme.accent : theme.border,
                borderWidth: isStats ? 1 : StyleSheet.hairlineWidth
              },
              pressed ? styles.gridItemPressed : null
            ]}
          >
            {isStats ? (
              <LinearGradient colors={[theme.accent, theme.accentPressed]} style={styles.gridGradient}>
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
                  {post.mediaKind === 'court-card' && (
                    <AppText style={[styles.courtBadge, { color: theme.info, borderColor: theme.info }]}>COURT</AppText>
                  )}
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

// -- HighlightsPanel ----------------------------------------------------------

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
  const { colors: theme, isDark } = useAppTheme();
  const { data: postsList = [] } = useUserPosts(userId);
  const [filterKind, setFilterKind] = useState<'stats' | 'highlight' | null>(null);
  const topStats = postsList
    .filter((post) => post.kind === 'stats')
    .sort((a, b) => b.likes + b.comments - (a.likes + a.comments))[0];
  const streak = currentPostStreak(postsList);
  const filteredPosts = filterKind
    ? postsList.filter((post) => post.kind === filterKind)
    : postsList.filter((post) => post.kind === 'highlight');

  return (
    <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.highlightScroll}>
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
            <View style={[styles.highlightCircle, index === 0 ? styles.highlightAdd : null, { borderColor: index === 0 ? theme.accent : theme.border }]}>
              <AppText variant="h3">{index === 0 ? '+' : item.label.slice(0, 1)}</AppText>
            </View>
            <AppText variant="small">{item.label}</AppText>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.highlightCards}>
        <LinearGradient colors={[theme.accentSoft, theme.surfaceMuted]} style={styles.highlightCard}>
          <AppText variant="h2" color={theme.accent}>{topStats ? 'TOP' : 'ADD'}</AppText>
          <AppText style={[styles.highlightTitle, { color: theme.text }]} numberOfLines={3}>{topStats?.body || 'No stats posts yet'}</AppText>
          <Badge tone="orange">{topStats?.statsLine ?? 'STATS'}</Badge>
        </LinearGradient>
        <LinearGradient colors={isDark ? ['#0A1A1A', '#0F2A2A'] : ['#ECFDF5', '#D1FAE5']} style={styles.highlightCard}>
          <AppText variant="h2" color={theme.success}>{streak}</AppText>
          <AppText style={[styles.highlightTitle, { color: theme.text }]} numberOfLines={3}>Day Activity Streak</AppText>
          <Badge tone="green">STREAK</Badge>
        </LinearGradient>
      </View>
      {filteredPosts.slice(0, 4).map((post) => (
        <Pressable key={post.id} style={[styles.highlightListItem, { borderColor: theme.border }]} onPress={() => navigation.navigate('PostDetail', { postId: post.id })}>
          <AppText style={[styles.highlightTitle, { color: theme.text }]} numberOfLines={2}>{post.body}</AppText>
          <Badge>{post.kind}</Badge>
        </Pressable>
      ))}
    </View>
  );
}

// -- Styles -------------------------------------------------------------------

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0
  },
  centered: {
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  nameBadges: {
    alignItems: 'flex-end',
    gap: spacing.xs
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap'
  },
  blockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.overlays.dangerSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.semantic.danger
  },
  blockedNoticeText: {
    flex: 1
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
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center'
  },
  actionButton: {
    flex: 1
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
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    marginTop: spacing.sm
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginTop: spacing.sm
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
    backgroundColor: colors.dark[800],
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    marginTop: spacing.sm
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
