import { memo, useEffect, useRef, useState } from 'react';
import { Image as ExpoImage } from 'expo-image';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { ActivityIndicator, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { Bookmark, Briefcase, ExternalLink, MapPin, MessageCircle, MoreHorizontal, Play, Share2 } from 'lucide-react-native';

import { Avatar, Badge, Card, AppText, MediaViewerModal, SportIcon, VerifiedName, VideoPlayer } from '@/components/ui';
import { LikeButton } from '@/components/social/LikeButton';
import { CourtArt } from './CourtArt';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, radii, spacing, typography } from '@/design/tokens';
import type { Post, TryoutCommitment, TryoutDetails } from '@/types/domain';
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
  sharePending?: boolean;
  onSave?: () => void;
  onMore?: () => void;
  onPrimaryAction?: () => void;
  onViewLikes?: () => void;
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
  sharePending = false,
  onSave,
  onMore,
  onPrimaryAction,
  onViewLikes,
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
  // Lazily-generated thumbnail for videos without a mediaPlaceholder
  const [lazyVideoThumb, setLazyVideoThumb] = useState<string | null>(null);
  const lazyThumbFetched = useRef(false);
  const feedImageUrl = mediaVariants.feedImage(post.mediaUrl);
  const mediaImageUrl = (useRawMedia ? post.mediaUrl : feedImageUrl) ?? post.mediaUrl ?? '';
  const mediaPlaceholder = mediaPlaceholderSource(post.mediaPlaceholder);
  const mediaAspectRatio = clampedMediaAspectRatio(post.mediaWidth, post.mediaHeight);
  const canPlayVideoInApp = supportsInAppVideoUrl(post.mediaUrl);
  const videoActive = isVideoActive ?? localVideoActive;

  // For video posts with no stored placeholder: generate a thumbnail lazily
  // from the remote URL so the poster looks good without a DB migration.
  useEffect(() => {
    if (
      post.mediaKind !== 'video' ||
      post.mediaPlaceholder ||
      !post.mediaUrl ||
      lazyThumbFetched.current
    ) return;
    lazyThumbFetched.current = true;
    VideoThumbnails.getThumbnailAsync(post.mediaUrl, { time: 2000, quality: 0.6 })
      .then(({ uri }) => setLazyVideoThumb(uri))
      .catch(() => { /* silently ignore — generic fallback will be shown */ });
  }, [post.mediaKind, post.mediaPlaceholder, post.mediaUrl]);

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
              {post.kind === 'highlight' ? <Badge tone="orange">Highlight</Badge> : null}
              {post.kind === 'tryout' ? <Badge tone="teal">Open Spot</Badge> : null}
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
                style={styles.media}
                onPress={(event) => event.stopPropagation()}
              >
                <View style={styles.mediaVideoContainer}>
                  <VideoPlayer
                    uri={post.mediaUrl}
                    autoPlay
                    paused={!videoActive}
                    muted
                    showMuteToggle
                    showProgress
                    contentFit="cover"
                    style={styles.feedVideo}
                    testID={`feed-video-${post.id}`}
                  />
                </View>
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
                  {/* Prefer stored placeholder → lazily-fetched thumb → generic fallback */}
                  {mediaPlaceholder ? (
                    <ExpoImage
                      source={mediaPlaceholder}
                      contentFit="cover"
                      style={styles.videoPoster}
                    />
                  ) : lazyVideoThumb ? (
                    <ExpoImage
                      source={{ uri: lazyVideoThumb }}
                      contentFit="cover"
                      style={styles.videoPoster}
                    />
                  ) : (
                    <View style={[styles.videoFallback, { backgroundColor: theme.surfaceMuted }]}>
                      {/* Show spinner while lazy thumb is loading */}
                      <ActivityIndicator color={theme.textSubtle} size="small" />
                    </View>
                  )}
                  {/* Gradient scrim over the poster */}
                  <View style={styles.posterScrim} pointerEvents="none" />
                  {/* VIDEO chip top-left */}
                  <View style={styles.videoBadge} pointerEvents="none">
                    <AppText style={styles.videoBadgeText}>VIDEO</AppText>
                  </View>
                  {/* Play / external button */}
                  <View style={[styles.playButtonOverlay, { backgroundColor: canPlayVideoInApp ? colors.orange[500] : theme.accent }]}>
                    {canPlayVideoInApp ? (
                      <Play size={22} color={colors.light[0]} fill={colors.light[0]} />
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
          {post.kind === 'tryout' && post.tryout ? (
            <TryoutCard tryout={post.tryout} />
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share post"
              accessibilityState={{ disabled: sharePending }}
              disabled={sharePending}
              style={styles.action}
              onPress={(event) => runAction(event, onShare)}
            >
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
            <Pressable
              accessibilityRole={onViewLikes && post.likes > 0 ? 'button' : undefined}
              accessibilityLabel={post.likes > 0 ? `View ${post.likes} likes` : undefined}
              disabled={!onViewLikes || post.likes === 0}
              onPress={(event) => runAction(event, onViewLikes)}
            >
              <AppText variant="bodyMuted">
                {post.likes > 0 ? `${post.likes} ${post.likes === 1 ? 'athlete' : 'athletes'} liked this` : 'Be the first to like this'}
              </AppText>
            </Pressable>
          </View>
        </Card>
      </Pressable>
      <MediaViewerModal visible={imageViewerOpen} uri={post.mediaUrl} onClose={() => setImageViewerOpen(false)} />
    </>
  );
}

export const PostCard = memo(PostCardComponent);

/** Maps a commitment key to a human-friendly label. */
const COMMITMENT_LABELS: Record<TryoutCommitment, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  seasonal: 'Seasonal',
  trial: 'Trial'
};

const TRYOUT_TEAL = '#14B8A6';
const TRYOUT_TEAL_SOFT = 'rgba(20,184,166,0.10)';
const TRYOUT_TEAL_BORDER = 'rgba(20,184,166,0.30)';
const TRYOUT_TEAL_DIM = 'rgba(20,184,166,0.55)';

function TryoutCard({ tryout }: { tryout: TryoutDetails }) {
  const extras = [
    tryout.compensation ? `💰 ${tryout.compensation}` : null,
    tryout.requirements ? `📋 ${tryout.requirements}` : null,
    tryout.applicationDeadline ? `📅 Deadline: ${tryout.applicationDeadline}` : null
  ].filter(Boolean) as string[];

  return (
    <View style={pcTryoutStyles.card}>
      {/* Top teal accent bar */}
      <View style={pcTryoutStyles.accentBar} />

      <View style={pcTryoutStyles.inner}>
        {/* Position headline */}
        <View style={pcTryoutStyles.headlineRow}>
          <View style={pcTryoutStyles.iconBubble}>
            <Briefcase size={15} color={TRYOUT_TEAL} />
          </View>
          <View style={pcTryoutStyles.headlineText}>
            <AppText style={pcTryoutStyles.positionText} numberOfLines={1}>{tryout.position}</AppText>
            <AppText style={pcTryoutStyles.teamText} numberOfLines={1}>{tryout.teamName}</AppText>
          </View>
          <View style={pcTryoutStyles.commitmentChip}>
            <AppText style={pcTryoutStyles.commitmentText}>{COMMITMENT_LABELS[tryout.commitment]}</AppText>
          </View>
        </View>

        {/* Divider */}
        <View style={pcTryoutStyles.divider} />

        {/* Location row */}
        <View style={pcTryoutStyles.infoRow}>
          <MapPin size={13} color={TRYOUT_TEAL_DIM} />
          <AppText style={pcTryoutStyles.infoText} numberOfLines={1}>{tryout.location}</AppText>
        </View>

        {/* Optional extras */}
        {extras.length > 0 ? (
          <View style={pcTryoutStyles.extrasWrap}>
            {extras.map((line, i) => (
              <AppText key={i} style={pcTryoutStyles.extraText} numberOfLines={2}>{line}</AppText>
            ))}
          </View>
        ) : null}

        {/* Contact row */}
        {tryout.contactInfo ? (
          <View style={pcTryoutStyles.contactRow}>
            <AppText style={pcTryoutStyles.contactLabel}>How to apply</AppText>
            <AppText style={pcTryoutStyles.contactValue} numberOfLines={1}>{tryout.contactInfo}</AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const pcTryoutStyles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: radii.md,
    backgroundColor: TRYOUT_TEAL_SOFT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: TRYOUT_TEAL_BORDER,
    overflow: 'hidden'
  },
  accentBar: {
    height: 3,
    backgroundColor: TRYOUT_TEAL
  },
  inner: {
    padding: 12,
    gap: 8
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: TRYOUT_TEAL_BORDER,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headlineText: {
    flex: 1
  },
  positionText: {
    color: TRYOUT_TEAL,
    fontFamily: typography.headingBold,
    fontSize: 16,
    letterSpacing: 0.3
  },
  teamText: {
    color: colors.text.secondary,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: 1
  },
  commitmentChip: {
    backgroundColor: TRYOUT_TEAL_BORDER,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 3
  },
  commitmentText: {
    color: TRYOUT_TEAL,
    fontFamily: typography.bodyBold,
    fontSize: 10,
    letterSpacing: 0.3
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: TRYOUT_TEAL_BORDER
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  infoText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: typography.bodyFamily,
    flex: 1
  },
  extrasWrap: {
    gap: 3
  },
  extraText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontFamily: typography.bodyFamily
  },
  contactRow: {
    backgroundColor: TRYOUT_TEAL_BORDER,
    borderRadius: radii.xs,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 2
  },
  contactLabel: {
    color: TRYOUT_TEAL,
    fontFamily: typography.bodyBold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  contactValue: {
    color: colors.text.primary,
    fontFamily: typography.bodyMedium,
    fontSize: 12
  }
});

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
    height: 220,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative'
  },
  feedVideo: {
    width: '100%',
    height: '100%'
  },
  videoPoster: {
    width: '100%',
    height: '100%'
  },
  posterScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: 'rgba(0,0,0,0.45)'
  },
  videoBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  videoBadgeText: {
    color: colors.light[0],
    fontSize: 10,
    fontFamily: typography.bodyBold,
    letterSpacing: 0.8
  },
  videoFallback: {
    flex: 1,
    backgroundColor: colors.dark[700],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  videoFallbackIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  videoLabel: {
    color: colors.text.secondary,
    fontFamily: typography.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  playButtonOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -26 }, { translateY: -26 }],
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6
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
