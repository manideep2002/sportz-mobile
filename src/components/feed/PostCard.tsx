import { Image, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { Heart, MessageCircle, Repeat2, MoreHorizontal, Play } from 'lucide-react-native';

import { Avatar, Badge, Button, Card, AppText } from '@/components/ui';
import { CourtArt } from './CourtArt';
import { colors, spacing, typography } from '@/design/tokens';
import type { Post } from '@/types/domain';
import { timeAgo } from '@/utils/format';

interface PostCardProps {
  post: Post;
  onPress?: () => void;
  onAuthorPress?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onMore?: () => void;
  onPrimaryAction?: () => void;
  onMediaPress?: () => void;
}

export function PostCard({
  post,
  onPress,
  onAuthorPress,
  onLike,
  onComment,
  onShare,
  onMore,
  onPrimaryAction,
  onMediaPress
}: PostCardProps) {
  const runAction = (event: GestureResponderEvent, action?: () => void) => {
    event.stopPropagation();
    action?.();
  };

  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress}>
      <Card style={styles.card} padded={false}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={(event) => runAction(event, onAuthorPress)}>
            <Avatar initials={post.author.initials} size={40} tone="orange" online={post.author.isOnline} />
          </Pressable>
          <Pressable style={styles.author} accessibilityRole="button" onPress={(event) => runAction(event, onAuthorPress)}>
            <AppText style={styles.authorName}>{post.author.displayName}</AppText>
            <AppText variant="small">
              {post.sport} - {timeAgo(post.createdAt)}
            </AppText>
          </Pressable>
          <View style={styles.headerActions}>
            {post.kind === 'stats' ? <Badge tone="orange">MVP</Badge> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Post options" onPress={(event) => runAction(event, onMore)}>
              <MoreHorizontal size={18} color={colors.text.tertiary} />
            </Pressable>
          </View>
        </View>
        <AppText variant="bodyMuted" style={styles.body}>
          {post.body}
        </AppText>
        {post.mediaKind === 'image' && post.mediaUrl ? (
          <View style={styles.media}>
            <Image source={{ uri: post.mediaUrl }} style={styles.mediaImage} />
          </View>
        ) : null}
        {post.mediaKind === 'video' && post.mediaUrl ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Play video"
            style={styles.media}
            onPress={(event) => runAction(event, onMediaPress)}
          >
            <View style={styles.mediaVideoContainer}>
              <Image source={{ uri: 'https://images.unsplash.com/photo-1546519638-68e109498ffc' }} style={styles.mediaImage} />
              <View style={styles.playButtonOverlay}>
                <Play size={22} color="#0A0907" fill="#0A0907" />
              </View>
            </View>
          </Pressable>
        ) : null}
        {post.mediaKind === 'court-card' ? (
          <View style={styles.media}>
            <CourtArt statLine={post.statsLine} />
          </View>
        ) : null}
        {post.eventTeaser ? (
          <View style={styles.teaser}>
            <View style={styles.teaserCell}>
              <AppText variant="small">Date</AppText>
              <AppText style={styles.teaserValue}>{post.eventTeaser.dateLabel}</AppText>
            </View>
            <View style={styles.teaserCell}>
              <AppText variant="small">Time</AppText>
              <AppText style={styles.teaserValue}>{post.eventTeaser.timeLabel}</AppText>
            </View>
            <View style={styles.teaserCell}>
              <AppText variant="small">Slots</AppText>
              <AppText style={[styles.teaserValue, { color: colors.orange[500] }]}>{post.eventTeaser.slotsLabel}</AppText>
            </View>
          </View>
        ) : null}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={post.likedByMe ? 'Unlike post' : 'Like post'} style={styles.action} onPress={(event) => runAction(event, onLike)}>
            <Heart
              size={17}
              color={post.likedByMe ? colors.orange[400] : colors.text.tertiary}
              fill={post.likedByMe ? colors.orange[400] : 'transparent'}
            />
            <AppText style={[styles.actionText, post.likedByMe ? styles.actionActive : null]}>{post.likes}</AppText>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="View comments" style={styles.action} onPress={(event) => runAction(event, onComment)}>
            <MessageCircle size={17} color={colors.text.tertiary} />
            <AppText style={styles.actionText}>{post.comments}</AppText>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Share post" style={styles.action} onPress={(event) => runAction(event, onShare)}>
            <Repeat2 size={17} color={colors.text.tertiary} />
            {post.shares > 0 ? <AppText style={styles.actionText}>{post.shares}</AppText> : null}
          </Pressable>
          {post.kind === 'stats' ? (
            <Button size="sm" style={styles.join} onPress={(event) => runAction(event, onPrimaryAction)}>
              View Athlete
            </Button>
          ) : (
            <Pressable accessibilityRole="button" onPress={(event) => runAction(event, onPrimaryAction)}>
              <AppText style={styles.reply}>{post.kind === 'thread' ? 'Reply to thread' : 'Comment'}</AppText>
            </Pressable>
          )}
        </View>
        <View style={styles.footer}>
          <AppText variant="bodyMuted">
            {post.likes > 0 ? `${post.likes} ${post.likes === 1 ? 'athlete' : 'athletes'} liked this` : 'Be the first to like this'}
          </AppText>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.screen,
    marginBottom: 12
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 14,
    paddingBottom: 0
  },
  author: {
    flex: 1
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  authorName: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 10
  },
  media: {
    marginHorizontal: 14,
    marginTop: 10
  },
  mediaImage: {
    width: '100%',
    height: 200,
    borderRadius: 10
  },
  mediaVideoContainer: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative'
  },
  playButtonOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -22 }, { translateY: -22 }],
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.orange[500],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4
  },
  teaser: {
    flexDirection: 'row',
    gap: 8,
    margin: 14
  },
  teaserCell: {
    flex: 1,
    backgroundColor: colors.dark[700],
    borderRadius: 10,
    padding: 10
  },
  teaserValue: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 13,
    marginTop: 2
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  actionText: {
    color: colors.text.tertiary,
    fontSize: 12
  },
  actionActive: {
    color: colors.orange[400]
  },
  join: {
    marginLeft: 'auto'
  },
  reply: {
    marginLeft: 'auto',
    color: colors.orange[400],
    fontSize: 12,
    fontFamily: typography.bodyBold
  },
  footer: {
    paddingHorizontal: 14,
    paddingBottom: 14
  }
});
