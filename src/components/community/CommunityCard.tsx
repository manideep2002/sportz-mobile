import { Pressable, StyleSheet, View } from 'react-native';
import { Users } from 'lucide-react-native';

import { AppText, Badge, Button, Card } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { Community } from '@/types/domain';

interface CommunityCardProps {
  community: Community;
  onPress: () => void;
  onViewPosts?: () => void;
  onAction?: () => void;
}

export function CommunityCard({ community, onPress, onViewPosts, onAction }: CommunityCardProps) {
  const isGroup = community.type === 'group';
  const actionLabel = isGroup
    ? community.isMember
      ? 'New Post'
      : community.membershipStatus === 'invited'
        ? 'Respond'
        : community.membershipStatus === 'requested'
          ? 'Requested'
          : community.isPrivate
            ? 'Request'
            : 'Join'
    : community.isAdmin
      ? 'New Post'
      : 'Open Page';

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <Users size={22} color={colors.light[0]} />
          </View>
          <View style={styles.meta}>
            <AppText style={styles.name}>{community.name}</AppText>
            <AppText variant="small">
              {community.type === 'group' ? `${community.memberCount} members` : `${community.followerCount ?? 0} followers`} - {community.city}
            </AppText>
          </View>
          {community.isAdmin ? <Badge tone="orange">Admin</Badge> : community.isVerified ? <Badge tone="blue">Verified</Badge> : null}
        </View>
        <View style={styles.badges}>
          {community.isPrivate ? <Badge tone="yellow">Private</Badge> : null}
          {community.membershipStatus === 'invited' ? <Badge tone="blue">Invited</Badge> : null}
          {community.membershipStatus === 'requested' ? <Badge tone="yellow">Requested</Badge> : null}
          {community.isMember && !community.isAdmin ? <Badge tone="green">Joined</Badge> : null}
        </View>
        <AppText variant="bodyMuted">{community.description}</AppText>
        {community.latestPost ? (
          <View style={styles.latest}>
            <View style={styles.liveDot} />
            <View style={{ flex: 1 }}>
              <AppText style={styles.latestTitle}>Latest update</AppText>
              <AppText variant="small">{community.latestPost}</AppText>
            </View>
          </View>
        ) : null}
        <View style={styles.actions}>
          <Button
            variant="dark"
            size="sm"
            style={styles.actionButton}
            onPress={(event) => {
              event.stopPropagation();
              (onViewPosts ?? onPress)();
            }}
          >
            View Posts
          </Button>
          <Button
            size="sm"
            style={styles.actionButton}
            disabled={community.membershipStatus === 'requested'}
            onPress={(event) => {
              event.stopPropagation();
              (onAction ?? onPress)();
            }}
          >
            {actionLabel}
          </Button>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
    gap: spacing.sm
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.orange[500],
    alignItems: 'center',
    justifyContent: 'center'
  },
  meta: {
    flex: 1
  },
  name: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  latest: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.dark[700],
    borderRadius: 10,
    padding: spacing.sm
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.semantic.success,
    marginTop: 6
  },
  latestTitle: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 12
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  actionButton: {
    flex: 1
  }
});
