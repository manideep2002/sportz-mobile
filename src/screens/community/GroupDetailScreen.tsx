import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Lock,
  LogOut,
  MoreHorizontal,
  Plus,
  Shield,
  UserMinus,
  UserPlus,
  X,
  type LucideIcon
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { PostCard } from '@/components/feed/PostCard';
import { AppRefreshControl, AppText, Avatar, Badge, Button, IconButton, Input, Screen, VerifiedName } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import {
  useCommunity,
  useCommunityJoinRequests,
  useCommunityMembers,
  useInviteCommunityMember,
  useJoinCommunity,
  useLeaveCommunity,
  useRemoveCommunityMember,
  useRespondCommunityInvite,
  useRespondCommunityJoinRequest,
  useUpdateCommunityMemberRole
} from '@/hooks/useCommunities';
import { useCommunityPosts } from '@/hooks/useFeed';
import type { AppStackParamList } from '@/navigation/routes';
import { profileService } from '@/services/profileService';
import { useAuthStore } from '@/store/authStore';
import type { CommunityJoinRequest, CommunityMember, CommunityMemberRole, UserProfile } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'GroupDetail'>;

const roleLabel = (role?: CommunityMemberRole | null) => {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  if (role === 'follower') return 'Follower';
  return 'Member';
};

export function GroupDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const currentUserId = useAuthStore((state) => state.user?.id ?? state.profile?.id);
  const { data: community, isLoading, isError, isRefetching, error, refetch } = useCommunity(route.params.communityId);
  const canViewContent = Boolean(community?.canViewContent);
  const canManageMembers = Boolean(community?.canManageMembers);
  const {
    data: posts = [],
    isLoading: postsLoading,
    isError: postsIsError,
    isRefetching: postsRefetching,
    refetch: refetchPosts
  } = useCommunityPosts(route.params.communityId, canViewContent);
  const {
    data: members = [],
    isLoading: membersLoading,
    isError: membersIsError,
    isRefetching: membersRefetching,
    refetch: refetchMembers
  } = useCommunityMembers(route.params.communityId, canViewContent);
  const {
    data: joinRequests = [],
    isLoading: requestsLoading,
    isRefetching: requestsRefetching,
    refetch: refetchRequests
  } = useCommunityJoinRequests(route.params.communityId, canManageMembers);
  const joinCommunity = useJoinCommunity(route.params.communityId);
  const leaveCommunity = useLeaveCommunity(route.params.communityId);
  const respondInvite = useRespondCommunityInvite();
  const inviteMember = useInviteCommunityMember(route.params.communityId);
  const respondJoinRequest = useRespondCommunityJoinRequest(route.params.communityId);
  const updateMemberRole = useUpdateCommunityMemberRole(route.params.communityId);
  const removeMember = useRemoveCommunityMember(route.params.communityId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<UserProfile[]>([]);

  const refreshAll = async () => {
    const tasks: Promise<unknown>[] = [refetch()];
    if (canViewContent) tasks.push(refetchPosts(), refetchMembers());
    if (canManageMembers) tasks.push(refetchRequests());
    await Promise.all(tasks);
  };

  const handleJoin = () => {
    joinCommunity.mutate('member', {
      onSuccess: (result) => {
        if (result === 'requested') {
          Alert.alert('Request sent', 'The group admins can approve your membership request.');
        }
      },
      onError: (error) => {
        Alert.alert('Join failed', error instanceof Error ? error.message : 'Please try again.');
      }
    });
  };

  const handleInviteResponse = (approve: boolean) => {
    if (!community) return;
    respondInvite.mutate(
      { inviteId: community.pendingInviteId, communityId: community.id, approve },
      {
        onError: (error) => {
          Alert.alert(approve ? 'Accept failed' : 'Decline failed', error instanceof Error ? error.message : 'Please try again.');
        }
      }
    );
  };

  const handleLeave = () => {
    if (!community) return;
    Alert.alert('Leave group?', `You will lose access to ${community.name}'s member posts.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => leaveCommunity.mutate(undefined, {
          onSuccess: () => navigation.goBack(),
          onError: (error) => {
            Alert.alert('Leave failed', error instanceof Error ? error.message : 'Please try again.');
          }
        })
      }
    ]);
  };

  const invitePlayer = (player: UserProfile) => {
    inviteMember.mutate(player.id, {
      onSuccess: () => {
        Alert.alert('Invite sent', `${player.displayName} will get a community invite.`);
      },
      onError: (error) => {
        Alert.alert('Invite failed', error instanceof Error ? error.message : 'Please try again.');
      }
    });
  };

  if (isLoading) {
    return (
      <Screen
        contentContainerStyle={styles.content}
        refreshControl={
          <AppRefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
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

  const membershipStatus = community.membershipStatus ?? 'none';
  const statusBadge =
    membershipStatus === 'owner' ? 'Owner'
      : membershipStatus === 'admin' ? 'Admin'
        : membershipStatus === 'joined' ? 'Joined'
          : membershipStatus === 'invited' ? 'Invited'
            : membershipStatus === 'requested' ? 'Requested'
              : null;

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl
          refreshing={isRefetching || postsRefetching || membersRefetching || requestsRefetching}
          onRefresh={() => void refreshAll()}
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
          {community.sport} - {community.isPrivate ? 'Private Group' : 'Public Group'} - {community.city}
        </AppText>
        <View style={styles.badges}>
          {community.isPrivate ? <Badge tone="yellow">Private</Badge> : <Badge tone="green">Public</Badge>}
          {statusBadge ? <Badge tone={community.isAdmin ? 'orange' : 'blue'}>{statusBadge}</Badge> : null}
          <Badge>{community.memberCount} Members</Badge>
        </View>
        <AppText variant="bodyMuted">{community.description}</AppText>

        {!community.isMember ? (
          <MembershipPanel
            status={membershipStatus}
            isPrivate={Boolean(community.isPrivate)}
            loading={joinCommunity.isPending || respondInvite.isPending}
            onJoin={handleJoin}
            onAccept={() => handleInviteResponse(true)}
            onDecline={() => handleInviteResponse(false)}
          />
        ) : null}

        {community.isMember ? (
          <View style={styles.quickActions}>
            <Action icon={CalendarDays} label="Schedule" onPress={() => navigation.navigate('CreateEvent')} />
            <Action icon={Plus} label="New Post" primary onPress={() => navigation.navigate('CreatePost', { communityId: community.id })} />
            {community.isAdmin ? <Action icon={UserPlus} label="Invite" onPress={() => setInviteOpen(true)} /> : null}
            <Action icon={LogOut} label="Leave" danger onPress={handleLeave} />
          </View>
        ) : null}

        {!canViewContent ? (
          <View style={styles.privateGate}>
            <Lock size={22} color={colors.orange[400]} />
            <View style={styles.privateGateCopy}>
              <AppText style={styles.privateGateTitle}>
                {community.isPrivate ? 'Membership required' : 'Join to enter'}
              </AppText>
              <AppText variant="bodyMuted">
                {community.isPrivate
                  ? 'Admins approve access before posts and members are visible.'
                  : 'Join this group to view member posts and the roster.'}
              </AppText>
            </View>
          </View>
        ) : (
          <>
            {community.isAdmin ? (
              <JoinRequestsList
                requests={joinRequests}
                loading={requestsLoading}
                responding={respondJoinRequest.isPending}
                onRespond={(requestId, approve) => respondJoinRequest.mutate(
                  { requestId, approve },
                  {
                    onError: (error) => {
                      Alert.alert('Request update failed', error instanceof Error ? error.message : 'Please try again.');
                    }
                  }
                )}
              />
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <AppText variant="h4">Members</AppText>
                {membersLoading ? <ActivityIndicator color={colors.orange[500]} /> : <Badge>{members.length}</Badge>}
              </View>
              {membersIsError ? (
                <View style={styles.fallbackInline}>
                  <AppText variant="bodyMuted">Could not load members.</AppText>
                  <Button size="sm" onPress={() => void refetchMembers()}>Retry</Button>
                </View>
              ) : null}
              {!membersLoading && !membersIsError && members.length === 0 ? (
                <AppText variant="bodyMuted">No members yet.</AppText>
              ) : null}
              {members.map((member) => (
                <MemberRow
                  key={member.userId}
                  member={member}
                  canManage={Boolean(community.isAdmin) && member.userId !== currentUserId && member.role !== 'owner'}
                  busy={updateMemberRole.isPending || removeMember.isPending}
                  onToggleAdmin={() => updateMemberRole.mutate(
                    { userId: member.userId, role: member.role === 'admin' ? 'member' : 'admin' },
                    {
                      onError: (error) => {
                        Alert.alert('Role update failed', error instanceof Error ? error.message : 'Please try again.');
                      }
                    }
                  )}
                  onRemove={() => {
                    Alert.alert('Remove member?', `${member.profile.displayName} will lose access to this group.`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => removeMember.mutate(member.userId, {
                          onError: (error) => {
                            Alert.alert('Remove failed', error instanceof Error ? error.message : 'Please try again.');
                          }
                        })
                      }
                    ]);
                  }}
                />
              ))}
            </View>

            <View style={styles.section}>
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
          </>
        )}
      </View>
      {canViewContent ? posts.slice(0, 3).map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
        />
      )) : null}
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
                  onPress={() => invitePlayer(player)}
                >
                  <Avatar initials={player.initials} uri={player.avatarUrl} size={38} />
                  <View style={{ flex: 1 }}>
                    <VerifiedName profile={player} style={styles.inviteName} numberOfLines={1} />
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

function MembershipPanel({
  status,
  isPrivate,
  loading,
  onJoin,
  onAccept,
  onDecline
}: {
  status: string;
  isPrivate: boolean;
  loading: boolean;
  onJoin: () => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  if (status === 'invited') {
    return (
      <View style={styles.membershipPanel}>
        <AppText style={styles.panelTitle}>You have an invite</AppText>
        <View style={styles.panelActions}>
          <Button size="sm" style={styles.panelButton} loading={loading} onPress={onAccept}>Accept</Button>
          <Button size="sm" variant="dark" style={styles.panelButton} loading={loading} onPress={onDecline}>Decline</Button>
        </View>
      </View>
    );
  }

  if (status === 'requested') {
    return (
      <View style={styles.membershipPanel}>
        <AppText style={styles.panelTitle}>Request pending</AppText>
        <AppText variant="bodyMuted">Admins will review your request.</AppText>
      </View>
    );
  }

  return (
    <Button loading={loading} onPress={onJoin} full>
      {isPrivate ? 'Request to Join' : 'Join Group'}
    </Button>
  );
}

function JoinRequestsList({
  requests,
  loading,
  responding,
  onRespond
}: {
  requests: CommunityJoinRequest[];
  loading: boolean;
  responding: boolean;
  onRespond: (requestId: string, approve: boolean) => void;
}) {
  if (!loading && requests.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText variant="h4">Join Requests</AppText>
        {loading ? <ActivityIndicator color={colors.orange[500]} /> : <Badge tone="yellow">{requests.length}</Badge>}
      </View>
      {requests.map((request) => (
        <View key={request.id} style={styles.requestRow}>
          <Avatar initials={request.requester.initials} uri={request.requester.avatarUrl} size={38} />
          <View style={styles.memberMeta}>
            <VerifiedName profile={request.requester} style={styles.memberName} numberOfLines={1} />
            <AppText variant="small">@{request.requester.username}</AppText>
          </View>
          <IconButton icon={Check} size={34} iconSize={16} filled disabled={responding} onPress={() => onRespond(request.id, true)} />
          <IconButton icon={X} size={34} iconSize={16} disabled={responding} onPress={() => onRespond(request.id, false)} />
        </View>
      ))}
    </View>
  );
}

function MemberRow({
  member,
  canManage,
  busy,
  onToggleAdmin,
  onRemove
}: {
  member: CommunityMember;
  canManage: boolean;
  busy: boolean;
  onToggleAdmin: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.memberRow}>
      <Avatar initials={member.profile.initials} uri={member.profile.avatarUrl} size={40} />
      <View style={styles.memberMeta}>
        <VerifiedName profile={member.profile} style={styles.memberName} numberOfLines={1} />
        <AppText variant="small">@{member.profile.username}</AppText>
      </View>
      <Badge tone={member.role === 'owner' || member.role === 'admin' ? 'orange' : 'dark'}>{roleLabel(member.role)}</Badge>
      {canManage ? (
        <View style={styles.memberActions}>
          <IconButton
            icon={Shield}
            size={34}
            iconSize={16}
            color={member.role === 'admin' ? colors.orange[400] : colors.text.secondary}
            disabled={busy}
            onPress={onToggleAdmin}
          />
          <IconButton icon={UserMinus} size={34} iconSize={16} color={colors.semantic.danger} disabled={busy} onPress={onRemove} />
        </View>
      ) : null}
    </View>
  );
}

function Action({
  icon: Icon,
  label,
  primary = false,
  danger = false,
  onPress
}: {
  icon: LucideIcon;
  label: string;
  primary?: boolean;
  danger?: boolean;
  onPress?: () => void;
}) {
  const toneColor = danger ? colors.semantic.danger : colors.orange[500];
  return (
    <Pressable style={[styles.action, primary ? styles.actionPrimary : null, danger ? styles.actionDanger : null]} onPress={onPress}>
      <Icon size={18} color={primary ? colors.light[0] : toneColor} />
      <AppText style={[styles.actionLabel, primary ? styles.actionPrimaryLabel : danger ? styles.actionDangerLabel : null]}>{label}</AppText>
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
  membershipPanel: {
    gap: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.md
  },
  panelTitle: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold
  },
  panelActions: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  panelButton: {
    flex: 1
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  action: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 72,
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
  actionDanger: {
    borderColor: colors.semantic.danger,
    backgroundColor: colors.overlays.dangerSoft
  },
  actionLabel: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '700'
  },
  actionPrimaryLabel: {
    color: colors.light[0]
  },
  actionDangerLabel: {
    color: colors.semantic.danger
  },
  privateGate: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.md
  },
  privateGateCopy: {
    flex: 1,
    gap: spacing.xxs
  },
  privateGateTitle: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold
  },
  section: {
    gap: spacing.sm,
    paddingTop: spacing.sm
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.sm
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.sm
  },
  memberMeta: {
    flex: 1,
    minWidth: 0
  },
  memberName: {
    color: colors.text.primary,
    fontWeight: '800'
  },
  memberActions: {
    flexDirection: 'row',
    gap: spacing.xs
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
