import { useCallback, useEffect, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Trash2, X } from 'lucide-react-native';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar, IconButton, ProgressBar } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import { useDeleteStory, useMarkStorySeen, useStories } from '@/hooks/useStories';
import type { AppStackParamList } from '@/navigation/routes';
import { useAuthStore } from '@/store/authStore';
import { timeAgo } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'StoryViewer'>;

const STORY_DURATION_MS = 5000;

export function StoryViewerScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const currentProfile = useAuthStore((state) => state.profile);

  const { data: stories = [] } = useStories();
  const markStorySeen = useMarkStorySeen();
  const deleteStory = useDeleteStory();

  const [currentStoryId, setCurrentStoryId] = useState(route.params.storyId);
  const [elapsed, setElapsed] = useState(0);

  // Track the displayed media URL in state so it is seeded immediately from
  // route params (set by CreateStoryScreen) and updated when we navigate
  // between stories. This is the key fix for the blank-screen race condition:
  // we never wait for the React Query cache to settle before showing the image.
  const [displayMediaUrl, setDisplayMediaUrl] = useState<string | null | undefined>(
    route.params.mediaUrl ?? null
  );

  const currentIndex = stories.findIndex((item) => item.id === currentStoryId);
  const story = stories[currentIndex];
  const previousStory = stories[currentIndex - 1];
  const nextStory = stories[currentIndex + 1];
  const remainingSeconds = Math.max(1, Math.ceil((STORY_DURATION_MS - elapsed) / 1000));

  // Sync displayMediaUrl from the cache once the story is available.
  // This handles navigating to a story from the feed rail (where no
  // mediaUrl param is passed), and when the cache settles after create.
  useEffect(() => {
    if (story?.mediaUrl) {
      setDisplayMediaUrl(story.mediaUrl);
    }
  }, [story?.mediaUrl]);

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

  // Progress timer — advances and auto-navigates.
  useEffect(() => {
    // Start timer even when story metadata isn't in cache yet,
    // as long as we have a media URL to display.
    if (!displayMediaUrl && !story) return;

    markStorySeen(currentStoryId);
    setElapsed(0);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const nextElapsed = Math.min(STORY_DURATION_MS, Date.now() - startedAt);
      setElapsed(nextElapsed);

      if (nextElapsed >= STORY_DURATION_MS) {
        clearInterval(timer);
        if (nextStory) {
          goToStory(nextStory.id);
        } else {
          navigation.goBack();
        }
      }
    }, 100);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoryId, displayMediaUrl]);

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

  const isOwnStory =
    story?.user.id !== undefined &&
    currentProfile?.id !== undefined &&
    story.user.id === currentProfile.id;

  return (
    <View style={styles.root}>
      {/* Full-screen image — rendered immediately from state, no cache wait */}
      {displayMediaUrl ? (
        <Image
          source={{ uri: displayMediaUrl }}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          onError={() => {
            // If the URI fails to load (e.g., expired local file), clear so
            // placeholder shows instead of a silent blank.
            setDisplayMediaUrl(null);
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
        <ProgressBar value={elapsed} max={STORY_DURATION_MS} height={3} color={colors.light[0]} />
        <View style={styles.authorRow}>
          <Avatar initials={story?.user.initials ?? 'ME'} size={38} />
          <View style={styles.authorMeta}>
            <AppText style={styles.authorName}>
              {story?.user.displayName ?? 'My Story'}
            </AppText>
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
          <Avatar initials={story?.user.initials ?? 'ST'} size={96} />
          <AppText variant="h2">{story?.user.displayName ?? 'Story unavailable'}</AppText>
          <AppText variant="bodyMuted">
            {story
              ? 'Media unavailable'
              : 'This story is no longer available.'}
          </AppText>
        </View>
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
  }
});
