import type { LucideIcon } from 'lucide-react-native';
import {
  Bell,
  BellOff,
  LogOut,
  Pin,
  PinOff,
  UserMinus,
  UserPlus
} from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Avatar, BottomSheet, IconButton, VerifiedName } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/design/tokens';
import type { ChatParticipantRole, UserProfile } from '@/types/domain';

type BusyAction = 'pin' | 'mute' | 'remove' | 'leave' | null;

interface ConversationSettingsSheetProps {
  open: boolean;
  title: string;
  isGroup: boolean;
  members: UserProfile[];
  participantRoles: Record<string, ChatParticipantRole>;
  currentUserId: string;
  currentUserRole: ChatParticipantRole;
  pinned: boolean;
  muted: boolean;
  busyAction: BusyAction;
  onClose: () => void;
  onTogglePinned: () => void;
  onToggleMuted: () => void;
  onAddMembers: () => void;
  onRemoveMember: (member: UserProfile) => void;
  onLeave: () => void;
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
    >
      <View style={[styles.actionIcon, danger ? styles.dangerIcon : null]}>
        {loading ? (
          <ActivityIndicator color={danger ? colors.semantic.danger : colors.orange[400]} />
        ) : (
          <Icon size={18} color={danger ? colors.semantic.danger : colors.orange[400]} />
        )}
      </View>
      <View style={styles.actionCopy}>
        <AppText style={[styles.actionLabel, danger ? styles.dangerText : null]}>{label}</AppText>
        <AppText variant="small">{detail}</AppText>
      </View>
    </Pressable>
  );
}

export function ConversationSettingsSheet({
  open,
  title,
  isGroup,
  members,
  participantRoles,
  currentUserId,
  currentUserRole,
  pinned,
  muted,
  busyAction,
  onClose,
  onTogglePinned,
  onToggleMuted,
  onAddMembers,
  onRemoveMember,
  onLeave
}: ConversationSettingsSheetProps) {
  const canManageMembers = isGroup && (currentUserRole === 'owner' || currentUserRole === 'admin');
  const canRemoveMember = (memberId: string) => {
    if (!canManageMembers || memberId === currentUserId) return false;
    if (currentUserRole === 'owner') return true;
    return participantRoles[memberId] === 'member';
  };

  return (
    <BottomSheet open={open} title="Conversation settings" onClose={onClose}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <AppText style={styles.summaryTitle} numberOfLines={2}>{title}</AppText>
          <AppText variant="small">
            {isGroup ? `${members.length} members` : 'Direct conversation'}
          </AppText>
        </View>

        <View style={styles.group}>
          <SettingsAction
            icon={pinned ? PinOff : Pin}
            label={pinned ? 'Unpin conversation' : 'Pin conversation'}
            detail={pinned ? 'Move this chat back to all messages.' : 'Keep this chat in the pinned section.'}
            loading={busyAction === 'pin'}
            onPress={onTogglePinned}
          />
          <SettingsAction
            icon={muted ? Bell : BellOff}
            label={muted ? 'Unmute notifications' : 'Mute notifications'}
            detail={muted ? 'Allow sounds and push notifications again.' : 'Stop sounds and push notifications for this chat.'}
            loading={busyAction === 'mute'}
            onPress={onToggleMuted}
          />
          {canManageMembers ? (
            <SettingsAction
              icon={UserPlus}
              label="Add members"
              detail="Invite more players to this group chat."
              onPress={onAddMembers}
            />
          ) : null}
        </View>

        {isGroup ? (
          <View style={styles.memberSection}>
            <AppText variant="caption">Members</AppText>
            <View style={styles.memberList}>
              {members.map((member) => {
                const role = participantRoles[member.id] ?? 'member';
                return (
                  <View key={member.id} style={styles.memberRow}>
                    <Avatar initials={member.initials} uri={member.avatarUrl} size={40} />
                    <View style={styles.memberCopy}>
                      <VerifiedName profile={member} style={styles.memberName} numberOfLines={1} />
                      <AppText variant="small" style={styles.role}>{role}</AppText>
                    </View>
                    {canRemoveMember(member.id) ? (
                      <IconButton
                        icon={UserMinus}
                        size={36}
                        iconSize={16}
                        color={colors.semantic.danger}
                        accessibilityLabel={`Remove ${member.displayName}`}
                        disabled={busyAction === 'remove'}
                        onPress={() => onRemoveMember(member)}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.group}>
          <SettingsAction
            icon={LogOut}
            label="Leave conversation"
            detail="This chat will be removed from your messages."
            danger
            loading={busyAction === 'leave'}
            onPress={onLeave}
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

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
  },
  memberSection: {
    gap: spacing.sm
  },
  memberList: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    backgroundColor: colors.dark[800],
    overflow: 'hidden'
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dark[700]
  },
  memberCopy: {
    flex: 1,
    minWidth: 0
  },
  memberName: {
    fontFamily: typography.bodyBold,
    fontSize: 13
  },
  role: {
    textTransform: 'capitalize'
  }
});
