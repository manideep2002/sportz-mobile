import { useCallback, useEffect, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Trash2, X } from 'lucide-react-native';
import { Alert, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, IconButton, ProgressBar, VerifiedName } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import { useDeleteStory, useMarkStorySeen, useStories } from '@/hooks/useStories';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import { messageService } from '@/services/messageService';
import { storyService } from '@/services/storyService';
import { timeAgo } from '@/utils/format';
import { mediaVariants } from '@/utils/mediaOptimization';
import { groupStoriesByUser } from '@/utils/storyUtils';
import type { Story } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'StoryViewer'>;

const STORY_DURATION_MS = 5000;

export function StoryViewerScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const currentProfile = useAuthStore((state) => state.profile);
  const insets = useSafeAreaInsets();

  const { data: stories = [] } = useStories();
  const markStorySeen = useMarkStorySeen();
  const deleteStory = useDeleteStory();

  const [currentStoryId, setCurrentStoryId] = useState(route.params.storyId);
  const [elapsed, setElapsed] = useState(0);
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Track the displayed media URL in state so it is seeded immediately from
  // route params (set by CreateStoryScreen) and updated when we navigate
  // between stories. This is the key fix for the blank-screen race condition:
  // we never wait for the React Query cache to settle before showing the image.
  const [displayMediaUrl, setDisplayMediaUrl] = useState<string | null | undefined>(
    route.params.mediaUrl ?? null
  );
  const [useRawMediaUrl, setUseRawMediaUrl] = useState(false);

  const groups = groupStoriesByUser(stories);

  let currentGroupIndex = -1;
  let currentStoryIndexInGroup = -1;

  for (let i = 0; i < groups.length; i++) {
    const idx = groups[i].stories.findIndex((s) => s.id === currentStoryId);
    if (idx !== -1) {
      currentGroupIndex = i;
      currentStoryIndexInGroup = idx;
      break;
    }
  }

  const currentGroup = groups[currentGroupIndex];
  const story = currentGroup?.stories[currentStoryIndexInGroup] ?? stories.find((s) => s.id === currentStoryId);

  let previousStory: Story | undefined;
  let nextStory: Story | undefined;

  if (currentGroup && currentStoryIndexInGroup !== -1) {
    if (currentStoryIndexInGroup > 0) {
      previousStory = currentGroup.stories[currentStoryIndexInGroup - 1];
    } else if (currentGroupIndex > 0) {
      const prevGroup = groups[currentGroupIndex - 1];
      previousStory = prevGroup.stories[prevGroup.stories.length - 1];
    }

    if (currentStoryIndexInGroup < currentGroup.stories.length - 1) {
      nextStory = currentGroup.stories[currentStoryIndexInGroup + 1];
    } else if (currentGroupIndex < groups.length - 1) {
      const nextGroup = groups[currentGroupIndex + 1];
      nextStory = nextGroup.stories[0];
    }
  } else {
    const flatIndex = stories.findIndex((item) => item.id === currentStoryId);
    if (flatIndex !== -1) {
      previousStory = stories[flatIndex - 1];
      nextStory = stories[flatIndex + 1];
    }
  }

  const remainingSeconds = Math.max(1, Math.ceil((STORY_DURATION_MS - elapsed) / 1000));
  const optimizedDisplayMediaUrl = mediaVariants.storyImage(displayMediaUrl);
  const storyImageUrl = useRawMediaUrl ? displayMediaUrl : optimizedDisplayMediaUrl ?? displayMediaUrl;

  // Sync displayMediaUrl from the cache once the story is available.
  // This handles navigating to a story from the feed rail (where no
  // mediaUrl param is passed), and when the cache settles after create.
  useEffect(() => {
    if (story?.mediaUrl) {
      setDisplayMediaUrl(story.mediaUrl);
    }
  }, [story?.mediaUrl]);

  useEffect(() => {
    setUseRawMediaUrl(false);
  }, [displayMediaUrl]);

  // When navigating between stories, immediately switch the displayed image.
  const goToStory = useCallback(
    (storyId: string) => {
      const target = stories.find((s) => s.id === storyId);
      setCurrentStoryId(storyId);
      setDisplayMediaUrl(target?.mediaUrl ?? null);
      setElapsed(0);
    },
    [stories]
  );

  // Reset elapsed timer only when the current story ID changes
  useEffect(() => {
    setElapsed(0);
  }, [currentStoryId]);

  // Progress timer - advances and auto-navigates, supporting pause.
  useEffect(() => {
    // Start timer even when story metadata isn't in cache yet,
    // as long as we have a media URL to display.
    if (!displayMediaUrl && !story) return;
    if (isInputFocused) return;

    markStorySeen(currentStoryId);

    const timer = setInterval(() => {
      setElapsed((prev) => {
        const next = Math.min(STORY_DURATION_MS, prev + 100);
        if (next >= STORY_DURATION_MS) {
          clearInterval(timer);
          if (nextStory) {
            goToStory(nextStory.id);
          } else {
            navigation.goBack();
          }
        }
        return next;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [currentStoryId, displayMediaUrl, nextStory, goToStory, story, isInputFocused]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Story',
      'Are you sure you want to delete this story? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteStory.mutate(currentStoryId, {
              onSuccess: () => navigation.goBack(),
              onError: () => Alert.alert('Error', 'Could not delete the story. Please try again.')
            });
          }
        }
      ]
    );
  };

  const sendReply = async (body: string, kind: 'reply' | 'reaction' = 'reply') => {
    if (!story?.user.id || !body.trim()) return;
    setSendingReply(true);
    try {
      if (kind === 'reaction') {
        await storyService.recordReaction(currentStoryId, body.trim());
      } else {
        await storyService.recordReply(currentStoryId, body.trim());
      }
      const conversationId = await messageService.createDirectConversation(story.user.id);
      await messageService.sendMessage(conversationId, body.trim());
      setReply('');
      Keyboard.dismiss();
    } catch (error) {
      Alert.alert('Reply failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSendingReply(false);
    }
  };

  const isOwnStory =
    story?.user.id !== undefined &&
    currentProfile?.id !== undefined &&
    story.user.id === currentProfile.id;

  return (
    <View style={styles.root}>
      {/* Full-screen image - rendered immediately from state, no cache wait */}
      {displayMediaUrl ? (
        <Image
          source={{ uri: storyImageUrl ?? displayMediaUrl }}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          onError={() => {
            if (!useRawMediaUrl && optimizedDisplayMediaUrl !== displayMediaUrl) {
              setUseRawMediaUrl(true);
            }
          }}
        />
      ) : null}

      {/* Tap zones for prev/next */}
      <View style={styles.navigationZones}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous story"
          disabled={!previousStory}
          style={styles.navigationZone}
          onPress={() => previousStory && goToStory(previousStory.id)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next story"
          style={styles.navigationZone}
          onPress={() => (nextStory ? goToStory(nextStory.id) : navigation.goBack())}
        />
      </View>

      {/* Top HUD */}
      <View style={styles.header}>
        <View style={styles.progressRow}>
          {(currentGroup ? currentGroup.stories : [{ id: currentStoryId }]).map((s, index) => {
            let progressValue = 0;
            const currentIdx = currentGroup ? currentStoryIndexInGroup : 0;
            if (index < currentIdx) {
              progressValue = STORY_DURATION_MS;
            } else if (index === currentIdx) {
              progressValue = elapsed;
            } else {
              progressValue = 0;
            }
            return (
              <View key={s.id} style={styles.progressSegment}>
                <ProgressBar
                  value={progressValue}
                  max={STORY_DURATION_MS}
                  height={3}
                  color={colors.light[0]}
                />
              </View>
            );
          })}
        </View>
        <View style={styles.authorRow}>
          <Avatar initials={story?.user.initials ?? 'ME'} uri={story?.user.avatarUrl} size={38} />
          <View style={styles.authorMeta}>
            {story ? (
              <VerifiedName
                profile={story.user}
                style={styles.authorName}
                color={colors.light[0]}
                numberOfLines={1}
              />
            ) : (
              <AppText style={styles.authorName}>My Story</AppText>
            )}
            {story ? (
              <AppText style={styles.time}>{timeAgo(story.createdAt)}</AppText>
            ) : null}
          </View>
          <AppText style={styles.timer}>{remainingSeconds}s</AppText>
          {isOwnStory ? (
            <IconButton
              icon={Trash2}
              accessibilityLabel="Delete story"
              onPress={handleDelete}
              disabled={deleteStory.isPending}
            />
          ) : null}
          <IconButton
            icon={X}
            accessibilityLabel="Close story"
            onPress={() => navigation.goBack()}
          />
        </View>
      </View>

      {/* Placeholder shown only when there is genuinely no media URL */}
      {!displayMediaUrl ? (
        <View pointerEvents="none" style={styles.placeholder}>
          <Avatar initials={story?.user.initials ?? 'ST'} uri={story?.user.avatarUrl} size={96} />
          {story ? (
            <VerifiedName
              profile={story.user}
              variant="h2"
              color={colors.light[0]}
              badgeSize={17}
            />
          ) : (
            <AppText variant="h2">Story unavailable</AppText>
          )}
          <AppText variant="bodyMuted">
            {story
              ? 'Media unavailable'
              : 'This story is no longer available.'}
          </AppText>
        </View>
      ) : null}
      {story?.user.id ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={[styles.replyBar, { bottom: insets.bottom > 0 ? insets.bottom + 8 : 28 }]}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 10}
        >
          <View style={styles.reactions}>
            {['\u{1F525}', '\u{2764}\u{FE0F}', '\u{1F44F}', '\u{1F3C6}'].map((reaction) => (
              <Pressable
                key={reaction}
                style={styles.reactionButton}
                disabled={sendingReply}
                onPress={() => void sendReply(reaction, 'reaction')}
              >
                <AppText style={styles.reactionText}>{reaction}</AppText>
              </Pressable>
            ))}
          </View>
          <View style={styles.replyRow}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              placeholder="Reply to story..."
              placeholderTextColor={colors.light[100]}
              style={styles.replyInput}
              returnKeyType="send"
              onSubmitEditing={() => void sendReply(reply)}
            />
            <Pressable
              style={[styles.sendReply, !reply.trim() || sendingReply ? styles.sendReplyDisabled : null]}
              disabled={!reply.trim() || sendingReply}
              onPress={() => void sendReply(reply)}
            >
              <AppText style={styles.sendReplyText}>Send</AppText>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.dark[950]
  },
  navigationZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row'
  },
  navigationZone: {
    flex: 1
  },
  header: {
    paddingTop: 52,
    paddingHorizontal: spacing.screen,
    gap: spacing.sm
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    width: '100%',
    marginBottom: spacing.xs
  },
  progressSegment: {
    flex: 1
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  authorMeta: {
    flex: 1
  },
  authorName: {
    color: colors.light[0],
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  time: {
    color: colors.light[100],
    fontSize: 11
  },
  timer: {
    color: colors.light[0],
    fontFamily: typography.bodyBold,
    fontSize: 12
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md
  },
  replyBar: {
    position: 'absolute',
    left: spacing.screen,
    right: spacing.screen,
    bottom: 28,
    gap: spacing.sm
  },
  reactions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm
  },
  reactionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(10,9,7,0.62)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  reactionText: {
    fontSize: 20
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  replyInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(10,9,7,0.55)',
    color: colors.light[0],
    paddingHorizontal: spacing.md
  },
  sendReply: {
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: colors.orange[500],
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendReplyDisabled: {
    opacity: 0.55
  },
  sendReplyText: {
    color: colors.light[0],
    fontWeight: '700'
  }
});
