import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Plus } from 'lucide-react-native';

import { AppText, Avatar } from '@/components/ui';
import { colors, spacing } from '@/design/tokens';
import type { Story } from '@/types/domain';
import { groupStoriesByUser } from '@/utils/storyUtils';

interface StoryRailProps {
  stories: Story[];
  onCreateStory: () => void;
  onOpenStory: (storyId: string) => void;
}

export function StoryRail({ stories, onCreateStory, onOpenStory }: StoryRailProps) {
  const groupedStories = groupStoriesByUser(stories);

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={groupedStories}
      keyExtractor={(item) => item.userId}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <Pressable accessibilityRole="button" accessibilityLabel="Create story" style={styles.item} onPress={onCreateStory}>
          <View style={styles.addCircle}>
            <Plus size={22} color={colors.orange[400]} strokeWidth={2.2} />
          </View>
          <AppText variant="small">Your story</AppText>
        </Pressable>
      }
      renderItem={({ item, index }) => {
        const firstUnseen = item.stories.find((s) => !s.seen);
        const targetId = (firstUnseen ?? item.stories[0]).id;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.user.displayName}'s story`}
            style={styles.item}
            onPress={() => onOpenStory(targetId)}
          >
            <View style={[styles.ring, item.allSeen ? styles.seen : styles.active]}>
              <View style={styles.inner}>
                <Avatar initials={item.user.initials} uri={item.user.avatarUrl} size={58} tone={index % 2 === 0 ? 'orange' : 'green'} />
              </View>
            </View>
            <AppText variant="small" numberOfLines={1}>
              {item.user.displayName.split(' ')[0]}
            </AppText>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.screen,
    gap: spacing.sm,
    paddingBottom: spacing.xs
  },
  item: {
    alignItems: 'center',
    gap: 5,
    width: 68,
    marginRight: spacing.sm
  },
  addCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.orange[400],
    backgroundColor: colors.dark[800],
    alignItems: 'center',
    justifyContent: 'center'
  },
  ring: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 3
  },
  active: {
    borderWidth: 2,
    borderColor: colors.orange[500]
  },
  seen: {
    borderWidth: 2,
    borderColor: colors.dark[700]
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark[950],
    borderRadius: 33
  }
});
