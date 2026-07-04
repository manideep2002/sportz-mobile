import { useEffect, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, Users } from 'lucide-react-native';


import { AppRefreshControl, AppText, Avatar, Button, IconButton, Screen, VerifiedName } from '@/components/ui';

import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { profileService } from '@/services/profileService';
import { useAuthStore } from '@/store/authStore';
import type { UserProfile } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'Followers'>;

export function FollowersScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { userId, mode } = route.params;
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoadingId, setFollowLoadingId] = useState<string | null>(null);

  const load = async (showInitialLoader = true) => {
    if (showInitialLoader) setLoading(true);
    try {
      const nextProfiles = mode === 'followers'
        ? await profileService.listFollowers(userId)
        : await profileService.listFollowing(userId);
      setProfiles(nextProfiles);
      setFollowedIds(await profileService.listFollowedIds(nextProfiles.map((profile) => profile.id)));
    } catch (error) {
      Alert.alert('Could not load profiles', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      if (showInitialLoader) setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load(false);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, userId]);

  const toggleFollow = async (profile: UserProfile) => {
    const isFollowing = followedIds.has(profile.id);
    setFollowLoadingId(profile.id);
    try {
      if (isFollowing) {
        await profileService.unfollowProfile(profile.id);
        setFollowedIds((old) => {
          const next = new Set(old);
          next.delete(profile.id);
          return next;
        });
      } else {
        await profileService.followProfile(profile.id);
        setFollowedIds((old) => new Set([...old, profile.id]));
      }
    } catch (error) {
      Alert.alert('Follow failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setFollowLoadingId(null);
    }
  };

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh()}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">{mode === 'followers' ? 'Followers' : 'Following'}</AppText>
        <View style={{ width: 40 }} />
      </View>
      {loading ? <ActivityIndicator color={colors.orange[500]} /> : null}
      {!loading && profiles.length === 0 ? (
        <View style={styles.empty}>
          <Users size={34} color={colors.text.tertiary} />
          <AppText variant="bodyMuted">No {mode} yet.</AppText>
        </View>
      ) : null}
      {profiles.map((profile) => (
        <Pressable
          key={profile.id}
          style={styles.row}
          onPress={() => navigation.navigate('UserProfile', { userId: profile.id })}
          accessibilityRole="button"
        >
          <Avatar initials={profile.initials} uri={profile.avatarUrl} size={48} online={profile.isOnline} />
          <View style={styles.meta}>
            <VerifiedName profile={profile} style={styles.name} numberOfLines={1} />
            <AppText variant="small">@{profile.username} - {profile.primarySport}</AppText>
          </View>
          {profile.id !== currentUserId ? (
            <Button
              size="sm"
              variant={followedIds.has(profile.id) ? 'dark' : 'ghost'}
              loading={followLoadingId === profile.id}
              onPress={(event) => {
                event.stopPropagation();
                void toggleFollow(profile);
              }}
            >
              {followedIds.has(profile.id) ? 'Following' : 'Follow'}
            </Button>
          ) : null}
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700]
  },
  meta: {
    flex: 1
  },
  name: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  }
});
