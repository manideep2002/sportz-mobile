import { useEffect, useState } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Archive, ChevronLeft, ImagePlus, Search, Shield, Trash2, UserCog } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import {
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  IconButton,
  Input,
  Screen,
  VerifiedName
} from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { spacing, typography } from '@/design/tokens';
import {
  useCommunity,
  useCommunityAuditLog,
  useDeleteCommunity,
  useRemoveCommunityMember,
  useRemoveCommunityPost,
  useSetCommunityArchived,
  useTransferCommunityOwnership,
  useUpdateCommunityMemberRole,
  useUpdateCommunitySettings
} from '@/hooks/useCommunities';
import { flattenCommunityPostPages, useCommunityPosts } from '@/hooks/useFeed';
import type { AppStackParamList } from '@/navigation/routes';
import { communityService } from '@/services/communityService';
import { storageService } from '@/services/storageService';
import { useAuthStore } from '@/store/authStore';
import type { CommunityMember, CommunityPostingPermission } from '@/types/domain';
import { getCommunityMemberManagementCapabilities } from '@/utils/communityCapabilities';
import { timeAgo } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'CommunityAdmin'>;

const PAGE_SIZE = 20;

export function CommunityAdminScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { colors: theme } = useAppTheme();
  const communityId = route.params.communityId;
  const currentUserId = useAuthStore((state) => state.user?.id ?? state.profile?.id);
  const { data: community, isLoading, refetch } = useCommunity(communityId);
  const updateSettings = useUpdateCommunitySettings(communityId);
  const updateRole = useUpdateCommunityMemberRole(communityId);
  const removeMember = useRemoveCommunityMember(communityId);
  const transferOwnership = useTransferCommunityOwnership(communityId);
  const setArchived = useSetCommunityArchived(communityId);
  const deleteCommunity = useDeleteCommunity(communityId);
  const removePost = useRemoveCommunityPost(communityId);
  const { data: auditLog = [], refetch: refetchAudit } = useCommunityAuditLog(
    communityId,
    Boolean(community?.isAdmin)
  );
  const { data: postPages, refetch: refetchPosts } = useCommunityPosts(
    communityId,
    Boolean(community?.isAdmin)
  );
  const posts = flattenCommunityPostPages(postPages);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [sport, setSport] = useState('');
  const [rules, setRules] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [joinApprovalRequired, setJoinApprovalRequired] = useState(false);
  const [postingPermission, setPostingPermission] = useState<CommunityPostingPermission>('members');
  const [brandingBusy, setBrandingBusy] = useState<'avatar' | 'cover' | null>(null);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberOffset, setMemberOffset] = useState(0);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberHasMore, setMemberHasMore] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!community) return;
    setName(community.name);
    setDescription(community.description);
    setCity(community.city);
    setSport(community.sport);
    setRules(community.rules ?? '');
    setIsPrivate(Boolean(community.isPrivate));
    setJoinApprovalRequired(Boolean(community.joinApprovalRequired));
    setPostingPermission(community.postingPermission ?? 'members');
  }, [community]);

  const loadMembers = async (offset = 0, append = false) => {
    setMembersLoading(true);
    try {
      const page = await communityService.listMembersPage(communityId, {
        query: memberQuery,
        offset,
        limit: PAGE_SIZE
      });
      setMembers((current) => append ? [...current, ...page.items] : page.items);
      setMemberTotal(page.total);
      setMemberHasMore(page.hasMore);
      setMemberOffset(offset);
    } catch (error) {
      Alert.alert('Could not load members', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    if (community?.canViewContent) void loadMembers();
    // Search is submitted explicitly so typing does not query private membership data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [community?.canViewContent, communityId]);

  const refreshAdministration = async () => {
    await Promise.all([refetch(), refetchAudit(), refetchPosts(), loadMembers()]);
  };

  const saveSettings = () => {
    updateSettings.mutate({
      name,
      description,
      city,
      sport,
      isPrivate,
      rules,
      joinApprovalRequired,
      postingPermission
    }, {
      onSuccess: () => Alert.alert('Settings saved', 'Community access rules now use these settings.'),
      onError: (error) => Alert.alert('Could not save settings', error.message)
    });
  };

  const changeBranding = async (kind: 'avatar' | 'cover') => {
    const previousPath = kind === 'avatar' ? community?.avatarPath : community?.coverPath;
    setBrandingBusy(kind);
    try {
      const asset = await storageService.pickImage();
      if (!asset) return;
      const uploaded = await storageService.uploadCommunityBranding(asset, communityId, kind);
      await communityService.updateBranding(communityId, kind, uploaded.path);
      if (previousPath) await storageService.removeCommunityBranding(previousPath);
      await Promise.all([refetch(), refetchAudit()]);
    } catch (error) {
      Alert.alert('Branding update failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBrandingBusy(null);
    }
  };

  const removeBranding = async (kind: 'avatar' | 'cover') => {
    const previousPath = kind === 'avatar' ? community?.avatarPath : community?.coverPath;
    setBrandingBusy(kind);
    try {
      await communityService.updateBranding(communityId, kind, null);
      await storageService.removeCommunityBranding(previousPath);
      await Promise.all([refetch(), refetchAudit()]);
    } catch (error) {
      Alert.alert('Could not remove image', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBrandingBusy(null);
    }
  };

  const confirmTransfer = (member: CommunityMember) => {
    Alert.alert(
      'Transfer ownership?',
      `${member.profile.displayName} will become owner. You will remain an administrator.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: () => transferOwnership.mutate(member.userId, {
            onSuccess: () => {
              void refreshAdministration();
              Alert.alert('Ownership transferred');
            },
            onError: (error) => Alert.alert('Transfer failed', error.message)
          })
        }
      ]
    );
  };

  const confirmRemoveMember = (member: CommunityMember) => {
    Alert.alert(
      'Remove member?',
      `${member.profile.displayName} will lose access to this community.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setMemberActionError(null);
            setRemovingMemberId(member.userId);
            removeMember.mutate(member.userId, {
              onSuccess: () => {
                setMembers((current) => current.filter((item) => item.userId !== member.userId));
                setMemberTotal((current) => Math.max(0, current - 1));
                setRemovingMemberId(null);
                void refetchAudit();
              },
              onError: (error) => {
                setRemovingMemberId(null);
                setMemberActionError(error instanceof Error ? error.message : 'Please try again.');
              }
            });
          }
        }
      ]
    );
  };

  const confirmArchive = () => {
    const nextArchived = !community?.isArchived;
    Alert.alert(
      nextArchived ? 'Archive community?' : 'Restore community?',
      nextArchived
        ? 'Members can still view existing content, but nobody can join, post, invite, or schedule new community events.'
        : 'Joining, posting, invitations, and community events will be available again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: nextArchived ? 'Archive' : 'Restore',
          style: nextArchived ? 'destructive' : 'default',
          onPress: () => setArchived.mutate(nextArchived, {
            onSuccess: () => void refreshAdministration(),
            onError: (error) => Alert.alert('Update failed', error.message)
          })
        }
      ]
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      'Permanently delete community?',
      'This removes the community, its posts, memberships, requests, and invitations. The audit record is retained. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: () => deleteCommunity.mutate(undefined, {
            onSuccess: () => navigation.navigate('Community'),
            onError: (error) => Alert.alert('Delete failed', error.message)
          })
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <Screen contentContainerStyle={styles.content}>
        <ActivityIndicator accessibilityLabel="Loading community administration" color={theme.accent} />
      </Screen>
    );
  }

  if (!community || !community.isAdmin) {
    return (
      <Screen contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <IconButton accessibilityLabel="Back" icon={ChevronLeft} onPress={() => navigation.goBack()} />
          <AppText variant="h3">Community administration</AppText>
          <View style={styles.headerSpacer} />
        </View>
        <Card style={styles.section}>
          <AppText variant="h4">Administration unavailable</AppText>
          <AppText variant="bodyMuted">Only current owners and administrators can open this screen.</AppText>
        </Card>
      </Screen>
    );
  }

  const isOwner = Boolean(community.isOwner);

  return (
    <Screen
      keyboard
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <IconButton accessibilityLabel="Back" icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <View style={styles.headerTitle}>
          <AppText variant="h3">Manage {community.type}</AppText>
          <AppText variant="small">{community.name}</AppText>
        </View>
        {community.isArchived ? <Badge tone="yellow">Archived</Badge> : <Badge tone="green">Active</Badge>}
      </View>

      {!isOwner ? (
        <Card style={styles.section}>
          <AppText variant="h4">Administrator access</AppText>
          <AppText variant="bodyMuted">
            You can review members, requests, content, and audit activity. Only the owner can change settings,
            branding, roles, ownership, archive state, or delete this community.
          </AppText>
        </Card>
      ) : null}

      <Card style={styles.section}>
        <AppText variant="h4">Branding</AppText>
        {community.coverUrl ? (
          <ExpoImage
            accessibilityLabel={`${community.name} cover`}
            source={{ uri: community.coverUrl }}
            contentFit="cover"
            style={styles.cover}
          />
        ) : (
          <View style={[styles.cover, styles.imagePlaceholder, { backgroundColor: theme.surfaceMuted }]}>
            <ImagePlus size={24} color={theme.textMuted} />
            <AppText variant="small">No cover image</AppText>
          </View>
        )}
        <View style={styles.brandingRow}>
          <Avatar initials={community.name.slice(0, 2).toUpperCase()} uri={community.avatarUrl} size={72} />
          <View style={styles.brandingActions}>
            <Button
              size="sm"
              variant="dark"
              disabled={!isOwner}
              loading={brandingBusy === 'avatar'}
              onPress={() => void changeBranding('avatar')}
            >
              Change avatar
            </Button>
            {community.avatarPath ? (
              <Button size="sm" variant="ghost" disabled={!isOwner} onPress={() => void removeBranding('avatar')}>
                Remove
              </Button>
            ) : null}
          </View>
        </View>
        <View style={styles.buttonRow}>
          <Button
            style={styles.flexButton}
            size="sm"
            variant="dark"
            disabled={!isOwner}
            loading={brandingBusy === 'cover'}
            onPress={() => void changeBranding('cover')}
          >
            Change cover
          </Button>
          {community.coverPath ? (
            <Button style={styles.flexButton} size="sm" variant="ghost" disabled={!isOwner} onPress={() => void removeBranding('cover')}>
              Remove cover
            </Button>
          ) : null}
        </View>
      </Card>

      <Card style={styles.section}>
        <AppText variant="h4">Settings</AppText>
        <Input label="Name" value={name} editable={isOwner} onChangeText={setName} />
        <Input label="Description" value={description} editable={isOwner} multiline onChangeText={setDescription} />
        <Input label="City" value={city} editable={isOwner} onChangeText={setCity} />
        <Input label="Sport" value={sport} editable={isOwner} onChangeText={setSport} />
        <Input label="Community rules" value={rules} editable={isOwner} multiline onChangeText={setRules} />
        {community.type === 'group' ? (
          <>
            <SettingSwitch
              label="Private community"
              detail="Only accepted members can discover and view private group content."
              value={isPrivate}
              disabled={!isOwner}
              onValueChange={(value) => {
                setIsPrivate(value);
                if (value) setJoinApprovalRequired(true);
              }}
            />
            <SettingSwitch
              label="Require join approval"
              detail="New members submit a request for an administrator to review."
              value={joinApprovalRequired || isPrivate}
              disabled={!isOwner || isPrivate}
              onValueChange={setJoinApprovalRequired}
            />
            <View style={styles.fieldGroup}>
              <AppText variant="small">Who can post</AppText>
              <View style={styles.chipRow}>
                <Chip
                  selected={postingPermission === 'members'}
                  disabled={!isOwner}
                  onPress={() => setPostingPermission('members')}
                >
                  Members
                </Chip>
                <Chip
                  selected={postingPermission === 'admins'}
                  disabled={!isOwner}
                  onPress={() => setPostingPermission('admins')}
                >
                  Admins only
                </Chip>
              </View>
            </View>
          </>
        ) : (
          <AppText variant="bodyMuted">
            Page posts always use the publishing administrator&apos;s personal identity. Followers cannot publish as the page.
          </AppText>
        )}
        <Button full loading={updateSettings.isPending} disabled={!isOwner || community.isArchived} onPress={saveSettings}>
          Save settings
        </Button>
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.headerTitle}>
            <AppText variant="h4">Members</AppText>
            <AppText variant="small">{memberTotal} total</AppText>
          </View>
          {membersLoading ? <ActivityIndicator color={theme.accent} /> : null}
        </View>
        <View style={styles.searchRow}>
          <View style={styles.searchInput}>
            <Input
              accessibilityLabel="Search community members"
              icon={Search}
              placeholder="Search by name"
              value={memberQuery}
              onChangeText={setMemberQuery}
              onSubmitEditing={() => void loadMembers(0)}
            />
          </View>
          <Button size="sm" variant="dark" onPress={() => void loadMembers(0)}>Search</Button>
        </View>
        {memberActionError ? <AppText accessibilityRole="alert" style={{ color: theme.danger }}>{memberActionError}</AppText> : null}
        {members.map((member) => {
          const capabilities = getCommunityMemberManagementCapabilities(community, member, currentUserId);
          const hasActions = capabilities.canChangeRole || capabilities.canTransferOwnership || capabilities.canRemove;
          return (
          <View key={member.userId} style={[styles.memberRow, { borderColor: theme.border }]}>
            <Avatar initials={member.profile.initials} uri={member.profile.avatarUrl} size={42} />
            <View style={styles.memberMeta}>
              <VerifiedName profile={member.profile} numberOfLines={1} />
              <AppText variant="small">{member.role}</AppText>
            </View>
            {hasActions ? (
              <View style={styles.memberButtons}>
                {capabilities.canChangeRole ? <Button
                  size="sm"
                  variant="dark"
                  loading={updateRole.isPending}
                  disabled={removeMember.isPending}
                  onPress={() => updateRole.mutate({
                    userId: member.userId,
                    role: member.role === 'admin' ? (community.type === 'page' ? 'follower' : 'member') : 'admin'
                  }, {
                    onSuccess: () => {
                      void loadMembers(memberOffset);
                      void refetchAudit();
                    },
                    onError: (error) => Alert.alert('Role update failed', error.message)
                  })}
                >
                  {member.role === 'admin' ? 'Demote' : 'Admin'}
                </Button> : null}
                {capabilities.canTransferOwnership ? (
                  <IconButton
                    accessibilityLabel={`Transfer ownership to ${member.profile.displayName}`}
                    icon={UserCog}
                    onPress={() => confirmTransfer(member)}
                  />
                ) : null}
                {capabilities.canRemove ? (removingMemberId === member.userId ? (
                  <ActivityIndicator accessibilityLabel={`Removing ${member.profile.displayName}`} color={theme.danger} />
                ) : <IconButton
                  accessibilityLabel={`Remove ${member.profile.displayName}`}
                  icon={Trash2}
                  disabled={removeMember.isPending || updateRole.isPending}
                  onPress={() => confirmRemoveMember(member)}
                />) : null}
              </View>
            ) : (
              <Badge tone={member.role === 'owner' ? 'orange' : 'blue'}>{member.role}</Badge>
            )}
          </View>
          );
        })}
        {memberHasMore ? (
          <Button
            size="sm"
            variant="dark"
            loading={membersLoading}
            onPress={() => void loadMembers(memberOffset + PAGE_SIZE, true)}
          >
            Load more members
          </Button>
        ) : null}
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.headerTitle}>
            <AppText variant="h4">Content moderation</AppText>
            <AppText variant="small">Removed posts are audited without copying their private body.</AppText>
          </View>
          <Shield size={20} color={theme.accent} />
        </View>
        {posts.length === 0 ? <AppText variant="bodyMuted">No community posts.</AppText> : null}
        {posts.map((post) => (
          <View key={post.id} style={[styles.moderationRow, { borderColor: theme.border }]}>
            <View style={styles.memberMeta}>
              <AppText numberOfLines={1}>{post.author.displayName}</AppText>
              <AppText variant="small" numberOfLines={2}>{post.body || 'Media post'}</AppText>
            </View>
            <Button
              size="sm"
              variant="danger"
              loading={removePost.isPending}
              onPress={() => Alert.alert('Remove this post?', 'The action and reason will be retained in the audit log.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => removePost.mutate(
                    { postId: post.id, reason: 'Community rules' },
                    {
                      onSuccess: () => void Promise.all([refetchPosts(), refetchAudit()]),
                      onError: (error) => Alert.alert('Remove failed', error.message)
                    }
                  )
                }
              ])}
            >
              Remove
            </Button>
          </View>
        ))}
      </Card>

      <Card style={styles.section}>
        <AppText variant="h4">Administrative audit log</AppText>
        {auditLog.length === 0 ? <AppText variant="bodyMuted">No administrative actions recorded yet.</AppText> : null}
        {auditLog.map((entry) => (
          <View key={entry.id} style={[styles.auditRow, { borderColor: theme.border }]}>
            <AppText style={styles.auditAction}>{entry.action.replaceAll('_', ' ')}</AppText>
            <AppText variant="small">{timeAgo(entry.createdAt)}</AppText>
          </View>
        ))}
      </Card>

      {isOwner ? (
        <Card style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <AppText variant="h4">Lifecycle</AppText>
            <Archive size={20} color={theme.danger} />
          </View>
          <AppText variant="bodyMuted">
            Archiving is reversible and preserves content. Permanent deletion removes community content and membership records.
          </AppText>
          <Button
            variant="dark"
            full
            loading={setArchived.isPending}
            onPress={confirmArchive}
          >
            {community.isArchived ? 'Restore community' : 'Archive community'}
          </Button>
          <Button
            variant="danger"
            full
            loading={deleteCommunity.isPending}
            onPress={confirmDelete}
          >
            Delete permanently
          </Button>
        </Card>
      ) : null}
    </Screen>
  );
}

function SettingSwitch({
  label,
  detail,
  value,
  disabled,
  onValueChange
}: {
  label: string;
  detail: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors: theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      disabled={disabled}
      style={styles.switchRow}
      onPress={() => onValueChange(!value)}
    >
      <View style={styles.memberMeta}>
        <AppText>{label}</AppText>
        <AppText variant="small">{detail}</AppText>
      </View>
      <Switch
        accessible={false}
        pointerEvents="none"
        value={value}
        disabled={disabled}
        trackColor={{ false: theme.surfaceMuted, true: theme.accent }}
        onValueChange={onValueChange}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  headerTitle: {
    flex: 1,
    minWidth: 0
  },
  headerSpacer: {
    width: 44
  },
  section: {
    gap: spacing.md
  },
  cover: {
    width: '100%',
    height: 150,
    borderRadius: 14
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  brandingActions: {
    flex: 1,
    alignItems: 'flex-start',
    gap: spacing.xs
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  flexButton: {
    flex: 1
  },
  fieldGroup: {
    gap: spacing.xs
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  switchRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm
  },
  searchInput: {
    flex: 1
  },
  memberRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm
  },
  memberMeta: {
    flex: 1,
    minWidth: 0
  },
  memberButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  moderationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm
  },
  auditAction: {
    flex: 1,
    fontFamily: typography.bodyBold,
    textTransform: 'capitalize'
  }
});
