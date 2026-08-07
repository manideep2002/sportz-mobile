import { useVideoPlayer, VideoView, type VideoContentFit } from 'expo-video';
import { Pause, Play, RefreshCw, Volume2, VolumeX } from 'lucide-react-native';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Pressable,
  StyleSheet,
  View,
  type AppStateStatus,
  type StyleProp,
  type ViewStyle
} from 'react-native';

import { colors, radii, spacing } from '@/design/tokens';
import { AppText } from './AppText';

const appStateAllowsPlayback = (state: AppStateStatus | null) =>
  state === null || state === 'active';

/** Format seconds → M:SS */
function fmtTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface VideoPlayerHandle {
  play(): void;
  pause(): void;
}

export interface VideoPlayerProps {
  uri: string | null | undefined;
  /** If true the video starts playing on mount. Default false. */
  autoPlay?: boolean;
  /** External pause override — player pauses when true. */
  paused?: boolean;
  /** Loop the video. Default false. */
  loop?: boolean;
  /** Start muted. Default false. */
  muted?: boolean;
  /** Use the platform playback controls. Default false. */
  controls?: boolean;
  /** Allow the player itself to handle play/pause taps. Default true. */
  interactive?: boolean;
  /** How the video should fit its bounds. Default cover. */
  contentFit?: VideoContentFit;
  /** Show the mute toggle button. Default false. */
  showMuteToggle?: boolean;
  /** Show the progress bar and time labels. Default false. */
  showProgress?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Called when playback reaches the end. */
  onEnd?: () => void;
  /** Called when an unrecoverable playback error occurs. */
  onError?: (error: unknown) => void;
  /** Called each time the playback position changes (position in seconds). */
  onProgress?: (positionSecs: number, durationSecs: number) => void;
  testID?: string;
}

/**
 * Reusable video player wrapping expo-video.
 *
 * Features:
 * - Buffering spinner
 * - Play/pause overlay with fade-out when playing
 * - Progress bar + elapsed / total time labels (opt-in via showProgress)
 * - Mute toggle (opt-in)
 * - Error state with retry
 * - External `paused` override (e.g. keyboard open, app backgrounded)
 * - Calls player.release() on unmount
 */
export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer(
    {
      uri,
      autoPlay = false,
      paused = false,
      loop = false,
      muted = false,
      controls = false,
      interactive = true,
      contentFit = 'cover',
      showMuteToggle = false,
      showProgress = false,
      style,
      onEnd,
      onError,
      onProgress,
      testID
    },
    ref
  ) {
    const [isBuffering, setIsBuffering] = useState(Boolean(uri));
    const [isPlaying, setIsPlaying] = useState(false);
    const [wantsToPlay, setWantsToPlay] = useState(autoPlay);
    const [isMuted, setIsMuted] = useState(muted);
    const [hasError, setHasError] = useState(false);
    const [hasEnded, setHasEnded] = useState(false);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showControls, setShowControls] = useState(true);
    const [isAppActive, setIsAppActive] = useState(
      appStateAllowsPlayback(AppState.currentState)
    );

    // Fade animation for the controls overlay
    const controlsOpacity = useRef(new Animated.Value(1)).current;
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const player = useVideoPlayer(uri ?? null, (p) => {
      p.loop = loop;
      p.muted = muted;
      p.timeUpdateEventInterval = 0.25;
      if (uri && autoPlay && !paused && appStateAllowsPlayback(AppState.currentState)) p.play();
    });

    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          setWantsToPlay(true);
          if (hasEnded) player.replay();
          else player.play();
        },
        pause: () => {
          setWantsToPlay(false);
          player.pause();
        }
      }),
      [hasEnded, player]
    );

    // Show controls briefly, then fade out when playing
    const revealControls = useCallback(() => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setShowControls(true);
      Animated.timing(controlsOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }, [controlsOpacity]);

    const scheduleHide = useCallback(() => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        Animated.timing(controlsOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
          setShowControls(false);
        });
      }, 2500);
    }, [controlsOpacity]);

    useEffect(() => {
      if (isPlaying) {
        scheduleHide();
      } else {
        revealControls();
      }
      return () => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
      };
    }, [isPlaying, revealControls, scheduleHide]);

    useEffect(() => {
      setIsBuffering(Boolean(uri));
      setHasError(false);
      setHasEnded(false);
      setWantsToPlay(autoPlay);
      setPosition(0);
      setDuration(0);
    }, [autoPlay, uri]);

    useEffect(() => {
      const subscription = AppState.addEventListener('change', (state) => {
        setIsAppActive(appStateAllowsPlayback(state));
      });
      return () => subscription.remove();
    }, []);

    useEffect(() => {
      player.loop = loop;
      player.timeUpdateEventInterval = 0.25;
    }, [loop, player]);

    useEffect(() => {
      setIsMuted(muted);
    }, [muted]);

    useEffect(() => {
      if (!uri || paused || !isAppActive || !wantsToPlay) {
        player.pause();
      } else if (hasEnded) {
        player.replay();
      } else {
        player.play();
      }
    }, [hasEnded, isAppActive, paused, player, uri, wantsToPlay]);

    useEffect(() => {
      player.muted = isMuted;
    }, [isMuted, player]);

    useEffect(() => {
      const statusSub = player.addListener('statusChange', (event) => {
        const status = event.status;
        if (status === 'readyToPlay') {
          setIsBuffering(false);
          setHasError(false);
          const dur = Number.isFinite(player.duration) ? player.duration : 0;
          setDuration(dur);
        } else if (status === 'loading') {
          setIsBuffering(true);
        } else if (status === 'error') {
          setIsBuffering(false);
          setHasError(true);
          onError?.(event.error);
        }
      });

      const playSub = player.addListener('playingChange', (event) => {
        setIsPlaying(event.isPlaying);
        if (event.isPlaying) setHasEnded(false);
      });

      const progressSub = player.addListener('timeUpdate', (event) => {
        const dur = Number.isFinite(player.duration) ? player.duration : 0;
        setPosition(event.currentTime);
        setDuration(dur);
        onProgress?.(event.currentTime, dur);
      });

      return () => {
        statusSub.remove();
        playSub.remove();
        progressSub.remove();
      };
    }, [onError, onProgress, player]);

    useEffect(() => {
      const sub = player.addListener('playToEnd', () => {
        setIsPlaying(false);
        if (!loop) {
          setHasEnded(true);
          setWantsToPlay(false);
        }
        onEnd?.();
      });
      return () => sub.remove();
    }, [loop, onEnd, player]);

    useEffect(() => {
      return () => {
        player.release();
      };
    }, [player]);

    const handleRetry = useCallback(async () => {
      if (!uri) return;
      setHasError(false);
      setIsBuffering(true);
      setHasEnded(false);
      try {
        await player.replaceAsync(uri);
        if (autoPlay && !paused && isAppActive) {
          setWantsToPlay(true);
          player.play();
        }
      } catch (error) {
        setIsBuffering(false);
        setHasError(true);
        onError?.(error);
      }
    }, [autoPlay, isAppActive, onError, paused, player, uri]);

    const togglePlay = useCallback(() => {
      revealControls();
      if (isPlaying) {
        setWantsToPlay(false);
        player.pause();
      } else {
        setWantsToPlay(true);
        if (hasEnded) player.replay();
        else player.play();
        scheduleHide();
      }
    }, [hasEnded, isPlaying, player, revealControls, scheduleHide]);

    const handleOverlayTap = useCallback(() => {
      if (isPlaying && !showControls) {
        // first tap while playing: just reveal controls
        revealControls();
        scheduleHide();
      } else {
        togglePlay();
      }
    }, [isPlaying, revealControls, scheduleHide, showControls, togglePlay]);

    const progressFraction = duration > 0 ? Math.min(position / duration, 1) : 0;

    if (!uri) {
      return (
        <View style={[styles.container, style]} testID={testID}>
          <AppText style={styles.unavailableText}>Media unavailable</AppText>
        </View>
      );
    }

    if (hasError) {
      return (
        <View style={[styles.container, styles.errorContainer, style]} testID={testID}>
          <View style={styles.errorIconWrap}>
            <RefreshCw size={22} color={colors.light[100]} />
          </View>
          <AppText style={styles.errorText}>Could not load video</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry video"
            style={styles.retryButton}
            onPress={handleRetry}
          >
            <AppText style={styles.retryText}>Tap to retry</AppText>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={[styles.container, style]} testID={testID}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          nativeControls={controls}
          allowsFullscreen={controls}
          allowsPictureInPicture={false}
        />

        {/* Buffering spinner */}
        {isBuffering ? (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator
              color={colors.light[0]}
              size="large"
              testID="video-buffering-indicator"
            />
          </View>
        ) : null}

        {/* Interactive overlay: play/pause + controls */}
        {!controls && interactive && !isBuffering ? (
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: controlsOpacity }]}
            pointerEvents={showControls ? 'box-none' : 'none'}
          >
            {/* Subtle scrim so controls are readable */}
            <View style={styles.controlsScrim} pointerEvents="none" />

            {/* Play / Pause centre button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}
              style={styles.playZone}
              onPress={handleOverlayTap}
            >
              <View style={styles.playButton}>
                {isPlaying ? (
                  <Pause size={26} color={colors.light[0]} fill={colors.light[0]} />
                ) : (
                  <Play size={26} color={colors.light[0]} fill={colors.light[0]} />
                )}
              </View>
            </Pressable>

            {/* Bottom bar: progress + time + mute */}
            <View style={styles.bottomBar} pointerEvents="box-none">
              {showProgress ? (
                <View style={styles.progressRow} pointerEvents="none">
                  <AppText style={styles.timeLabel}>{fmtTime(position)}</AppText>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progressFraction * 100}%` }]} />
                    <View style={[styles.progressThumb, { left: `${progressFraction * 100}%` }]} />
                  </View>
                  <AppText style={styles.timeLabel}>{fmtTime(duration)}</AppText>
                </View>
              ) : null}

              {/* Mute toggle */}
              {showMuteToggle ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'}
                  style={styles.muteButton}
                  onPress={() => {
                    revealControls();
                    setIsMuted((m) => !m);
                  }}
                >
                  {isMuted ? (
                    <VolumeX size={16} color={colors.light[0]} />
                  ) : (
                    <Volume2 size={16} color={colors.light[0]} />
                  )}
                </Pressable>
              ) : null}
            </View>
          </Animated.View>
        ) : null}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.dark[900],
    overflow: 'hidden',
    borderRadius: radii.sm
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)'
  },
  controlsScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)'
  },
  playZone: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center'
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
    gap: spacing.xs
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'visible',
    position: 'relative'
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.orange[500]
  },
  progressThumb: {
    position: 'absolute',
    top: -4,
    marginLeft: -5,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.light[0],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 2
  },
  timeLabel: {
    color: colors.light[0],
    fontSize: 11,
    fontVariant: ['tabular-nums']
  },
  muteButton: {
    alignSelf: 'flex-end',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md
  },
  errorIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  errorText: {
    color: colors.light[100],
    fontSize: 13
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.orange[500]
  },
  retryText: {
    color: colors.light[0],
    fontSize: 13,
    fontWeight: '600'
  },
  unavailableText: {
    color: colors.light[100],
    fontSize: 13,
    padding: spacing.md
  }
});
