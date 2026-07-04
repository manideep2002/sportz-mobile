import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, ChevronLeft, ImagePlus } from 'lucide-react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Alert, FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, IconButton } from '@/components/ui';
import { colors, radii, spacing } from '@/design/tokens';
import { useCreateStories } from '@/hooks/useStories';
import type { AppStackParamList } from '@/navigation/routes';
import { storageService } from '@/services/storageService';
import { useAuthStore } from '@/store/authStore';
import type { UserProfile } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function CreateStoryScreen() {
  const navigation = useNavigation<Navigation>();
  const profile = useAuthStore((state) => state.profile);
  const [mediaAssets, setMediaAssets] = useState<ImagePickerAsset[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [caption, setCaption] = useState('');
  const createStories = useCreateStories();
  const selectedAsset = mediaAssets[selectedIndex];

  const handlePickMedia = async () => {
    try {
      const picked = await storageService.pickMultipleImages();
      if (!picked.length) return;
      const existingUris = new Set(mediaAssets.map((a) => a.uri));
      const newAssets = picked.filter((a) => !existingUris.has(a.uri));
      const next = [...mediaAssets, ...newAssets].slice(0, 10);
      setMediaAssets(next);
      setSelectedIndex(Math.min(mediaAssets.length, next.length - 1));
    } catch (error) {
      Alert.alert('Media picker failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleShare = async () => {
    if (!mediaAssets.length || !profile) return;
    try {
      const author: Pick<UserProfile, 'id' | 'displayName' | 'initials' | 'avatarUrl' | 'skillLevel'> = {
        id: profile.id,
        displayName: profile.displayName,
        initials: profile.initials,
        avatarUrl: profile.avatarUrl,
        skillLevel: profile.skillLevel
      };
      const stories = await createStories.mutateAsync({ assets: mediaAssets, author, body: caption });
      navigation.replace('StoryViewer', { storyId: stories[0].id, mediaUrl: stories[0].mediaUrl ?? undefined });
    } catch (error) {
      Alert.alert('Could not share story', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleCapture = async () => {
    try {
      const captured = await storageService.captureMedia();
      if (!captured) return;
      setMediaAssets((old) => [...old, captured].slice(0, 10));
      setSelectedIndex(mediaAssets.length);
    } catch (error) {
      Alert.alert('Camera failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <AppText variant="h3">Create Story</AppText>
        <Button size="sm" disabled={!mediaAssets.length} loading={createStories.isPending} onPress={handleShare}>
          {mediaAssets.length > 1 ? `Share ${mediaAssets.length}` : 'Share'}
        </Button>
      </View>
      <Pressable accessibilityRole="button" style={styles.canvas} onPress={handlePickMedia}>
        {selectedAsset ? (
          <>
            <Image source={{ uri: selectedAsset.uri }} resizeMode="cover" style={styles.preview} />
            {caption.trim() ? (
              <View pointerEvents="none" style={styles.captionOverlay}>
                <AppText style={styles.captionText}>{caption}</AppText>
              </View>
            ) : null}
          </>
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
      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="Add caption"
        placeholderTextColor={colors.text.tertiary}
        style={styles.captionInput}
        maxLength={180}
      />
      {mediaAssets.length ? (
        <FlatList
          horizontal
          data={mediaAssets}
          keyExtractor={(item) => item.uri}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnails}
          renderItem={({ item, index }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Preview story ${index + 1}`}
              onPress={() => setSelectedIndex(index)}
              style={[styles.thumbnail, index === selectedIndex ? styles.selectedThumbnail : null]}
            >
              <Image source={{ uri: item.uri }} style={styles.thumbnailImage} />
            </Pressable>
          )}
        />
      ) : null}
      {mediaAssets.length ? (
        <Button variant="dark" full icon={ImagePlus} onPress={handlePickMedia}>
          Add more photos
        </Button>
      ) : null}
      <Button variant="ghost" full icon={Camera} onPress={handleCapture}>
        Capture with camera
      </Button>
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
  captionOverlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.xl,
    alignItems: 'center'
  },
  captionText: {
    color: colors.light[0],
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 10
  },
  captionInput: {
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md
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
