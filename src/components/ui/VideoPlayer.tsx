import { useVideoPlayer, VideoView, type VideoContentFit } from 'expo-video';
import { Play, RefreshCw, Volume2, VolumeX } from 'lucide-react-native';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native';

import { colors, radii, spacing } from '@/design/tokens';
import { AppText } from './AppText';

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
 * - Play/pause overlay
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

    const player = useVideoPlayer(uri ?? null, (p) => {
      p.loop = loop;
      p.muted = muted;
      p.timeUpdateEventInterval = 0.1;
      if (uri && autoPlay && !paused) p.play();
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

    useEffect(() => {
      setIsBuffering(Boolean(uri));
      setHasError(false);
      setHasEnded(false);
      setWantsToPlay(autoPlay);
    }, [autoPlay, uri]);

    useEffect(() => {
      player.loop = loop;
      player.timeUpdateEventInterval = 0.1;
    }, [loop, player]);

    useEffect(() => {
      setIsMuted(muted);
    }, [muted]);

    useEffect(() => {
      if (!uri || paused || !wantsToPlay) {
        player.pause();
      } else if (hasEnded) {
        player.replay();
      } else {
        player.play();
      }
    }, [hasEnded, paused, player, uri, wantsToPlay]);

    useEffect(() => {
      player.muted = isMuted;
    }, [isMuted, player]);

    useEffect(() => {
      const statusSub = player.addListener('statusChange', (event) => {
        const status = event.status;
        if (status === 'readyToPlay') {
          setIsBuffering(false);
          setHasError(false);
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
        const duration = Number.isFinite(player.duration) ? player.duration : 0;
        onProgress?.(event.currentTime, duration);
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
        if (autoPlay && !paused) {
          setWantsToPlay(true);
          player.play();
        }
      } catch (error) {
        setIsBuffering(false);
        setHasError(true);
        onError?.(error);
      }
    }, [autoPlay, onError, paused, player, uri]);

    const togglePlay = useCallback(() => {
      if (isPlaying) {
        setWantsToPlay(false);
        player.pause();
      } else {
        setWantsToPlay(true);
        if (hasEnded) player.replay();
        else player.play();
      }
    }, [hasEnded, isPlaying, player]);

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
          <AppText style={styles.errorText}>Could not load video</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry video"
            style={styles.retryButton}
            onPress={handleRetry}
          >
            <RefreshCw size={18} color={colors.light[0]} />
            <AppText style={styles.retryText}>Retry</AppText>
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

        {isBuffering ? (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator
              color={colors.light[0]}
              size="large"
              testID="video-buffering-indicator"
            />
          </View>
        ) : null}

        {!controls && interactive && !isBuffering ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}
            style={styles.playZone}
            onPress={togglePlay}
          >
            {!isPlaying ? (
              <View style={styles.playButton}>
                <Play size={28} color={colors.light[0]} fill={colors.light[0]} />
              </View>
            ) : null}
          </Pressable>
        ) : null}

        {!controls && showMuteToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'}
            style={styles.muteButton}
            onPress={() => setIsMuted((m) => !m)}
          >
            {isMuted ? (
              <VolumeX size={18} color={colors.light[0]} />
            ) : (
              <Volume2 size={18} color={colors.light[0]} />
            )}
          </Pressable>
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
  playZone: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center'
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  muteButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md
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
    backgroundColor: 'rgba(255,255,255,0.12)'
  },
  retryText: {
    color: colors.light[0],
    fontSize: 13
  },
  unavailableText: {
    color: colors.light[100],
    fontSize: 13,
    padding: spacing.md
  }
});
