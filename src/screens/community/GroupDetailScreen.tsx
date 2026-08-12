import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';import {
  CalendarDays,
  Check,
  ChevronLeft,
  Lock,
  LogOut,
  MoreHorizontal,
  Plus,
  Settings,
  Shield,
  UserMinus,
  UserPlus,
  X,
  type LucideIcon
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useMemo, useState } from 'react';

import { CommunityPostFeed } from '@/components/community/CommunityPostFeed';
import { GroupSettingsSheet } from '@/components/community/GroupSettingsSheet';
import { RemoveMemberSheet } from '@/components/community/RemoveMemberSheet';
import { EventCard } from '@/components/events/EventCard';
import { AppRefreshControl, AppText, Avatar, Badge, Button, IconButton, Input, Screen, VerifiedName } from '@/components/ui';
import { ReportSheet } from '@/components/moderation/ReportSheet';
import { useAppTheme } from '@/design/ThemeProvider';
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
import { flattenCommunityPostPages, useCommunityPosts } from '@/hooks/useFeed';
import { useCommunityEvents } from '@/hooks/useEvents';
import { usePlayerSearch } from '@/hooks/usePlayerSearch';
import type { AppStackParamList } from '@/navigation/routes';
import { shareCanonicalEntity } from '@/services/canonicalLinkService';
import { useAuthStore } from '@/store/authStore';
import type { CommunityJoinRequest, CommunityMember, CommunityMemberRole, UserProfile } from '@/types/domain';
import { getCommunityMemberManagementCapabilities } from '@/utils/communityCapabilities';

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
  const { colors: theme } = useAppTheme();
  const route = useRoute<Route>();
  const currentUserId = useAuthStore((state) => state.user?.id ?? state.profile?.id);
  const { data: community, isLoading, isError, isRefetching, error, refetch } = useCommunity(route.params.communityId);
  const canViewContent = Boolean(community?.canViewContent);
  const canManageMembers = Boolean(community?.canManageMembers);
  const {
    data: postsData,
    isLoading: postsLoading,
    isError: postsIsError,
    isRefetching: postsRefetching,
    error: postsError,
    refetch: refetchPosts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError
  } = useCommunityPosts(route.params.communityId, canViewContent);
  const { data: groupEvents = [], isLoading: groupEventsLoading, isError: groupEventsIsError, refetch: refetchGroupEvents } =
    useCommunityEvents(route.params.communityId, canViewContent);
  const posts = flattenCommunityPostPages(postsData);
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<CommunityMember | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const memberIds = useMemo(
    () => new Set(members.map((member) => member.profile?.id).filter((id): id is string => Boolean(id))),
    [members]
  );
  const inviteSearch = usePlayerSearch({ excludeIds: memberIds });

  const refreshAll = async () => {
    const tasks: Promise<unknown>[] = [refetch()];
    if (canViewContent) tasks.push(refetchPosts(), refetchMembers(), refetchGroupEvents());
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
          <ActivityIndicator color={theme.accent} />
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
      maxWidth="wide"
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
          onPress={() => setSettingsOpen(true)}
        />
      </View>
      {community.coverUrl ? (
        <ExpoImage
          accessibilityLabel={`${community.name} cover`}
          source={{ uri: community.coverUrl }}
          contentFit="cover"
          style={styles.cover}
        />
      ) : (
        <LinearGradient colors={['#0A1A08', '#1a3a18', '#0A1A08']} style={styles.cover}>
          <AppText variant="hero" style={styles.coverMark}>
            {community.name.charAt(0).toUpperCase()}
          </AppText>
        </LinearGradient>
      )}
      <View style={styles.body}>
        <AppText variant="h2">{community.name}</AppText>
        <AppText variant="bodyMuted">
          {community.sport} - {community.isPrivate ? 'Private Group' : 'Public Group'} - {community.city}
        </AppText>
        <View style={styles.badges}>
          {community.isPrivate ? <Badge tone="yellow">Private</Badge> : <Badge tone="green">Public</Badge>}
          {statusBadge ? <Badge tone={community.isAdmin ? 'orange' : 'blue'}>{statusBadge}</Badge> : null}
          {community.isArchived ? <Badge tone="yellow">Archived</Badge> : null}
          <Badge>{community.memberCount} Members</Badge>
        </View>
        <AppText variant="bodyMuted">{community.description}</AppText>
        {community.rules ? (
          <View style={[styles.membershipPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <AppText variant="h4">Community rules</AppText>
            <AppText variant="bodyMuted">{community.rules}</AppText>
          </View>
        ) : null}
        {community.isArchived ? (
          <View style={[styles.membershipPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <AppText variant="h4">This group is archived</AppText>
            <AppText variant="bodyMuted">Existing content remains available to members, but new activity is disabled.</AppText>
          </View>
        ) : null}

        {!community.isMember && !community.isArchived ? (
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
            {!community.isArchived ? <Action icon={CalendarDays} label="Schedule" onPress={() => navigation.navigate('CreateEvent', { communityId: community.id })} /> : null}
            {community.canPost ? <Action icon={Plus} label="New Post" primary onPress={() => navigation.navigate('CreatePost', { communityId: community.id })} /> : null}
            {community.isAdmin && !community.isArchived ? <Action icon={UserPlus} label="Invite" onPress={() => setInviteOpen(true)} /> : null}
            {community.isAdmin ? <Action icon={Settings} label="Manage" onPress={() => navigation.navigate('CommunityAdmin', { communityId: community.id })} /> : null}
            {!community.isOwner ? <Action icon={LogOut} label="Leave" danger onPress={handleLeave} /> : null}
          </View>
        ) : null}

        {!canViewContent ? (
          <View style={[styles.privateGate, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Lock size={22} color={theme.accent} />
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
                {membersLoading ? <ActivityIndicator color={theme.accent} /> : <Badge>{members.length}</Badge>}
              </View>
              {membersIsError ? (
                <View style={[styles.fallbackInline, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <AppText variant="bodyMuted">Could not load members.</AppText>
                  <Button size="sm" onPress={() => void refetchMembers()}>Retry</Button>
                </View>
              ) : null}
              {!membersLoading && !membersIsError && members.length === 0 ? (
                <AppText variant="bodyMuted">No members yet.</AppText>
              ) : null}
              {memberActionError ? <AppText accessibilityRole="alert" style={{ color: theme.danger }}>{memberActionError}</AppText> : null}
              {members.map((member) => {
                const capabilities = getCommunityMemberManagementCapabilities(community, member, currentUserId);
                return (
                <MemberRow
                  key={member.userId}
                  member={member}
                  canChangeRole={capabilities.canChangeRole}
                  canRemove={capabilities.canRemove}
                  busy={updateMemberRole.isPending || removeMember.isPending}
                  removing={removingMemberId === member.userId}
                  onToggleAdmin={() => updateMemberRole.mutate(
                    { userId: member.userId, role: member.role === 'admin' ? 'member' : 'admin' },
                    {
                      onError: (error) => {
                        Alert.alert('Role update failed', error instanceof Error ? error.message : 'Please try again.');
                      }
                    }
                  )}
                  onRemove={() => setMemberToRemove(member)}
                />
                );
              })}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <AppText variant="h4">Group Events</AppText>
                {groupEventsLoading ? <ActivityIndicator color={theme.accent} /> : <Badge>{groupEvents.length}</Badge>}
              </View>
              {groupEventsIsError ? (
                <View style={[styles.fallbackInline, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <AppText variant="bodyMuted">Could not load group events.</AppText>
                  <Button size="sm" onPress={() => void refetchGroupEvents()}>Retry</Button>
                </View>
              ) : null}
              {!groupEventsLoading && !groupEventsIsError && groupEvents.length === 0 ? (
                <AppText variant="bodyMuted">No upcoming group events yet.</AppText>
              ) : null}
              {groupEvents.map((event) => (
                <EventCard key={event.id} event={event} onPress={() => navigation.navigate('EventDetail', { eventId: event.id })} />
              ))}
            </View>
            <View style={styles.section}>
              <AppText variant="h4">Recent Posts</AppText>
            </View>
          </>
        )}
      </View>
      {canViewContent ? (
        <CommunityPostFeed
          posts={posts}
          emptyMessage="No posts in this group yet."
          isLoading={postsLoading}
          isError={postsIsError}
          error={postsError}
          onRetry={() => void refetchPosts()}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          isFetchNextPageError={isFetchNextPageError}
          onLoadMore={() => void fetchNextPage()}
        />
      ) : null}
      <GroupSettingsSheet
        open={settingsOpen}
        community={community}
        onClose={() => setSettingsOpen(false)}
        onShare={() => void shareCanonicalEntity('group', community.id, {
          title: community.isPrivate ? 'SPORTZ group' : community.name,
          message: community.isPrivate
            ? 'Open this private SPORTZ group. Membership access rules apply.'
            : `Join ${community.name} on SPORTZ.`
        })}
        onInvite={() => setInviteOpen(true)}
        onScheduleEvent={() => navigation.navigate('CreateEvent', { communityId: community.id })}
        onCreatePost={() => navigation.navigate('CreatePost', { communityId: community.id })}
        onManage={() => navigation.navigate('CommunityAdmin', { communityId: community.id })}
        onReport={() => setReportSheetOpen(true)}
        onLeave={handleLeave}
        leaveLoading={leaveCommunity.isPending}
      />
      <RemoveMemberSheet
        open={Boolean(memberToRemove)}
        member={memberToRemove}
        contextName={community?.name}
        loading={removeMember.isPending}
        onClose={() => setMemberToRemove(null)}
        onConfirm={() => {
          if (!memberToRemove) return;
          const targetUserId = memberToRemove.userId;
          setMemberActionError(null);
          setRemovingMemberId(targetUserId);
          removeMember.mutate(targetUserId, {
            onSuccess: () => {
              setRemovingMemberId(null);
              setMemberToRemove(null);
            },
            onError: (error) => {
              setRemovingMemberId(null);
              setMemberToRemove(null);
              setMemberActionError(error instanceof Error ? error.message : 'Please try again.');
            }
          });
        }}
      />
      <ReportSheet
        open={reportSheetOpen}
        entityLabel="group"
        entityType="group"
        entityId={community.id}
        onClose={() => setReportSheetOpen(false)}
      />
      <Modal visible={inviteOpen} transparent animationType="fade" onRequestClose={() => setInviteOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInviteOpen(false)}>
          <Pressable style={[styles.inviteCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <AppText variant="h3">Invite players</AppText>
            <Input
              value={inviteSearch.query}
              onChangeText={inviteSearch.setQuery}
              placeholder="Search players"
            />
            {inviteSearch.isLoading ? <ActivityIndicator color={theme.accent} /> : null}
            {inviteSearch.isError ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry player search"
                style={styles.searchError}
                onPress={() => void inviteSearch.retry()}
              >
                <AppText variant="bodyMuted">Could not search players. Tap to retry.</AppText>
              </Pressable>
            ) : null}
            {!inviteSearch.isLoading && !inviteSearch.isError && inviteSearch.query.trim() && inviteSearch.results.length === 0 ? (
              <AppText variant="bodyMuted" style={styles.searchError}>No players found.</AppText>
            ) : null}
            <ScrollView style={styles.inviteList}>
              {inviteSearch.results.map((player) => (
                <Pressable
                  key={player.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Invite ${player.displayName}`}
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
  const { colors: theme } = useAppTheme();
  if (status === 'invited') {
    return (
      <View style={[styles.membershipPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
      <View style={[styles.membershipPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
  const { colors: theme } = useAppTheme();
  if (!loading && requests.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText variant="h4">Join Requests</AppText>
        {loading ? <ActivityIndicator color={theme.accent} /> : <Badge tone="yellow">{requests.length}</Badge>}
      </View>
      {requests.map((request) => (
        <View key={request.id} style={[styles.requestRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Avatar initials={request.requester.initials} uri={request.requester.avatarUrl} size={38} />
          <View style={styles.memberMeta}>
            <VerifiedName profile={request.requester} style={styles.memberName} numberOfLines={1} />
            <AppText variant="small">@{request.requester.username}</AppText>
          </View>
          <IconButton icon={Check} size={34} iconSize={16} filled accessibilityLabel={`Approve ${request.requester.displayName}'s request`} disabled={responding} onPress={() => onRespond(request.id, true)} />
          <IconButton icon={X} size={34} iconSize={16} accessibilityLabel={`Decline ${request.requester.displayName}'s request`} disabled={responding} onPress={() => onRespond(request.id, false)} />
        </View>
      ))}
    </View>
  );
}

function MemberRow({
  member,
  canChangeRole,
  canRemove,
  busy,
  removing,
  onToggleAdmin,
  onRemove
}: {
  member: CommunityMember;
  canChangeRole: boolean;
  canRemove: boolean;
  busy: boolean;
  removing: boolean;
  onToggleAdmin: () => void;
  onRemove: () => void;
}) {
  const navigation = useNavigation<Navigation>();
  const { colors: theme } = useAppTheme();
  return (
    <View style={[styles.memberRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Avatar
        initials={member.profile.initials}
        uri={member.profile.avatarUrl}
        size={40}
        accessibilityLabel={`View ${member.profile.displayName}'s profile`}
        onPress={() => navigation.navigate('UserProfile', { userId: member.profile.id })}
      />
      <View style={styles.memberMeta}>
        <VerifiedName
          profile={member.profile}
          style={styles.memberName}
          numberOfLines={1}
          onPress={() => navigation.navigate('UserProfile', { userId: member.profile.id })}
        />
        <AppText variant="small">@{member.profile.username}</AppText>
      </View>
      <Badge tone={member.role === 'owner' || member.role === 'admin' ? 'orange' : 'dark'}>{roleLabel(member.role)}</Badge>
      {canChangeRole || canRemove ? (
        <View style={styles.memberActions}>
          {canChangeRole ? <IconButton
            icon={Shield}
            size={34}
            iconSize={16}
            color={member.role === 'admin' ? theme.accent : theme.textMuted}
            accessibilityLabel={member.role === 'admin' ? `Remove admin role from ${member.profile.displayName}` : `Make ${member.profile.displayName} an admin`}
            disabled={busy}
            onPress={onToggleAdmin}
          /> : null}
          {canRemove ? (removing ? (
            <ActivityIndicator accessibilityLabel={`Removing ${member.profile.displayName}`} color={theme.danger} />
          ) : (
            <IconButton icon={UserMinus} size={34} iconSize={16} color={theme.danger} accessibilityLabel={`Remove ${member.profile.displayName} from community`} disabled={busy} onPress={onRemove} />
          )) : null}
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
  const { colors: theme } = useAppTheme();
  const toneColor = danger ? theme.danger : theme.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.action,
        {
          backgroundColor: primary ? theme.accent : danger ? theme.dangerSoft : theme.surface,
          borderColor: primary ? theme.accent : danger ? theme.danger : theme.border
        }
      ]}
      onPress={onPress}
    >
      <Icon size={18} color={primary ? theme.onAccent : toneColor} />
      <AppText style={[styles.actionLabel, { color: primary ? theme.onAccent : danger ? theme.danger : theme.textMuted }]}>{label}</AppText>
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
  searchError: {
    textAlign: 'center',
    paddingVertical: spacing.sm
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
