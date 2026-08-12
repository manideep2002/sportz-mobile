import type { LucideIcon } from 'lucide-react-native';
import {
  CalendarDays,
  LogOut,
  Plus,
  Settings,
  Share2,
  Shield,
  UserPlus
} from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, BottomSheet } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, radii, spacing, typography } from '@/design/tokens';
import type { Community } from '@/types/domain';

export interface GroupSettingsSheetProps {
  open: boolean;
  community: Community | null | undefined;
  onClose: () => void;
  onShare: () => void;
  onInvite?: () => void;
  onScheduleEvent?: () => void;
  onCreatePost?: () => void;
  onManage?: () => void;
  onReport?: () => void;
  onLeave?: () => void;
  leaveLoading?: boolean;
}

function SettingsAction({
  icon: Icon,
  label,
  detail,
  danger = false,
  loading = false,
  onPress
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  danger?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  const { colors: theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ disabled: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { borderBottomColor: theme.border },
        pressed ? styles.pressed : null
      ]}
    >
      <View
        style={[
          styles.actionIcon,
          { backgroundColor: danger ? theme.dangerSoft : theme.accentSoft },
          danger ? styles.dangerIcon : null
        ]}
      >
        {loading ? (
          <ActivityIndicator color={danger ? theme.danger : theme.accent} />
        ) : (
          <Icon size={18} color={danger ? theme.danger : theme.accent} />
        )}
      </View>
      <View style={styles.actionCopy}>
        <AppText style={[styles.actionLabel, { color: danger ? theme.danger : theme.text }]}>{label}</AppText>
        <AppText variant="small">{detail}</AppText>
      </View>
    </Pressable>
  );
}

export function GroupSettingsSheet({
  open,
  community,
  onClose,
  onShare,
  onInvite,
  onScheduleEvent,
  onCreatePost,
  onManage,
  onReport,
  onLeave,
  leaveLoading = false
}: GroupSettingsSheetProps) {
  const { colors: theme } = useAppTheme();

  if (!community) return null;

  const isGroup = community.type === 'group';
  const title = isGroup ? 'Group settings' : 'Page settings';
  const subtitle = isGroup
    ? `${community.sport} • ${community.isPrivate ? 'Private group' : 'Public group'} • ${community.memberCount} ${community.memberCount === 1 ? 'member' : 'members'}`
    : `${community.sport} • Page • ${community.followerCount ?? 0} followers`;

  const canInvite = isGroup && Boolean(community.isAdmin && !community.isArchived);
  const canSchedule = isGroup && Boolean(community.isMember && !community.isArchived);
  const canPost = Boolean(community.canPost && !community.isArchived);
  const canManage = Boolean(community.isAdmin);
  const canReport = !community.isOwner;
  const canLeave = Boolean(community.isMember && !community.isOwner);

  return (
    <BottomSheet open={open} title={title} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <AppText style={styles.summaryTitle} numberOfLines={2}>{community.name}</AppText>
          <AppText variant="small">{subtitle}</AppText>
        </View>

        <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SettingsAction
            icon={Share2}
            label={isGroup ? 'Share group' : 'Share page'}
            detail={isGroup ? 'Share a link to invite players to this group.' : 'Share a link to this page.'}
            onPress={() => {
              onClose();
              onShare();
            }}
          />
          {canInvite ? (
            <SettingsAction
              icon={UserPlus}
              label="Invite players"
              detail="Search and invite athletes to join this group."
              onPress={() => {
                onClose();
                onInvite?.();
              }}
            />
          ) : null}
          {canSchedule ? (
            <SettingsAction
              icon={CalendarDays}
              label="Schedule event"
              detail="Create a match, practice, or meetup for the group."
              onPress={() => {
                onClose();
                onScheduleEvent?.();
              }}
            />
          ) : null}
          {canPost ? (
            <SettingsAction
              icon={Plus}
              label="Create post"
              detail={isGroup ? 'Share updates, photos, or news with group members.' : 'Publish a new update to this page.'}
              onPress={() => {
                onClose();
                onCreatePost?.();
              }}
            />
          ) : null}
          {canManage ? (
            <SettingsAction
              icon={Settings}
              label={isGroup ? 'Manage group' : 'Manage page'}
              detail={isGroup ? 'Edit group info, member roles, rules, and privacy.' : 'Edit page info, cover, and settings.'}
              onPress={() => {
                onClose();
                onManage?.();
              }}
            />
          ) : null}
          {canReport ? (
            <SettingsAction
              icon={Shield}
              label={isGroup ? 'Report group' : 'Report page'}
              detail={isGroup ? 'Report inappropriate content, conduct, or spam.' : 'Report inappropriate content or spam.'}
              onPress={() => {
                onClose();
                onReport?.();
              }}
            />
          ) : null}
        </View>

        {canLeave ? (
          <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SettingsAction
              icon={LogOut}
              label={isGroup ? 'Leave group' : 'Unfollow page'}
              detail={isGroup ? 'You will lose access to member posts and events.' : 'You will stop receiving updates from this page.'}
              danger
              loading={leaveLoading}
              onPress={() => {
                onClose();
                onLeave?.();
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

// Alias for convenience across communities and pages
export const CommunitySettingsSheet = GroupSettingsSheet;
export type CommunitySettingsSheetProps = GroupSettingsSheetProps;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.lg
  },
  summary: {
    gap: spacing.xxs
  },
  summaryTitle: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 16
  },
  group: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    backgroundColor: colors.dark[800]
  },
  action: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dark[700]
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlays.orangeSoft
  },
  dangerIcon: {
    backgroundColor: colors.overlays.dangerSoft
  },
  actionCopy: {
    flex: 1,
    gap: spacing.xxs
  },
  actionLabel: {
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  dangerText: {
    color: colors.semantic.danger
  },
  pressed: {
    opacity: 0.76
  }
});
