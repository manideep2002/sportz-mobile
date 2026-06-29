import { useEffect, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, Users } from 'lucide-react-native';

import { AppText, Avatar, Button, IconButton, Screen } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { profileService } from '@/services/profileService';
import type { UserProfile } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'Followers'>;

export function FollowersScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { userId, mode } = route.params;
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setProfiles(mode === 'followers' ? await profileService.listFollowers(userId) : await profileService.listFollowing(userId));
    } catch (error) {
      Alert.alert('Could not load profiles', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, userId]);

  return (
    <Screen contentContainerStyle={styles.content}>
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
            <AppText style={styles.name}>{profile.displayName}</AppText>
            <AppText variant="small">@{profile.username} - {profile.primarySport}</AppText>
          </View>
          <Button
            size="sm"
            variant="ghost"
            onPress={async (event) => {
              event.stopPropagation();
              await profileService.followProfile(profile.id);
            }}
          >
            Follow
          </Button>
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

