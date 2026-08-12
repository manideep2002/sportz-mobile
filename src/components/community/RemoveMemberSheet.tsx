import { UserMinus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, BottomSheet, Button, VerifiedName } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, radii, spacing, typography } from '@/design/tokens';
import type { CommunityMember, UserProfile } from '@/types/domain';

export type RemoveMemberTarget =
  | UserProfile
  | CommunityMember
  | {
      id?: string;
      userId?: string;
      displayName: string;
      username?: string;
      avatarUrl?: string | null;
      initials?: string;
      isVerified?: boolean;
    };

export interface RemoveMemberSheetProps {
  open: boolean;
  member: RemoveMemberTarget | null | undefined;
  title?: string;
  contextName?: string;
  warningMessage?: string;
  confirmLabel?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function RemoveMemberSheet({
  open,
  member,
  title = 'Remove member',
  contextName,
  warningMessage,
  confirmLabel = 'Remove Member',
  loading = false,
  onClose,
  onConfirm
}: RemoveMemberSheetProps) {
  const { colors: theme } = useAppTheme();

  if (!open || !member) return null;

  const profile: Partial<UserProfile> =
    'profile' in member && member.profile
      ? member.profile
      : (member as UserProfile);

  const displayName = profile.displayName || 'this member';
  const username = profile.username;
  const avatarUrl = profile.avatarUrl;
  const initials = profile.initials || displayName.slice(0, 2).toUpperCase() || '??';

  const defaultWarning = contextName
    ? `Are you sure you want to remove ${displayName} from ${contextName}? They will lose access to member activity and content.`
    : `Are you sure you want to remove ${displayName}? They will lose access to this conversation.`;

  const description = warningMessage || defaultWarning;

  return (
    <BottomSheet open={open} title={title} onClose={onClose}>
      <View style={styles.content}>
        <View style={[styles.userCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Avatar initials={initials} uri={avatarUrl} size={48} />
          <View style={styles.userMeta}>
            {profile.id ? (
              <VerifiedName profile={profile as UserProfile} style={styles.userName} numberOfLines={1} />
            ) : (
              <AppText style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
                {displayName}
              </AppText>
            )}
            {username ? (
              <AppText variant="small" style={{ color: theme.textSubtle }}>
                @{username}
              </AppText>
            ) : null}
          </View>
        </View>

        <View style={[styles.warningBanner, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]}>
          <View style={[styles.warningIconWrap, { backgroundColor: theme.danger }]}>
            <UserMinus size={15} color="#FFFFFF" />
          </View>
          <AppText style={[styles.warningText, { color: theme.text }]}>
            {description}
          </AppText>
        </View>

        <View style={styles.actions}>
          <Button
            full
            variant="danger"
            icon={UserMinus}
            loading={loading}
            accessibilityLabel={`Confirm remove ${displayName}`}
            onPress={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button
            full
            variant="ghost"
            disabled={loading}
            accessibilityLabel="Cancel"
            onPress={onClose}
          >
            Cancel
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
    paddingBottom: spacing.sm
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    backgroundColor: colors.dark[800]
  },
  userMeta: {
    flex: 1,
    gap: spacing.xxs
  },
  userName: {
    fontFamily: typography.bodyBold,
    fontSize: 16
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.semantic.danger,
    backgroundColor: colors.overlays.dangerSoft
  },
  warningIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  warningText: {
    flex: 1,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
    lineHeight: 19
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs
  }
});
