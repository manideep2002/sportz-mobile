import { useEffect, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import type * as ImagePicker from 'expo-image-picker';
import { BarChart3, ChevronLeft, Image as ImageIcon, MapPin, Play, Users, X, type LucideIcon } from 'lucide-react-native';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Avatar, Button, Chip, IconButton, Input, VerifiedName } from '@/components/ui';
import { postSports } from '@/constants/sports';
import { colors, radii, spacing, typography } from '@/design/tokens';
import { useCreatePost, usePost, useUpdatePost } from '@/hooks/useFeed';
import type { AppStackParamList } from '@/navigation/routes';
import { profileService } from '@/services/profileService';
import { storageService } from '@/services/storageService';
import { useAuthStore } from '@/store/authStore';
import type { Post, Sport, UserProfile } from '@/types/domain';
import { mediaVariants } from '@/utils/mediaOptimization';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'CreatePost'>;

const sports: Sport[] = postSports;

/** Label used for community/group scoped posts in the visibility selector. */
const COMMUNITY_LABEL = 'Community' as const;

/** Visibility options when creating a post inside a community context. */
const COMMUNITY_VISIBILITY_OPTIONS = [COMMUNITY_LABEL, 'Public'] as const;

/** Visibility options when creating a standalone post. */
const DEFAULT_VISIBILITY_OPTIONS = ['Public', 'Followers'] as const;

export function CreatePostScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const editPostId = route.params?.editPostId;
  const isEditing = Boolean(editPostId);
  const profile = useAuthStore((state) => state.profile);

  // Detect community context from route params.
  const isCommunityPost = Boolean(route.params?.communityId);
  const visibilityOptions = isCommunityPost
    ? COMMUNITY_VISIBILITY_OPTIONS
    : DEFAULT_VISIBILITY_OPTIONS;

  const [body, setBody] = useState('');
  const [sport, setSport] = useState<Sport>('Basketball');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaAsset, setMediaAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<Post['mediaKind']>('none');
  const [kind, setKind] = useState<Post['kind']>(route.params?.initialKind ?? 'post');
  const [statsLine, setStatsLine] = useState('');
  // Default to 'Community' when in a group/page context so posts are group-scoped.
  const [visibility, setVisibility] = useState<string>(
    isCommunityPost ? COMMUNITY_LABEL : 'Public'
  );
  const [locationLabel, setLocationLabel] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [taggedUsers, setTaggedUsers] = useState<UserProfile[]>([]);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [tagSearchResults, setTagSearchResults] = useState<UserProfile[]>([]);
  const [hydratedEditPost, setHydratedEditPost] = useState(false);
  const { data: editPost } = usePost(editPostId ?? '');
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const previewImageUri = mediaVariants.feedImage(thumbnailUri ?? mediaUri) ?? thumbnailUri ?? mediaUri;
  const canPublish = isEditing
    ? Boolean(body.trim() || (kind === 'stats' && statsLine.trim()))
    : Boolean(
        body.trim() ||
          mediaUri ||
          (kind === 'stats' && statsLine.trim()) ||
          taggedUsers.length ||
          locationLabel
      );

  useEffect(() => {
    if (!editPost || hydratedEditPost) return;
    setBody(editPost.body);
    setSport(editPost.sport);
    setKind(editPost.kind);
    setStatsLine(editPost.statsLine ?? '');
    setMediaUri(editPost.mediaUrl ?? null);
    setMediaAsset(null);
    setMediaKind(editPost.mediaKind ?? 'none');
    // Hydrate the visibility label from the stored value.
    setVisibility(
      editPost.visibility === 'followers' ? 'Followers'
        : editPost.visibility === 'group' ? COMMUNITY_LABEL
        : 'Public'
    );
    setHydratedEditPost(true);
  }, [editPost, hydratedEditPost]);

  const handlePickMedia = async () => {
    try {
      const media = await storageService.pickMedia();
      setMediaUri(media?.uri ?? null);
      setMediaAsset(media ?? null);
      setThumbnailUri((media as { thumbnail?: string; thumbnailUri?: string } | null)?.thumbnail ?? (media as { thumbnailUri?: string } | null)?.thumbnailUri ?? null);
      setMediaKind(media?.type === 'video' ? 'video' : media ? 'image' : 'none');
    } catch (error) {
      Alert.alert('Media picker failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleDetectLocation = async () => {
    setDetectingLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location permission needed', 'Allow location access to tag your current location.');
        return;
      }
      const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(currentLocation.coords);
      setLocationLabel(
        [place.city ?? place.district ?? place.subregion, place.region].filter(Boolean).join(', ') ||
          `${currentLocation.coords.latitude.toFixed(4)}, ${currentLocation.coords.longitude.toFixed(4)}`
      );
    } catch (error) {
      Alert.alert('Could not detect location', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setDetectingLocation(false);
    }
  };

  const handlePublish = async () => {
    const mentions = isEditing ? '' : taggedUsers.map((user) => `@${user.username}`).join(' ');
    const additions = [
      !isEditing && locationLabel ? `At ${locationLabel}` : ''
    ].filter(Boolean);
    const fallbackBody =
      kind === 'stats' && statsLine.trim()
        ? 'Game stats'
        : mediaUri
          ? kind === 'highlight'
            ? 'Shared a new highlight.'
            : 'Shared a new sports update.'
          : '';
    const publishedBody = [mentions, body.trim() || fallbackBody, ...additions].filter(Boolean).join('\n');
    if (!canPublish) {
      Alert.alert(isEditing ? 'Add post text' : 'Add something to share', isEditing ? 'Write an update before saving.' : 'Write an update or choose a photo or video.');
      return;
    }

    try {
      if (editPostId) {
        await updatePost.mutateAsync({
          postId: editPostId,
          input: {
            body: body.trim() || fallbackBody,
            sport,
            kind,
            statsLine: kind === 'stats' ? statsLine.trim() || undefined : undefined,
            visibility: visibility === COMMUNITY_LABEL
              ? 'group'
              : visibility.toLowerCase() as 'public' | 'followers'
          }
        });
        navigation.goBack();
        return;
      }

      await createPost.mutateAsync({
        body: publishedBody,
        sport,
        kind,
        mediaUrl: mediaUri,
        mediaAsset,
        mediaKind,
        statsLine: kind === 'stats' ? statsLine.trim() || undefined : undefined,
        visibility: visibility === COMMUNITY_LABEL
          ? 'group'
          : visibility.toLowerCase() as 'public' | 'followers',
        communityId: route.params?.communityId,
        mentionedUserIds: taggedUsers.map((user) => user.id)
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Could not publish', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">{isEditing ? 'Edit Post' : 'New Post'}</AppText>
        <Button size="sm" disabled={!canPublish} loading={createPost.isPending || updatePost.isPending} onPress={handlePublish}>
          {isEditing ? 'Save' : 'Publish'}
        </Button>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.author}>
          <Avatar initials={profile?.initials ?? '??'} uri={profile?.avatarUrl} size={42} />
          <View style={styles.authorMeta}>
            {profile ? (
              <VerifiedName profile={profile} style={styles.authorName} numberOfLines={1} />
            ) : (
              <AppText style={styles.authorName}>Athlete</AppText>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {visibilityOptions.map((item) => (
                <Chip key={item} selected={item === visibility} onPress={() => setVisibility(item)}>
                  {item}
                </Chip>
              ))}
            </ScrollView>
            {isCommunityPost ? (
              <View style={styles.communityBanner}>
                <AppText style={styles.communityBannerText}>
                  Posting to community · visible to members only by default
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="What is happening on the court?"
          placeholderTextColor={colors.text.tertiary}
          multiline
          style={styles.composer}
        />
        {kind === 'stats' ? (
          <Input
            label="Stat line"
            value={statsLine}
            onChangeText={setStatsLine}
            placeholder="Example: 34 PTS - 8 REB - 5 AST"
            autoCapitalize="characters"
          />
        ) : null}
        {mediaUri ? (
          <View style={styles.mediaPreview}>
            {mediaKind === 'image' || thumbnailUri ? (
              <Image source={{ uri: previewImageUri ?? mediaUri }} style={styles.previewImage} />
            ) : (
              <View style={styles.videoPreview}>
                <View style={styles.videoIcon}>
                  <Play size={22} color={colors.light[0]} fill={colors.light[0]} />
                </View>
                <AppText variant="h4">Video ready</AppText>
                <AppText variant="small">A preview will appear after upload.</AppText>
              </View>
            )}
            {!isEditing ? (
              <IconButton
                icon={X}
                accessibilityLabel="Remove media"
                size={34}
                style={styles.removeMedia}
                onPress={() => {
                  setMediaUri(null);
                  setMediaAsset(null);
                  setThumbnailUri(null);
                  setMediaKind('none');
                }}
              />
            ) : null}
          </View>
        ) : null}
        <View style={styles.mediaActions}>
          {!isEditing ? (
            <ComposerAction icon={ImageIcon} label={mediaUri ? 'Change media' : 'Photo/Video'} selected={Boolean(mediaUri)} onPress={handlePickMedia} />
          ) : null}
          <ComposerAction icon={BarChart3} label="Stats" selected={kind === 'stats'} onPress={() => setKind(kind === 'stats' ? 'post' : 'stats')} />
          <ComposerAction icon={BarChart3} label="Highlight" selected={kind === 'highlight'} onPress={() => setKind(kind === 'highlight' ? 'post' : 'highlight')} />
          {!isEditing ? (
            <ComposerAction icon={MapPin} label={detectingLocation ? 'Locating...' : locationLabel || 'Location'} selected={Boolean(locationLabel)} onPress={() => void handleDetectLocation()} />
          ) : null}
        </View>
        <AppText style={styles.label}>Tag Sport</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {sports.map((item) => (
            <Chip key={item} selected={item === sport} onPress={() => setSport(item)}>
              {item}
            </Chip>
          ))}
        </ScrollView>
        {!isEditing ? (
          <Pressable accessibilityRole="button" style={styles.tagPeople} onPress={() => setTagPickerOpen(true)}>
            <Users size={16} color={colors.text.tertiary} />
            <AppText style={styles.tagText}>
              {taggedUsers.length ? taggedUsers.map((user) => user.displayName).join(', ') : 'Tag people...'}
            </AppText>
          </Pressable>
        ) : null}
      </ScrollView>
      <Modal visible={tagPickerOpen} transparent animationType="fade" onRequestClose={() => setTagPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setTagPickerOpen(false)}>
          <Pressable style={styles.tagPicker}>
            <View style={styles.tagPickerHeader}>
              <AppText variant="h3">Tag People</AppText>
              <IconButton icon={X} size={34} iconSize={16} onPress={() => setTagPickerOpen(false)} />
            </View>
            <Input
              placeholder="Search players..."
              value={tagSearchQuery}
              onChangeText={async (q) => {
                setTagSearchQuery(q);
                if (!q.trim()) { setTagSearchResults([]); return; }
                try {
                  const results = await profileService.listPlayers(q.trim());
                  setTagSearchResults(results.filter((p) => !taggedUsers.some((t) => t.id === p.id)));
                } catch { /* ignore */ }
              }}
            />
            {tagSearchResults.map((user) => (
              <Pressable
                key={user.id}
                style={styles.tagOption}
                onPress={() => {
                  setTaggedUsers((old) => [...old, user]);
                  setBody((old) => {
                    const mention = `@${user.username}`;
                    return old.includes(mention) ? old : `${mention} ${old}`.trimEnd();
                  });
                  setTagSearchResults([]);
                  setTagSearchQuery('');
                }}
              >
                <Avatar initials={user.initials} uri={user.avatarUrl} size={38} />
                <View style={styles.tagOptionMeta}>
                  <VerifiedName profile={user} style={styles.authorName} numberOfLines={1} />
                  <AppText variant="small">@{user.username}</AppText>
                </View>
                <AppText color={colors.orange[400]}>Tag</AppText>
              </Pressable>
            ))}
            {taggedUsers.map((user) => (
              <Pressable
                key={user.id}
                style={[styles.tagOption, styles.tagOptionSelected]}
                onPress={() => setTaggedUsers((old) => old.filter((t) => t.id !== user.id))}
              >
                <Avatar initials={user.initials} uri={user.avatarUrl} size={38} />
                <View style={styles.tagOptionMeta}>
                  <VerifiedName profile={user} style={styles.authorName} numberOfLines={1} />
                  <AppText variant="small">@{user.username}</AppText>
                </View>
                <AppText color={colors.text.tertiary}>Remove</AppText>
              </Pressable>
            ))}
            <Button full onPress={() => setTagPickerOpen(false)}>Done</Button>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ComposerAction({ icon: Icon, label, selected, onPress }: { icon: LucideIcon; label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable style={[styles.composerAction, selected ? styles.composerActionSelected : null]} onPress={onPress}>
      <Icon size={20} color={selected ? colors.orange[400] : colors.text.tertiary} />
      <AppText variant="small" color={selected ? colors.orange[400] : undefined} numberOfLines={2}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.dark[950]
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: spacing.screen,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  content: {
    padding: spacing.screen,
    paddingBottom: 40
  },
  author: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginBottom: 16
  },
  authorMeta: {
    flex: 1,
    gap: 6
  },
  authorName: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  composer: {
    minHeight: 140,
    borderRadius: radii.md,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    color: colors.text.primary,
    padding: spacing.md,
    fontFamily: typography.bodyFamily,
    fontSize: 15,
    textAlignVertical: 'top',
    marginBottom: 14
  },
  mediaActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: 14
  },
  composerAction: {
    flex: 1,
    height: 80,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[600],
    borderStyle: 'dashed',
    backgroundColor: colors.dark[800],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs
  },
  composerActionSelected: {
    borderColor: colors.orange[400],
    backgroundColor: colors.overlays.orangeSoft
  },
  mediaPreview: {
    height: 180,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.dark[800],
    marginBottom: spacing.md
  },
  previewImage: {
    width: '100%',
    height: '100%'
  },
  videoPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs
  },
  videoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.orange[500],
    alignItems: 'center',
    justifyContent: 'center'
  },
  removeMedia: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm
  },
  label: {
    color: colors.text.tertiary,
    fontFamily: typography.bodyBold,
    fontSize: 12,
    marginBottom: 8
  },
  chips: {
    marginBottom: 14
  },
  tagPeople: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.dark[800],
    borderRadius: radii.md,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700]
  },
  tagText: {
    color: colors.text.tertiary,
    flex: 1
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlays.scrim,
    justifyContent: 'flex-end'
  },
  tagPicker: {
    backgroundColor: colors.dark[900],
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    paddingBottom: 36,
    gap: spacing.sm
  },
  tagPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  tagOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md
  },
  tagOptionSelected: {
    backgroundColor: colors.overlays.orangeSoft
  },
  tagOptionMeta: {
    flex: 1
  },
  communityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.overlays.orangeSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.overlays.orangeBorder,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start'
  },
  communityBannerText: {
    color: colors.orange[400],
    fontSize: 11,
    fontFamily: typography.bodyMedium
  }
});
