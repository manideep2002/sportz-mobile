import { memo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { Heart, MessageCircle, Share2, MoreHorizontal, Play, Bookmark } from 'lucide-react-native';

import { Avatar, Badge, Button, Card, AppText, MediaViewerModal, VerifiedName } from '@/components/ui';
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
  onSave?: () => void;
  onMore?: () => void;
  onPrimaryAction?: () => void;
  onMediaPress?: () => void;
}

function PostCardComponent({
  post,
  onPress,
  onAuthorPress,
  onLike,
  onComment,
  onShare,
  onSave,
  onMore,
  onPrimaryAction,
  onMediaPress
}: PostCardProps) {
  const [mediaLoading, setMediaLoading] = useState(Boolean(post.mediaUrl));
  const [mediaError, setMediaError] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const runAction = (event: GestureResponderEvent, action?: () => void) => {
    event.stopPropagation();
    action?.();
  };

  return (
    <>
      <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress}>
        <Card style={styles.card} padded={false}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" onPress={(event) => runAction(event, onAuthorPress)}>
              <Avatar initials={post.author.initials} uri={post.author.avatarUrl} size={40} tone="orange" online={post.author.isOnline} />
            </Pressable>
            <Pressable style={styles.author} accessibilityRole="button" onPress={(event) => runAction(event, onAuthorPress)}>
              <VerifiedName profile={post.author} style={styles.authorName} numberOfLines={1} />
              <AppText variant="small">
                {post.sport} - {timeAgo(post.createdAt)}
              </AppText>
            </Pressable>
            <View style={styles.headerActions}>
              {post.kind === 'stats' ? <Badge tone="orange">Stats</Badge> : null}
              <Pressable accessibilityRole="button" accessibilityLabel="Post options" onPress={(event) => runAction(event, onMore)}>
                <MoreHorizontal size={18} color={colors.text.tertiary} />
              </Pressable>
            </View>
          </View>
          <AppText variant="bodyMuted" style={styles.body}>
            {post.body}
          </AppText>
          {post.kind === 'stats' && post.statsLine ? (
            <View style={styles.statsLine}>
              <AppText style={styles.statsLineText}>{post.statsLine}</AppText>
            </View>
          ) : null}
          {post.mediaKind === 'image' && post.mediaUrl ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open image"
              disabled={mediaError}
              style={styles.media}
              onPress={(event) => runAction(event, () => setImageViewerOpen(true))}
            >
              {mediaLoading ? <ActivityIndicator color={colors.orange[500]} style={styles.mediaLoader} /> : null}
              {mediaError ? (
                <View style={styles.mediaFallback}>
                  <AppText variant="small">Media unavailable</AppText>
                </View>
              ) : (
                <Image
                  source={{ uri: post.mediaUrl }}
                  style={styles.mediaImage}
                  onLoadEnd={() => setMediaLoading(false)}
                  onError={() => {
                    setMediaLoading(false);
                    setMediaError(true);
                  }}
                />
              )}
            </Pressable>
          ) : null}
          {post.mediaKind === 'video' && post.mediaUrl ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Play video"
              style={styles.media}
              onPress={(event) => runAction(event, onMediaPress)}
            >
              <View style={styles.mediaVideoContainer}>
                <View style={styles.videoFallback}>
                  <AppText style={styles.videoLabel}>Video</AppText>
                </View>
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
                size={22}
                color={post.likedByMe ? colors.orange[400] : colors.text.tertiary}
                fill={post.likedByMe ? colors.orange[400] : 'transparent'}
              />
              <AppText style={[styles.actionText, post.likedByMe ? styles.actionActive : null]}>{post.likes}</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={post.kind === 'thread' ? 'View replies' : 'View comments'} style={styles.action} onPress={(event) => runAction(event, onComment)}>
              <MessageCircle size={22} color={colors.text.tertiary} />
              <AppText style={styles.actionText}>{post.comments}</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Share post" style={styles.action} onPress={(event) => runAction(event, onShare)}>
              <Share2 size={22} color={colors.text.tertiary} />
              <AppText style={styles.actionText}>{post.shares}</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={post.savedByMe ? 'Unsave post' : 'Save post'} style={styles.action} onPress={(event) => runAction(event, onSave)}>
              <Bookmark
                size={22}
                color={post.savedByMe ? colors.orange[400] : colors.text.tertiary}
                fill={post.savedByMe ? colors.orange[400] : 'transparent'}
              />
            </Pressable>
            {post.kind === 'stats' ? (
              <Button size="sm" style={styles.join} onPress={(event) => runAction(event, onPrimaryAction)}>
                View Athlete
              </Button>
            ) : null}
          </View>
          <View style={styles.footer}>
            <AppText variant="bodyMuted">
              {post.likes > 0 ? `${post.likes} ${post.likes === 1 ? 'athlete' : 'athletes'} liked this` : 'Be the first to like this'}
            </AppText>
          </View>
        </Card>
      </Pressable>
      <MediaViewerModal visible={imageViewerOpen} uri={post.mediaUrl} onClose={() => setImageViewerOpen(false)} />
    </>
  );
}

export const PostCard = memo(PostCardComponent);

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
  statsLine: {
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: colors.overlays.orangeSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.overlays.orangeBorder,
    padding: 10
  },
  statsLineText: {
    color: colors.orange[300],
    fontFamily: typography.headingBold,
    fontSize: 17
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
  mediaLoader: {
    position: 'absolute',
    zIndex: 1,
    alignSelf: 'center',
    top: 88
  },
  mediaFallback: {
    height: 200,
    borderRadius: 10,
    backgroundColor: colors.dark[700],
    alignItems: 'center',
    justifyContent: 'center'
  },
  mediaVideoContainer: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative'
  },
  videoFallback: {
    flex: 1,
    backgroundColor: colors.dark[700],
    alignItems: 'center',
    justifyContent: 'center'
  },
  videoLabel: {
    color: colors.text.secondary,
    fontFamily: typography.bodyBold,
    fontSize: 13,
    textTransform: 'uppercase'
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
    gap: 24,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    justifyContent: 'center'
  },
  actionText: {
    color: colors.text.tertiary,
    fontSize: 13
  },
  actionActive: {
    color: colors.orange[400]
  },
  join: {
    marginLeft: 'auto'
  },
  footer: {
    paddingHorizontal: 14,
    paddingBottom: 14
  }
});
