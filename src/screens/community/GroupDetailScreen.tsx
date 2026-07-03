import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalendarDays, ChevronLeft, MoreHorizontal, Plus, UserPlus, type LucideIcon } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { PostCard } from '@/components/feed/PostCard';
import { AppText, Avatar, Badge, Button, IconButton, Input, Screen } from '@/components/ui';
import { colors, spacing } from '@/design/tokens';
import { useCommunity, useJoinCommunity } from '@/hooks/useCommunities';
import { useCommunityPosts } from '@/hooks/useFeed';
import type { AppStackParamList } from '@/navigation/routes';
import { communityService } from '@/services/communityService';
import { profileService } from '@/services/profileService';
import type { UserProfile } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'GroupDetail'>;

export function GroupDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { data: community, isLoading, isError, isRefetching, error, refetch } = useCommunity(route.params.communityId);
  const {
    data: posts = [],
    isLoading: postsLoading,
    isError: postsIsError,
    isRefetching: postsRefetching,
    refetch: refetchPosts
  } = useCommunityPosts(route.params.communityId);
  const joinCommunity = useJoinCommunity(route.params.communityId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<UserProfile[]>([]);

  if (isLoading) {
    return (
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.orange[500]}
            colors={[colors.orange[500]]}
          />
        }
      >
        <View style={styles.fallback}>
          <ActivityIndicator color={colors.orange[500]} />
        </View>
      </Screen>
    );
  }

  if (isError || !community) {
    return (
      <Screen contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        </View>
        <View style={styles.fallback}>
          <AppText variant="h4">{isError ? 'Could not load group' : 'Group not found'}</AppText>
          <AppText variant="bodyMuted" style={styles.fallbackText}>
            {error instanceof Error ? error.message : 'This community may have been removed.'}
          </AppText>
          {isError ? (
            <Button size="sm" onPress={() => void refetch()}>Retry</Button>
          ) : (
            <Button size="sm" onPress={() => navigation.goBack()}>Go Back</Button>
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching || postsRefetching}
          onRefresh={() => void Promise.all([refetch(), refetchPosts()])}
          tintColor={colors.orange[500]}
          colors={[colors.orange[500]]}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }} />
        <IconButton
          icon={MoreHorizontal}
          accessibilityLabel="Group options"
          onPress={() => void Share.share({ message: `Join ${community.name} on SPORTZ.` })}
        />
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
          {community.isAdmin ? <Badge tone="orange">Admin</Badge> : null}
          <Badge>{community.memberCount} Members</Badge>
          <Badge tone="green">Active</Badge>
        </View>
        <AppText variant="bodyMuted">{community.description}</AppText>
        {!community.isMember ? (
          <Button
            loading={joinCommunity.isPending}
            onPress={() => joinCommunity.mutate('member', {
              onError: (error) => {
                Alert.alert('Join failed', error instanceof Error ? error.message : 'Please try again.');
              }
            })}
            full
          >
            Join Group
          </Button>
        ) : null}
        <View style={styles.quickActions}>
          <Action icon={CalendarDays} label="Schedule" onPress={() => navigation.navigate('CreateEvent')} />
          <Action icon={Plus} label="New Post" primary onPress={() => navigation.navigate('CreatePost', { communityId: community.id })} />
          {community.isAdmin ? <Action icon={UserPlus} label="Invite" onPress={() => setInviteOpen(true)} /> : null}
        </View>
        <AppText variant="h4">Recent Posts</AppText>
        {postsLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}
        {postsIsError ? (
          <View style={styles.fallbackInline}>
            <AppText variant="bodyMuted">Could not load posts.</AppText>
            <Button size="sm" onPress={() => void refetchPosts()}>Retry</Button>
          </View>
        ) : null}
        {!postsLoading && !postsIsError && posts.length === 0 ? (
          <AppText variant="bodyMuted">No posts in this group yet.</AppText>
        ) : null}
      </View>
      {posts.slice(0, 3).map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
        />
      ))}
      <Modal visible={inviteOpen} transparent animationType="fade" onRequestClose={() => setInviteOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInviteOpen(false)}>
          <Pressable style={styles.inviteCard}>
            <AppText variant="h3">Invite players</AppText>
            <Input
              value={inviteQuery}
              onChangeText={async (value) => {
                setInviteQuery(value);
                if (!value.trim()) {
                  setInviteResults([]);
                  return;
                }
                try {
                  setInviteResults(await profileService.listPlayers(value));
                } catch (error) {
                  Alert.alert('Search failed', error instanceof Error ? error.message : 'Please try again.');
                }
              }}
              placeholder="Search players"
            />
            <ScrollView style={styles.inviteList}>
              {inviteResults.map((player) => (
                <Pressable
                  key={player.id}
                  style={styles.inviteRow}
                  onPress={async () => {
                    try {
                      await communityService.inviteMember(community.id, player.id);
                      Alert.alert('Invite sent', `${player.displayName} will get a community invite.`);
                    } catch (error) {
                      Alert.alert('Invite failed', error instanceof Error ? error.message : 'Please try again.');
                    }
                  }}
                >
                  <Avatar initials={player.initials} uri={player.avatarUrl} size={38} />
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.inviteName}>{player.displayName}</AppText>
                    <AppText variant="small">@{player.username}</AppText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            <Button full variant="ghost" onPress={() => setInviteOpen(false)}>Done</Button>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function Action({ icon: Icon, label, primary = false, onPress }: { icon: LucideIcon; label: string; primary?: boolean; onPress?: () => void }) {
  return (
    <Pressable style={[styles.action, primary ? styles.actionPrimary : null]} onPress={onPress}>
      <Icon size={18} color={primary ? colors.light[0] : colors.orange[500]} />
      <AppText style={[styles.actionLabel, primary ? styles.actionPrimaryLabel : null]}>{label}</AppText>
    </Pressable>
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
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl
  },
  fallbackInline: {
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.md
  },
  fallbackText: {
    textAlign: 'center'
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
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlays.scrim,
    justifyContent: 'center',
    padding: spacing.screen
  },
  inviteCard: {
    backgroundColor: colors.dark[900],
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.md,
    gap: spacing.md
  },
  inviteList: {
    maxHeight: 300
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm
  },
  inviteName: {
    color: colors.text.primary,
    fontWeight: '700'
  }
});
