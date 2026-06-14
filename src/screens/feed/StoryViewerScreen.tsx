import { useEffect, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar, IconButton, ProgressBar } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import { useMarkStorySeen, useStories } from '@/hooks/useStories';
import type { AppStackParamList } from '@/navigation/routes';
import { timeAgo } from '@/utils/format';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'StoryViewer'>;

const STORY_DURATION_MS = 5000;

export function StoryViewerScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { data: stories = [] } = useStories();
  const markStorySeen = useMarkStorySeen();
  const [currentStoryId, setCurrentStoryId] = useState(route.params.storyId);
  const [elapsed, setElapsed] = useState(0);
  const currentIndex = stories.findIndex((item) => item.id === currentStoryId);
  const story = stories[currentIndex];
  const previousStoryId = stories[currentIndex - 1]?.id;
  const nextStoryId = stories[currentIndex + 1]?.id;
  const remainingSeconds = Math.max(1, Math.ceil((STORY_DURATION_MS - elapsed) / 1000));

  useEffect(() => {
    if (!story) return;

    markStorySeen(story.id);
    setElapsed(0);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const nextElapsed = Math.min(STORY_DURATION_MS, Date.now() - startedAt);
      setElapsed(nextElapsed);

      if (nextElapsed >= STORY_DURATION_MS) {
        clearInterval(timer);
        if (nextStoryId) {
          setCurrentStoryId(nextStoryId);
        } else {
          navigation.goBack();
        }
      }
    }, 100);

    return () => clearInterval(timer);
  }, [markStorySeen, navigation, nextStoryId, story?.id]);

  return (
    <View style={styles.root}>
      {story?.mediaUrl ? <Image source={{ uri: story.mediaUrl }} resizeMode="cover" style={StyleSheet.absoluteFill} /> : null}
      <View style={styles.navigationZones}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous story"
          disabled={!previousStoryId}
          style={styles.navigationZone}
          onPress={() => previousStoryId && setCurrentStoryId(previousStoryId)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next story"
          style={styles.navigationZone}
          onPress={() => nextStoryId ? setCurrentStoryId(nextStoryId) : navigation.goBack()}
        />
      </View>
      <View style={styles.header}>
        <ProgressBar value={elapsed} max={STORY_DURATION_MS} height={3} color={colors.light[0]} />
        <View style={styles.authorRow}>
          <Avatar initials={story?.user.initials ?? 'ST'} size={38} />
          <View style={styles.authorMeta}>
            <AppText style={styles.authorName}>{story?.user.displayName ?? 'Story unavailable'}</AppText>
            {story ? <AppText style={styles.time}>{timeAgo(story.createdAt)}</AppText> : null}
          </View>
          <AppText style={styles.timer}>{remainingSeconds}s</AppText>
          <IconButton icon={X} accessibilityLabel="Close story" onPress={() => navigation.goBack()} />
        </View>
      </View>
      {!story?.mediaUrl ? (
        <View pointerEvents="none" style={styles.placeholder}>
          <Avatar initials={story?.user.initials ?? 'ST'} size={96} />
          <AppText variant="h2">{story?.user.displayName ?? 'Story unavailable'}</AppText>
          <AppText variant="bodyMuted">{story ? 'Shared a new sports update' : 'This story is no longer available.'}</AppText>
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
