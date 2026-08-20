import { useEffect, useMemo, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import type * as ImagePicker from 'expo-image-picker';
import { BarChart3, Briefcase, ChevronLeft, Image as ImageIcon, MapPin, Play, Users, X, type LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Avatar, Button, Chip, IconButton, Input, VerifiedName } from '@/components/ui';
import { postSports } from '@/constants/sports';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, radii, spacing, typography } from '@/design/tokens';
import { useCreatePost, useEditablePost, useUpdatePost } from '@/hooks/useFeed';
import { usePlayerSearch } from '@/hooks/usePlayerSearch';
import type { AppStackParamList } from '@/navigation/routes';
import { storageService } from '@/services/storageService';
import { useAuthStore } from '@/store/authStore';
import type { Post, Sport, TryoutCommitment, TryoutDetails, UserProfile } from '@/types/domain';
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
  const { colors: theme } = useAppTheme();
  const route = useRoute<Route>();
  const editPostId = route.params?.editPostId;
  const isEditing = Boolean(editPostId);
  const profile = useAuthStore((state) => state.profile);

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
    route.params?.communityId ? COMMUNITY_LABEL : 'Public'
  );
  const [locationLabel, setLocationLabel] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [taggedUsers, setTaggedUsers] = useState<UserProfile[]>([]);
  const [hydratedEditPost, setHydratedEditPost] = useState(false);
  const [mediaRemoved, setMediaRemoved] = useState(false);
  // Tryout fields
  const [tryoutTeamName, setTryoutTeamName] = useState('');
  const [tryoutPosition, setTryoutPosition] = useState('');
  const [tryoutLocation, setTryoutLocation] = useState('');
  const [tryoutCommitment, setTryoutCommitment] = useState<TryoutCommitment>('seasonal');
  const [tryoutCompensation, setTryoutCompensation] = useState('');
  const [tryoutRequirements, setTryoutRequirements] = useState('');
  const [tryoutDeadline, setTryoutDeadline] = useState('');
  const [tryoutContact, setTryoutContact] = useState('');
  const {
    data: editPost,
    isLoading: editPostLoading,
    isError: editPostIsError,
    error: editPostError,
    refetch: refetchEditPost
  } = useEditablePost(editPostId ?? '');
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const taggedIds = useMemo(() => new Set(taggedUsers.map((user) => user.id)), [taggedUsers]);
  const tagSearch = usePlayerSearch({ excludeIds: taggedIds });
  const communityId = route.params?.communityId ?? editPost?.communityId ?? undefined;
  const isCommunityPost = Boolean(communityId);
  const communityVisibilityLabel = editPost?.visibility === 'public' ? 'Public' : COMMUNITY_LABEL;
  const visibilityOptions = isCommunityPost
    ? isEditing
      ? [communityVisibilityLabel] as const
      : COMMUNITY_VISIBILITY_OPTIONS
    : DEFAULT_VISIBILITY_OPTIONS;
  const previewImageUri = mediaVariants.feedImage(thumbnailUri ?? mediaUri) ?? thumbnailUri ?? mediaUri;
  const canPublish = Boolean(
    body.trim() ||
    mediaUri ||
    (kind === 'stats' && statsLine.trim()) ||
    taggedUsers.length ||
    locationLabel
  ) && (
    kind !== 'tryout' || (
      tryoutTeamName.trim() !== '' &&
      tryoutPosition.trim() !== '' &&
      tryoutLocation.trim() !== ''
    )
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
    setMediaRemoved(false);
    setLocationLabel(editPost.locationLabel ?? '');
    setTaggedUsers(editPost.mentionedUsers ?? []);
    // Hydrate tryout fields if editing a tryout post.
    if (editPost.kind === 'tryout' && editPost.tryout) {
      setTryoutTeamName(editPost.tryout.teamName);
      setTryoutPosition(editPost.tryout.position);
      setTryoutLocation(editPost.tryout.location);
      setTryoutCommitment(editPost.tryout.commitment);
      setTryoutCompensation(editPost.tryout.compensation ?? '');
      setTryoutRequirements(editPost.tryout.requirements ?? '');
      setTryoutDeadline(editPost.tryout.applicationDeadline ?? '');
      setTryoutContact(editPost.tryout.contactInfo ?? '');
    }
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
      if (!media) return;
      storageService.validateMediaAsset(media);
      setMediaUri(media.uri);
      setMediaAsset(media);
      setMediaKind(media.type === 'video' ? 'video' : 'image');
      setMediaRemoved(false);

      if (media.type === 'video') {
        // Attempt to grab a thumbnail 2 s into the video (falls back to 0 ms).
        // We try 2 s first; if that's past the video end the library returns the
        // last frame, which is fine. The picker may already expose a thumbnail
        // via a non-standard property — prefer that if present.
        const pickerThumb =
          (media as { thumbnail?: string; thumbnailUri?: string } | null)?.thumbnail ??
          (media as { thumbnailUri?: string } | null)?.thumbnailUri ?? null;
        if (pickerThumb) {
          setThumbnailUri(pickerThumb);
        } else {
          const durationMs = (media as { duration?: number | null }).duration ?? 0;
          const seekMs = durationMs >= 4000 ? 2000 : 0;
          const generated = await storageService.generateVideoThumbnail(media.uri, seekMs);
          setThumbnailUri(generated);
        }
      } else {
        setThumbnailUri(null);
      }
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
    if (!canPublish) {
      Alert.alert(
        isEditing ? 'Add something to save' : 'Add something to share',
        kind === 'tryout'
          ? 'Fill in the team name, position, and location to post an open spot.'
          : 'Write an update or choose a photo or video.'
      );
      return;
    }

    const tryoutDetails: TryoutDetails | undefined = kind === 'tryout' ? {
      teamName: tryoutTeamName.trim(),
      position: tryoutPosition.trim(),
      location: tryoutLocation.trim(),
      commitment: tryoutCommitment,
      compensation: tryoutCompensation.trim() || undefined,
      requirements: tryoutRequirements.trim() || undefined,
      applicationDeadline: tryoutDeadline.trim() || undefined,
      contactInfo: tryoutContact.trim() || undefined
    } : undefined;

    try {
      if (editPostId) {
        await updatePost.mutateAsync({
          postId: editPostId,
          input: {
            body: body.trim(),
            sport,
            kind,
            statsLine: kind === 'stats' ? statsLine.trim() : '',
            tryout: tryoutDetails,
            visibility: visibility === COMMUNITY_LABEL
              ? 'group'
              : visibility.toLowerCase() as 'public' | 'followers',
            communityId: communityId ?? null,
            mediaAsset,
            mediaKind,
            removeMedia: mediaRemoved,
            mentionedUserIds: taggedUsers.map((user) => user.id),
            locationLabel: locationLabel.trim() || null
          }
        });
        navigation.goBack();
        return;
      }

      await createPost.mutateAsync({
        body: body.trim(),
        sport,
        kind,
        mediaUrl: mediaUri,
        mediaAsset,
        mediaKind,
        mediaPlaceholder: thumbnailUri ?? undefined,
        statsLine: kind === 'stats' ? statsLine.trim() || undefined : undefined,
        tryout: tryoutDetails,
        visibility: visibility === COMMUNITY_LABEL
          ? 'group'
          : visibility.toLowerCase() as 'public' | 'followers',
        communityId,
        mentionedUserIds: taggedUsers.map((user) => user.id),
        locationLabel: locationLabel.trim() || null
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert(isEditing ? 'Could not save' : 'Could not publish', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  if (isEditing && editPostLoading && !editPost) {
    return (
      <View style={[styles.root, styles.centeredState, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} />
        <AppText variant="bodyMuted">Loading post…</AppText>
      </View>
    );
  }

  if (isEditing && editPostIsError && !editPost) {
    return (
      <View style={[styles.root, styles.centeredState, { backgroundColor: theme.background }]}>
        <AppText variant="h3">Could not load this post</AppText>
        <AppText variant="bodyMuted">
          {editPostError instanceof Error ? editPostError.message : 'Please try again.'}
        </AppText>
        <Button onPress={() => void refetchEditPost()}>Retry</Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 10}
    >
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
            <ScrollView horizontal style={styles.chipScroller} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContent}>
              {visibilityOptions.map((item) => (
                <Chip
                  key={item}
                  selected={item === visibility}
                  disabled={isEditing && isCommunityPost}
                  onPress={() => setVisibility(item)}
                >
                  {item}
                </Chip>
              ))}
            </ScrollView>
            {isCommunityPost ? (
              <View style={[styles.communityBanner, { backgroundColor: theme.accentSoft, borderColor: theme.accentBorder }]}>
                <AppText style={[styles.communityBannerText, { color: theme.accent }]}>
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
          placeholderTextColor={theme.textSubtle}
          multiline
          style={[styles.composer, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
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
        {kind === 'tryout' ? (
          <TryoutForm
            teamName={tryoutTeamName}
            onTeamNameChange={setTryoutTeamName}
            position={tryoutPosition}
            onPositionChange={setTryoutPosition}
            location={tryoutLocation}
            onLocationChange={setTryoutLocation}
            commitment={tryoutCommitment}
            onCommitmentChange={setTryoutCommitment}
            compensation={tryoutCompensation}
            onCompensationChange={setTryoutCompensation}
            requirements={tryoutRequirements}
            onRequirementsChange={setTryoutRequirements}
            deadline={tryoutDeadline}
            onDeadlineChange={setTryoutDeadline}
            contact={tryoutContact}
            onContactChange={setTryoutContact}
          />
        ) : null}
        {mediaUri ? (
          <View style={[styles.mediaPreview, { backgroundColor: theme.surfaceMuted }]}>
            {/* Show thumbnail for both images and videos (once generated) */}
            {(mediaKind === 'image' || thumbnailUri) ? (
              <Image source={{ uri: previewImageUri ?? mediaUri }} style={styles.previewImage} />
            ) : (
              // Video picked but thumbnail not yet generated — show spinner
              <View style={styles.videoPreview}>
                <ActivityIndicator color={theme.accent} size="large" />
                <AppText variant="h4">Generating preview…</AppText>
              </View>
            )}
            {/* Play badge overlay for videos */}
            {mediaKind === 'video' && thumbnailUri ? (
              <View style={styles.videoThumbBadge} pointerEvents="none">
                <Play size={20} color={colors.light[0]} fill={colors.light[0]} />
              </View>
            ) : null}
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
                setMediaRemoved(true);
              }}
            />
          </View>
        ) : null}
        <View style={styles.mediaActions}>
          <ComposerAction icon={ImageIcon} label={mediaUri ? 'Change media' : 'Photo/Video'} selected={Boolean(mediaUri)} onPress={handlePickMedia} />
          <ComposerAction icon={BarChart3} label="Stats" selected={kind === 'stats'} onPress={() => setKind(kind === 'stats' ? 'post' : 'stats')} />
          <ComposerAction icon={BarChart3} label="Highlight" selected={kind === 'highlight'} onPress={() => setKind(kind === 'highlight' ? 'post' : 'highlight')} />
          <ComposerAction icon={Briefcase} label="Open Spot" selected={kind === 'tryout'} onPress={() => setKind(kind === 'tryout' ? 'post' : 'tryout')} />
          <ComposerAction
            icon={MapPin}
            label={detectingLocation ? 'Locating...' : locationLabel || 'Location'}
            selected={Boolean(locationLabel)}
            onPress={() => {
              if (locationLabel) {
                setLocationLabel('');
                return;
              }
              void handleDetectLocation();
            }}
          />
        </View>
        <AppText style={[styles.label, { color: theme.textSubtle }]}>Tag Sport</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.chips, styles.chipScroller]} contentContainerStyle={styles.chipContent}>
          {sports.map((item) => (
            <Chip key={item} selected={item === sport} onPress={() => setSport(item)}>
              {item}
            </Chip>
          ))}
        </ScrollView>
        <Pressable accessibilityRole="button" style={[styles.tagPeople, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => setTagPickerOpen(true)}>
          <Users size={16} color={theme.textSubtle} />
          <AppText style={[styles.tagText, { color: theme.textSubtle }]}>
            {taggedUsers.length ? taggedUsers.map((user) => user.displayName).join(', ') : 'Tag people...'}
          </AppText>
        </Pressable>
      </ScrollView>
      <Modal visible={tagPickerOpen} transparent animationType="fade" onRequestClose={() => setTagPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setTagPickerOpen(false)}>
          <Pressable style={[styles.tagPicker, { backgroundColor: theme.surfaceElevated }]}>
            <View style={styles.tagPickerHeader}>
              <AppText variant="h3">Tag People</AppText>
              <IconButton icon={X} size={34} iconSize={16} onPress={() => setTagPickerOpen(false)} />
            </View>
            <Input
              placeholder="Search players..."
              value={tagSearch.query}
              onChangeText={tagSearch.setQuery}
            />
            {tagSearch.isLoading ? <ActivityIndicator color={theme.accent} /> : null}
            {tagSearch.isError ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry player search"
                style={styles.searchError}
                onPress={() => void tagSearch.retry()}
              >
                <AppText variant="bodyMuted">Could not search players. Tap to retry.</AppText>
              </Pressable>
            ) : null}
            {!tagSearch.isLoading && !tagSearch.isError && tagSearch.query.trim() && tagSearch.results.length === 0 ? (
              <AppText variant="bodyMuted" style={styles.searchError}>No players found.</AppText>
            ) : null}
            {tagSearch.results.map((user) => (
              <Pressable
                key={user.id}
                style={styles.tagOption}
                onPress={() => {
                  setTaggedUsers((old) => [...old, user]);
                  setBody((old) => {
                    const mention = `@${user.username}`;
                    return old.includes(mention) ? old : `${mention} ${old}`.trimEnd();
                  });
                  tagSearch.setQuery('');
                }}
              >
                <Avatar initials={user.initials} uri={user.avatarUrl} size={38} />
                <View style={styles.tagOptionMeta}>
                  <VerifiedName profile={user} style={styles.authorName} numberOfLines={1} />
                  <AppText variant="small">@{user.username}</AppText>
                </View>
                <AppText color={theme.accent}>Tag</AppText>
              </Pressable>
            ))}
            {taggedUsers.map((user) => (
              <Pressable
                key={user.id}
                style={[styles.tagOption, styles.tagOptionSelected, { backgroundColor: theme.accentSoft }]}
                onPress={() => {
                  setTaggedUsers((old) => old.filter((taggedUser) => taggedUser.id !== user.id));
                  setBody((old) => old.replace(new RegExp(`@${user.username}\\b\\s*`, 'i'), '').trimStart());
                }}
              >
                <Avatar initials={user.initials} uri={user.avatarUrl} size={38} />
                <View style={styles.tagOptionMeta}>
                  <VerifiedName profile={user} style={styles.authorName} numberOfLines={1} />
                  <AppText variant="small">@{user.username}</AppText>
                </View>
                <AppText color={theme.textSubtle}>Remove</AppText>
              </Pressable>
            ))}
            <Button full onPress={() => setTagPickerOpen(false)}>Done</Button>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function ComposerAction({ icon: Icon, label, selected, onPress }: { icon: LucideIcon; label: string; selected?: boolean; onPress?: () => void }) {
  const { colors: theme } = useAppTheme();
  return (
    <Pressable
      style={[
        styles.composerAction,
        selected ? styles.composerActionSelected : null,
        {
          backgroundColor: selected ? theme.accentSoft : theme.surface,
          borderColor: selected ? theme.accent : theme.border
        }
      ]}
      onPress={onPress}
    >
      <Icon size={20} color={selected ? theme.accent : theme.textSubtle} />
      <AppText variant="small" color={selected ? theme.accent : undefined} numberOfLines={2}>{label}</AppText>
    </Pressable>
  );
}

interface TryoutFormProps {
  teamName: string;
  onTeamNameChange: (v: string) => void;
  position: string;
  onPositionChange: (v: string) => void;
  location: string;
  onLocationChange: (v: string) => void;
  commitment: TryoutCommitment;
  onCommitmentChange: (v: TryoutCommitment) => void;
  compensation: string;
  onCompensationChange: (v: string) => void;
  requirements: string;
  onRequirementsChange: (v: string) => void;
  deadline: string;
  onDeadlineChange: (v: string) => void;
  contact: string;
  onContactChange: (v: string) => void;
}

const COMMITMENT_OPTIONS: { value: TryoutCommitment; label: string }[] = [
  { value: 'trial', label: 'Trial' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'full_time', label: 'Full-time' }
];

function TryoutForm({
  teamName, onTeamNameChange,
  position, onPositionChange,
  location, onLocationChange,
  commitment, onCommitmentChange,
  compensation, onCompensationChange,
  requirements, onRequirementsChange,
  deadline, onDeadlineChange,
  contact, onContactChange
}: TryoutFormProps) {
  const { colors: theme } = useAppTheme();
  return (
    <View style={tryoutStyles.container}>
      {/* Header banner */}
      <View style={tryoutStyles.banner}>
        <Briefcase size={14} color="#14B8A6" />
        <AppText style={tryoutStyles.bannerText}>OPEN SPOT</AppText>
        <AppText style={tryoutStyles.bannerSub}>Required fields are marked *</AppText>
      </View>

      {/* Required fields */}
      <Input
        label="Team / Club Name *"
        value={teamName}
        onChangeText={onTeamNameChange}
        placeholder="e.g. Mumbai Blazers FC"
      />
      <Input
        label="Position / Role *"
        value={position}
        onChangeText={onPositionChange}
        placeholder="e.g. Point Guard, Striker, Setter…"
      />
      <Input
        label="Training Location *"
        value={location}
        onChangeText={onLocationChange}
        placeholder="e.g. Andheri Sports Complex, Mumbai"
      />

      {/* Commitment chips */}
      <AppText style={[tryoutStyles.fieldLabel, { color: theme.textSubtle }]}>Commitment</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tryoutStyles.chipRow} contentContainerStyle={tryoutStyles.chipRowContent}>
        {COMMITMENT_OPTIONS.map((opt) => (
          <Chip key={opt.value} selected={commitment === opt.value} onPress={() => onCommitmentChange(opt.value)}>
            {opt.label}
          </Chip>
        ))}
      </ScrollView>

      {/* Optional fields */}
      <Input
        label="Compensation (optional)"
        value={compensation}
        onChangeText={onCompensationChange}
        placeholder="e.g. Paid · ₹5,000/month · Unpaid"
      />
      <Input
        label="Requirements (optional)"
        value={requirements}
        onChangeText={onRequirementsChange}
        placeholder="Age, skill level, experience…"
        multiline
      />
      <Input
        label="Open Spot Deadline (optional)"
        value={deadline}
        onChangeText={onDeadlineChange}
        placeholder="e.g. 31 Aug 2026"
      />
      <Input
        label="How to Apply / Contact (optional)"
        value={contact}
        onChangeText={onContactChange}
        placeholder="Email, DM, WhatsApp number…"
      />
    </View>
  );
}

const TRYOUT_TEAL = '#14B8A6';
const TRYOUT_TEAL_SOFT = 'rgba(20,184,166,0.12)';
const TRYOUT_TEAL_BORDER = 'rgba(20,184,166,0.35)';

const tryoutStyles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: TRYOUT_TEAL_SOFT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: TRYOUT_TEAL_BORDER,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    marginBottom: spacing.xs
  },
  bannerText: {
    color: TRYOUT_TEAL,
    fontFamily: typography.headingBold,
    fontSize: 13,
    letterSpacing: 1,
    flex: 0
  },
  bannerSub: {
    color: TRYOUT_TEAL,
    fontFamily: typography.bodyFamily,
    fontSize: 11,
    opacity: 0.7,
    marginLeft: 'auto'
  },
  fieldLabel: {
    fontFamily: typography.bodyBold,
    fontSize: 12,
    marginBottom: 4
  },
  chipRow: {
    flexGrow: 0,
    marginBottom: 4
  },
  chipRowContent: {
    gap: spacing.xs
  }
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.dark[950]
  },
  centeredState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl
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
  videoThumbBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center'
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
  chipScroller: {
    flexGrow: 0
  },
  chipContent: {
    alignItems: 'flex-start'
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
  searchError: {
    textAlign: 'center',
    paddingVertical: spacing.sm
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
