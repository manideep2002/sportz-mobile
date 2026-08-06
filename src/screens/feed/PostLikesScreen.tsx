import { useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, Heart } from 'lucide-react-native';

import { AppRefreshControl, AppText, Avatar, Button, IconButton, Screen, VerifiedName } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import { usePostLikes } from '@/hooks/useFeed';
import type { AppStackParamList } from '@/navigation/routes';
import { profileService } from '@/services/profileService';
import { useAuthStore } from '@/store/authStore';
import type { UserProfile } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'PostLikes'>;

export function PostLikesScreen() {
  const navigation = useNavigation<Navigation>();
  const { colors: theme } = useAppTheme();
  const route = useRoute<Route>();
  const { postId } = route.params;
  const currentUserId = useAuthStore((state) => state.user?.id);

  const { data: profiles = [], isLoading, isRefetching, refetch } = usePostLikes(postId);

  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [followLoadingId, setFollowLoadingId] = useState<string | null>(null);

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
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Liked by</AppText>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? <ActivityIndicator color={theme.accent} style={styles.loader} /> : null}

      {!isLoading && profiles.length === 0 ? (
        <View style={styles.empty}>
          <Heart size={34} color={theme.textSubtle} />
          <AppText variant="bodyMuted">No likes yet.</AppText>
          <AppText variant="small" style={{ color: theme.textSubtle, textAlign: 'center' }}>
            Be the first to like this post!
          </AppText>
        </View>
      ) : null}

      {profiles.map((profile) => (
        <Pressable
          key={profile.id}
          accessibilityRole="button"
          accessibilityLabel={`View ${profile.displayName}'s profile`}
          style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => navigation.navigate('UserProfile', { userId: profile.id })}
        >
          <Avatar initials={profile.initials} uri={profile.avatarUrl} size={48} online={profile.isOnline} />
          <View style={styles.meta}>
            <VerifiedName profile={profile} style={styles.name} numberOfLines={1} />
            <AppText variant="small">@{profile.username} · {profile.primarySport}</AppText>
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
  loader: {
    paddingVertical: spacing.xl
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
