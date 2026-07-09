import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, ChevronLeft } from 'lucide-react-native';
import { InteractionManager, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Avatar, BottomSheet, Button, Chip, IconButton, Input } from '@/components/ui';
import { allSports } from '@/constants/sports';
import { colors, spacing } from '@/design/tokens';
import { useUsernameAvailability } from '@/hooks/useUsernameAvailability';
import type { AppStackParamList } from '@/navigation/routes';
import { profileService } from '@/services/profileService';
import { storageService } from '@/services/storageService';
import { usernameAvailabilityService } from '@/services/usernameAvailabilityService';
import { useAuthStore } from '@/store/authStore';
import type { SkillLevel, Sport } from '@/types/domain';
import { normalizeUsername } from '@/utils/authValidation';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const sports: Sport[] = allSports;
const levels: SkillLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Pro'];

export function EditProfileScreen() {
  const navigation = useNavigation<Navigation>();
  const profile = useAuthStore((state) => state.profile);
  const setProfile = useAuthStore((state) => state.setProfile);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [username, setUsername] = useState(profile?.username ? `@${profile.username}` : '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [sport, setSport] = useState<Sport>(profile?.primarySport ?? 'Basketball');
  const [position, setPosition] = useState(profile?.position ?? '');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(profile?.skillLevel ?? 'Advanced');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? null);
  const [coverUrl, setCoverUrl] = useState(profile?.coverUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profilePhotoSheetOpen, setProfilePhotoSheetOpen] = useState(false);
  const hasProfilePhoto = Boolean(avatarUrl || profile?.avatarUrl);
  const usernameAvailability = useUsernameAvailability(username, profile?.username);
  const usernameStatusStyle =
    usernameAvailability.status === 'available'
      ? styles.success
      : usernameAvailability.status === 'taken' || usernameAvailability.status === 'invalid'
        ? styles.errorText
        : styles.helperText;

  const uploadProfileMedia = async (kind: 'avatar' | 'cover') => {
    if (!profile) return;
    setError(null);
    try {
      const picked = await storageService.pickImage();
      if (!picked) return;
      const url = await storageService.uploadMedia(picked, kind === 'avatar' ? 'avatars' : 'post-media', profile.id);
      if (kind === 'avatar') {
        await profileService.updateProfile(profile.id, { avatarUrl: url });
        setAvatarUrl(url);
        setProfile({ ...profile, avatarUrl: url });
      } else {
        await profileService.updateProfile(profile.id, { coverUrl: url });
        setCoverUrl(url);
        setProfile({ ...profile, coverUrl: url });
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not update media.');
    }
  };

  const removeProfilePhoto = async () => {
    if (!profile || !hasProfilePhoto) return;

    setSaving(true);
    setError(null);
    try {
      await profileService.updateProfile(profile.id, { avatarUrl: null });
      setAvatarUrl(null);
      setProfile({ ...profile, avatarUrl: null });
      setProfilePhotoSheetOpen(false);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove profile photo.');
    } finally {
      setSaving(false);
    }
  };

  const showProfilePhotoOptions = () => {
    setError(null);
    setProfilePhotoSheetOpen(true);
  };

  const chooseNewProfilePhoto = () => {
    setProfilePhotoSheetOpen(false);
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        void uploadProfileMedia('avatar');
      }, 100);
    });
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const normalizedUsername = normalizeUsername(username);
      const availability = await usernameAvailabilityService.verifyUsernameAvailability(
        normalizedUsername,
        profile.username,
        { forceExact: true }
      );
      if (availability.status !== 'available') {
        setError(availability.message);
        return;
      }

      await profileService.updateProfile(profile.id, {
        displayName,
        username: normalizedUsername,
        bio,
        city,
        primarySport: sport,
        sports: [sport],
        position,
        skillLevel,
        avatarUrl,
        coverUrl
      });
      await usernameAvailabilityService.rememberUsername(normalizedUsername);
      setProfile({ ...profile, displayName, username: normalizedUsername, bio, city, primarySport: sport, sports: [sport], position, skillLevel, avatarUrl, coverUrl });
      navigation.goBack();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Edit Profile</AppText>
        <Button size="sm" loading={saving} disabled={usernameAvailability.status !== 'available'} onPress={handleSave}>Save</Button>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarContainer}>
          <Pressable style={styles.avatarEdit} onPress={showProfilePhotoOptions} accessibilityRole="button" accessibilityLabel="Change profile photo">
            <Avatar initials={profile?.initials ?? 'MK'} uri={avatarUrl} size={84} />
            <View style={styles.camera}>
              <Camera size={14} color={colors.light[0]} />
            </View>
          </Pressable>
        </View>
        <Button variant="ghost" size="sm" style={styles.photoButton} onPress={showProfilePhotoOptions}>Change Profile Photo</Button>
        {error ? <AppText style={styles.error}>{error}</AppText> : null}
        <Input label="Display Name" value={displayName} onChangeText={setDisplayName} />
        <Input label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
        <AppText variant="small" style={[styles.usernameHint, usernameStatusStyle]}>
          {usernameAvailability.message}
        </AppText>
        <Input label="Bio" value={bio} onChangeText={setBio} multiline numberOfLines={3} />
        <Input label="Location" value={city} onChangeText={setCity} />
        <AppText style={styles.label}>Primary Sport</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {sports.map((item) => (
            <Chip key={item} selected={item === sport} onPress={() => setSport(item)}>{item}</Chip>
          ))}
        </ScrollView>
        <Input label="Position / Role" value={position} onChangeText={setPosition} />
        <AppText style={styles.label}>Skill Level</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {levels.map((item) => (
            <Chip key={item} selected={item === skillLevel} onPress={() => setSkillLevel(item)}>{item}</Chip>
          ))}
        </ScrollView>
      </ScrollView>
      <BottomSheet open={profilePhotoSheetOpen} title="Profile Photo" onClose={() => setProfilePhotoSheetOpen(false)}>
        <View style={styles.photoSheet}>
          <Button
            variant="dark"
            full
            disabled={saving}
            onPress={chooseNewProfilePhoto}
          >
            Choose New Photo
          </Button>
          {hasProfilePhoto ? (
            <Button variant="danger" full loading={saving} onPress={() => void removeProfilePhoto()}>
              Remove Photo
            </Button>
          ) : null}
        </View>
      </BottomSheet>
    </View>
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
    gap: spacing.md,
    paddingBottom: 40
  },
  avatarContainer: {
    alignSelf: 'center',
    position: 'relative'
  },
  avatarEdit: {
    position: 'relative'
  },
  camera: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.orange[500],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.dark[950]
  },
  photoButton: {
    alignSelf: 'center'
  },
  photoSheet: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm
  },
  label: {
    color: colors.text.tertiary,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: -6
  },
  error: {
    color: colors.semantic.danger,
    textAlign: 'center',
    fontSize: 12
  },
  errorText: {
    color: colors.semantic.danger
  },
  helperText: {
    color: colors.text.tertiary
  },
  success: {
    color: colors.semantic.success
  },
  usernameHint: {
    marginTop: -10
  }
});
