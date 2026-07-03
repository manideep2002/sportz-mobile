import { useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, ChevronLeft, Heart, MessageCircle, MessageSquare, MoreHorizontal, Trophy, UserCheck, UserPlus, UserX } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ActionSheetIOS, Alert, Platform, Pressable, ScrollView, Share, StyleSheet, View, ActivityIndicator } from 'react-native';


import { AppRefreshControl, AppText, Avatar, Badge, Button, IconButton, Screen, SegmentedControl, StatCard } from '@/components/ui';

import { colors, spacing, typography } from '@/design/tokens';
import { useProfile, useFollowRequestStatus, useIsBlocked, useIsFollowing, useToggleBlock, useToggleFollow } from '@/hooks/useProfile';
import { useUserPosts } from '@/hooks/useFeed';
import type { AppStackParamList } from '@/navigation/routes';
import type { UserProfile } from '@/types/domain';
import { messageService } from '@/services/messageService';
import { reportReasons, reportService } from '@/services/reportService';
import { compactNumber } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'UserProfile'>;

export function UserProfileScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const queryClient = useQueryClient();
  const { userId } = route.params;

  const { data: profile, isLoading, isError, isRefetching, refetch } = useProfile(userId);
  const { data: isFollowing = false, refetch: refetchFollowing } = useIsFollowing(userId);
  const { data: followRequestStatus = null, refetch: refetchFollowRequestStatus } = useFollowRequestStatus(userId);
  const { data: isBlocked = false, isLoading: isBlockedLoading, refetch: refetchBlocked } = useIsBlocked(userId);
  const toggleFollow = useToggleFollow(userId);
  const toggleBlock = useToggleBlock(userId);
  const [tab, setTab] = useState<'Posts' | 'Stats' | 'Highlights'>('Posts');
  const [messageLoading, setMessageLoading] = useState(false);
  const blockActionLoading = isBlockedLoading || toggleBlock.isPending;

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
            void Share.share({ message: `Check out ${profile?.displayName}'s profile on Sportz!` });
          } else if (index === 1) {
            reportProfile();
          } else if (index === 2) {
            handleBlockToggle();
          }
        }
      );
    } else {
      Alert.alert('Options', undefined, [
        { text: 'Share Profile', onPress: () => Share.share({ message: `Check out ${profile?.displayName}'s profile on Sportz!` }) },
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
        <ActivityIndicator color={colors.orange[500]} size="large" style={{ marginTop: 80 }} />
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
      <LinearGradient colors={['#0A1A08', '#18381A']} style={styles.cover} />
      <View style={styles.avatarWrap}>
        <Avatar initials={profile.initials} uri={profile.avatarUrl} size={80} online={profile.isOnline} />
      </View>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <View style={{ flex: 1 }}>
            <AppText variant="h2">{profile.displayName}</AppText>
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
          <Badge>{profile.primarySport}</Badge>
          <Badge tone="dark">{profile.skillLevel}</Badge>
          {profile.badges.map((badge) => (
            <Badge key={badge} tone="orange">{badge}</Badge>
          ))}
          {profile.isHireable && <Badge tone="green">Hireable</Badge>}
        </View>

        <AppText variant="bodyMuted">{profile.bio}</AppText>

        {isBlocked ? (
          <View style={styles.blockedNotice}>
            <Ban size={16} color={colors.semantic.danger} />
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
          <IconButton icon={MoreHorizontal} onPress={openMore} accessibilityLabel="More options" />
        </View>

        <SegmentedControl value={tab} options={['Posts', 'Stats', 'Highlights']} onChange={setTab} />
        {tab === 'Posts' ? <ProfileGrid userId={profile.id} /> : null}
        {tab === 'Stats' ? <StatsPanel profile={profile} /> : null}
        {tab === 'Highlights' ? <HighlightsPanel userId={profile.id} /> : null}
      </View>
    </Screen>
  );
}

// -- ProfileGrid --------------------------------------------------------------

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
              isStats ? styles.gridItemStats : null,
              pressed ? styles.gridItemPressed : null
            ]}
          >
            {isStats ? (
              <LinearGradient colors={['#FF5A1F', '#FF7A45']} style={styles.gridGradient}>
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
                  {post.mediaKind === 'court-card' && (
                    <AppText style={styles.courtBadge}>COURT</AppText>
                  )}
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

// -- StatsPanel ---------------------------------------------------------------

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
      <AppText variant="h4">Season Stats - 2026</AppText>
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
        <StatCard
          value={profile.stats.bestPoints?.toString() ?? '-'}
          label="Best PTS"
          tone="orange"
        />
        <StatCard
          value={profile.stats.avgRebounds?.toString() ?? '-'}
          label="Avg REB"
        />
        <StatCard
          value={profile.stats.games.toString()}
          label="Games"
          tone="green"
        />
      </View>
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
          <AppText style={styles.highlightTitle}>{topStats?.body || 'No stats posts yet'}</AppText>
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
