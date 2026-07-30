import { memo, useEffect, useState } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { Bookmark, ExternalLink, MapPin, MessageCircle, MoreHorizontal, Play, Share2 } from 'lucide-react-native';

import { Avatar, Badge, Card, AppText, MediaViewerModal, SportIcon, VerifiedName, VideoPlayer } from '@/components/ui';
import { LikeButton } from '@/components/social/LikeButton';
import { CourtArt } from './CourtArt';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import type { Post } from '@/types/domain';
import { timeAgo } from '@/utils/format';
import { mediaVariants } from '@/utils/mediaOptimization';
import { clampedMediaAspectRatio, mediaPlaceholderSource } from '@/utils/mediaPlaceholder';
import { supportsInAppVideoUrl } from '@/utils/share';

interface PostCardProps {
  post: Post;
  onPress?: () => void;
  onAuthorPress?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onSave?: () => void;
  onMore?: () => void;
  onPrimaryAction?: () => void;
  isVideoActive?: boolean;
  onVideoActivate?: () => void;
  /** Used only when the media URL is unsupported by the in-app player. */
  onMediaPress?: () => void;
}

function PostCardComponent({
  post,
  onPress,
  onAuthorPress,
  onComment,
  onShare,
  onSave,
  onMore,
  onPrimaryAction,
  isVideoActive,
  onVideoActivate,
  onMediaPress
}: PostCardProps) {
  const { colors: theme } = useAppTheme();
  const [mediaLoading, setMediaLoading] = useState(Boolean(post.mediaUrl));
  const [mediaError, setMediaError] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [useRawMedia, setUseRawMedia] = useState(false);
  const [localVideoActive, setLocalVideoActive] = useState(false);
  const feedImageUrl = mediaVariants.feedImage(post.mediaUrl);
  const mediaImageUrl = (useRawMedia ? post.mediaUrl : feedImageUrl) ?? post.mediaUrl ?? '';
  const mediaPlaceholder = mediaPlaceholderSource(post.mediaPlaceholder);
  const mediaAspectRatio = clampedMediaAspectRatio(post.mediaWidth, post.mediaHeight);
  const canPlayVideoInApp = supportsInAppVideoUrl(post.mediaUrl);
  const videoActive = isVideoActive ?? localVideoActive;

  useEffect(() => {
    setMediaLoading(Boolean(post.mediaUrl));
    setMediaError(false);
    setUseRawMedia(false);
    setLocalVideoActive(false);
  }, [post.mediaUrl]);
  const runAction = (event: GestureResponderEvent, action?: () => void) => {
    event.stopPropagation();
    action?.();
  };

  return (
    <>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? `Open post by ${post.author.displayName}` : undefined}
        onPress={onPress}
      >
        <Card style={styles.card} padded={false}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${post.author.displayName}'s profile`}
              onPress={(event) => runAction(event, onAuthorPress)}
            >
              <Avatar initials={post.author.initials} uri={post.author.avatarUrl} size={40} tone="orange" online={post.author.isOnline} />
            </Pressable>
            <Pressable
              style={styles.author}
              accessibilityRole="button"
              accessibilityLabel={`View ${post.author.displayName}'s profile`}
              onPress={(event) => runAction(event, onAuthorPress)}
            >
              <VerifiedName profile={post.author} style={styles.authorName} numberOfLines={1} />
              <View style={styles.sportMeta}>
                <SportIcon sport={post.sport} size={15} />
                <AppText variant="small">{post.sport} - {timeAgo(post.createdAt)}</AppText>
              </View>
            </Pressable>
            <View style={styles.headerActions}>
              {post.kind === 'stats' ? <Badge tone="orange">Stats</Badge> : null}
              {onMore ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Post options"
                  hitSlop={12}
                  style={styles.moreButton}
                  onPress={(event) => runAction(event, onMore)}
                >
                  <MoreHorizontal size={18} color={theme.textSubtle} />
                </Pressable>
              ) : null}
            </View>
          </View>
          <AppText variant="bodyMuted" style={styles.body}>
            {post.body}
          </AppText>
          {post.locationLabel ? (
            <View style={styles.location}>
              <MapPin size={14} color={theme.textSubtle} />
              <AppText variant="small">{post.locationLabel}</AppText>
            </View>
          ) : null}
          {post.kind === 'stats' && post.statsLine ? (
            <View style={[styles.statsLine, { backgroundColor: theme.accentSoft, borderColor: theme.accentBorder }]}>
              <AppText style={[styles.statsLineText, { color: theme.accent }]}>{post.statsLine}</AppText>
            </View>
          ) : null}
          {post.mediaKind === 'image' && post.mediaUrl ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open image"
              disabled={mediaError}
              style={[styles.media, styles.imageMediaFrame, { aspectRatio: mediaAspectRatio, backgroundColor: theme.surfaceMuted }]}
              onPress={(event) => runAction(event, () => setImageViewerOpen(true))}
            >
              {mediaLoading ? (
                <View pointerEvents="none" style={styles.mediaLoader}>
                  <ActivityIndicator color={theme.accent} />
                </View>
              ) : null}
              {mediaError ? (
                <View style={[styles.mediaFallback, { backgroundColor: theme.surfaceMuted }]}>
                  <AppText variant="small">Media unavailable</AppText>
                </View>
              ) : (
                <ExpoImage
                  source={{ uri: mediaImageUrl }}
                  placeholder={mediaPlaceholder ?? undefined}
                  placeholderContentFit="cover"
                  contentFit="cover"
                  transition={180}
                  cachePolicy="disk"
                  recyclingKey={post.id}
                  style={styles.mediaImage}
                  onLoadEnd={() => setMediaLoading(false)}
                  onError={() => {
                    if (!useRawMedia && post.mediaUrl && feedImageUrl !== post.mediaUrl) {
                      setUseRawMedia(true);
                      setMediaLoading(true);
                      return;
                    }
                    setMediaLoading(false);
                    setMediaError(true);
                  }}
                />
              )}
            </Pressable>
          ) : null}
          {post.mediaKind === 'video' && post.mediaUrl ? (
            canPlayVideoInApp && videoActive ? (
              <Pressable
                accessible={false}
                style={[styles.media, styles.mediaVideoContainer]}
                onPress={(event) => event.stopPropagation()}
              >
                <VideoPlayer
                  uri={post.mediaUrl}
                  autoPlay
                  paused={!videoActive}
                  muted
                  showMuteToggle
                  contentFit="cover"
                  style={styles.feedVideo}
                  testID={`feed-video-${post.id}`}
                />
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={canPlayVideoInApp ? 'Play video' : 'Open video externally'}
                disabled={!canPlayVideoInApp && !onMediaPress}
                style={styles.media}
                onPress={(event) => runAction(event, () => {
                  if (!canPlayVideoInApp) {
                    onMediaPress?.();
                    return;
                  }
                  setLocalVideoActive(true);
                  onVideoActivate?.();
                })}
              >
                <View style={styles.mediaVideoContainer}>
                  {mediaPlaceholder ? (
                    <ExpoImage
                      source={mediaPlaceholder}
                      contentFit="cover"
                      style={styles.videoPoster}
                    />
                  ) : (
                    <View style={[styles.videoFallback, { backgroundColor: theme.surfaceMuted }]}>
                      <AppText style={styles.videoLabel}>
                        {canPlayVideoInApp ? 'Video' : 'Unsupported video'}
                      </AppText>
                    </View>
                  )}
                  <View style={[styles.playButtonOverlay, { backgroundColor: theme.accent }]}>
                    {canPlayVideoInApp ? (
                      <Play size={22} color={theme.onAccent} fill={theme.onAccent} />
                    ) : (
                      <ExternalLink size={21} color={theme.onAccent} />
                    )}
                  </View>
                </View>
              </Pressable>
            )
          ) : null}
          {post.mediaKind === 'court-card' ? (
            <View style={styles.media}>
              <CourtArt statLine={post.statsLine} />
            </View>
          ) : null}
          {post.eventTeaser ? (
            <View style={styles.teaser}>
              <View style={[styles.teaserCell, { backgroundColor: theme.surfaceMuted }]}>
                <AppText variant="small">Date</AppText>
                <AppText style={styles.teaserValue}>{post.eventTeaser.dateLabel}</AppText>
              </View>
              <View style={[styles.teaserCell, { backgroundColor: theme.surfaceMuted }]}>
                <AppText variant="small">Time</AppText>
                <AppText style={styles.teaserValue}>{post.eventTeaser.timeLabel}</AppText>
              </View>
              <View style={[styles.teaserCell, { backgroundColor: theme.surfaceMuted }]}>
                <AppText variant="small">Slots</AppText>
                <AppText style={[styles.teaserValue, { color: theme.accent }]}>{post.eventTeaser.slotsLabel}</AppText>
              </View>
            </View>
          ) : null}
          <View style={styles.actions}>
            <LikeButton postId={post.id} liked={post.likedByMe} count={post.likes} />
            <Pressable accessibilityRole="button" accessibilityLabel={post.kind === 'thread' ? 'View replies' : 'View comments'} style={styles.action} onPress={(event) => runAction(event, onComment)}>
              <MessageCircle size={22} color={theme.textSubtle} />
              <AppText style={[styles.actionText, { color: theme.textSubtle }]}>{post.comments}</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Share post" style={styles.action} onPress={(event) => runAction(event, onShare)}>
              <Share2 size={22} color={theme.textSubtle} />
              <AppText style={[styles.actionText, { color: theme.textSubtle }]}>{post.shares}</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={post.savedByMe ? 'Unsave post' : 'Save post'} style={styles.action} onPress={(event) => runAction(event, onSave)}>
              <Bookmark
                size={22}
                color={post.savedByMe ? theme.accent : theme.textSubtle}
                fill={post.savedByMe ? theme.accent : 'transparent'}
              />
            </Pressable>
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
  moreButton: {
    width: 44,
    height: 44,
    marginRight: -10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  authorName: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  sportMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 10
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm
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
  imageMediaFrame: {
    borderRadius: 10,
    backgroundColor: colors.dark[800],
    overflow: 'hidden'
  },
  mediaImage: {
    width: '100%',
    height: '100%'
  },
  mediaLoader: {
    position: 'absolute',
    zIndex: 1,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center'
  },
  mediaFallback: {
    flex: 1,
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
  feedVideo: {
    width: '100%',
    height: '100%',
    borderRadius: 10
  },
  videoPoster: {
    width: '100%',
    height: '100%'
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
  footer: {
    paddingHorizontal: 14,
    paddingBottom: 14
  }
});
