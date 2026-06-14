import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ImagePlus } from 'lucide-react-native';
import { Alert, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, IconButton } from '@/components/ui';
import { currentUser } from '@/data/mockData';
import { colors, radii, spacing } from '@/design/tokens';
import { useCreateStories } from '@/hooks/useStories';
import type { AppStackParamList } from '@/navigation/routes';
import { storageService } from '@/services/storageService';
import { useAuthStore } from '@/store/authStore';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function CreateStoryScreen() {
  const navigation = useNavigation<Navigation>();
  const profile = useAuthStore((state) => state.profile) ?? currentUser;
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const createStories = useCreateStories();
  const selectedMediaUri = mediaUris[selectedIndex];

  const handlePickMedia = async () => {
    try {
      const media = await storageService.pickMultipleImages();
      if (!media.length) return;
      const nextUris = Array.from(new Set([...mediaUris, ...media.map((item) => item.uri)])).slice(0, 10);
      setMediaUris(nextUris);
      setSelectedIndex(Math.min(mediaUris.length, nextUris.length - 1));
    } catch (error) {
      Alert.alert('Media picker failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleShare = async () => {
    if (!mediaUris.length) return;

    try {
      const stories = await createStories.mutateAsync({ mediaUris, author: profile });
      navigation.replace('StoryViewer', { storyId: stories[0].id });
    } catch (error) {
      Alert.alert('Could not share story', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <AppText variant="h3">Create Story</AppText>
        <Button size="sm" disabled={!mediaUris.length} loading={createStories.isPending} onPress={handleShare}>
          {mediaUris.length > 1 ? `Share ${mediaUris.length}` : 'Share'}
        </Button>
      </View>
      <Pressable accessibilityRole="button" style={styles.canvas} onPress={handlePickMedia}>
        {selectedMediaUri ? (
          <Image source={{ uri: selectedMediaUri }} resizeMode="cover" style={styles.preview} />
        ) : (
          <View style={styles.empty}>
            <View style={styles.icon}>
              <ImagePlus size={30} color={colors.orange[400]} />
            </View>
            <AppText variant="h3">Choose a photo</AppText>
            <AppText variant="bodyMuted">Share a moment from your game or training.</AppText>
          </View>
        )}
      </Pressable>
      {mediaUris.length ? (
        <FlatList
          horizontal
          data={mediaUris}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnails}
          renderItem={({ item, index }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Preview story ${index + 1}`}
              onPress={() => setSelectedIndex(index)}
              style={[styles.thumbnail, index === selectedIndex ? styles.selectedThumbnail : null]}
            >
              <Image source={{ uri: item }} style={styles.thumbnailImage} />
            </Pressable>
          )}
        />
      ) : null}
      {mediaUris.length ? (
        <Button variant="dark" full icon={ImagePlus} onPress={handlePickMedia}>
          Add more photos
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.dark[950],
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xl
  },
  header: {
    paddingTop: 52,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  canvas: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.dark[800],
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    marginBottom: spacing.md
  },
  preview: {
    width: '100%',
    height: '100%'
  },
  thumbnails: {
    gap: spacing.sm,
    paddingBottom: spacing.md
  },
  thumbnail: {
    width: 58,
    height: 74,
    borderRadius: radii.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.dark[700]
  },
  selectedThumbnail: {
    borderColor: colors.orange[500]
  },
  thumbnailImage: {
    width: '100%',
    height: '100%'
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm
  },
  icon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlays.orangeSoft,
    marginBottom: spacing.xs
  }
});
