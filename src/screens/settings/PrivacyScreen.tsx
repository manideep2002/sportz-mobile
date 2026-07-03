import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Lock } from 'lucide-react-native';


import { AppRefreshControl, AppText, Avatar, Button, IconButton, Screen } from '@/components/ui';

import { colors, spacing, typography } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { blockService } from '@/services/blockService';
import { profileService } from '@/services/profileService';
import { useAuthStore } from '@/store/authStore';
import type { UserProfile } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function PrivacyScreen() {
  const navigation = useNavigation<Navigation>();
  const profile = useAuthStore((state) => state.profile);
  const setProfile = useAuthStore((state) => state.setProfile);
  const [blocked, setBlocked] = useState<UserProfile[]>([]);
  const [privateAccount, setPrivateAccount] = useState(Boolean(profile?.isPrivate));
  const [refreshing, setRefreshing] = useState(false);

  const loadBlocked = async () => {
    try {
      setBlocked(await blockService.listBlocked());
    } catch (error) {
      Alert.alert('Could not load blocked users', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const refreshBlocked = async () => {
    setRefreshing(true);
    try {
      await loadBlocked();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadBlocked();
  }, []);

  const togglePrivate = async () => {
    if (!profile) return;
    const next = !privateAccount;
    setPrivateAccount(next);
    try {
      await profileService.updateProfile(profile.id, { isPrivate: next });
      setProfile({ ...profile, isPrivate: next });
    } catch (error) {
      setPrivateAccount(!next);
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl
          refreshing={refreshing}
          onRefresh={() => void refreshBlocked()}
        />
      }
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Privacy</AppText>
        <View style={{ width: 40 }} />
      </View>
      <Pressable style={styles.item} onPress={togglePrivate}>
        <View style={styles.itemIcon}><Lock size={18} color={colors.orange[500]} /></View>
        <View style={{ flex: 1 }}>
          <AppText style={styles.itemLabel}>Private account</AppText>
          <AppText variant="small">Only followers can see public posts.</AppText>
        </View>
        <View style={[styles.switch, privateAccount ? styles.switchActive : null]}>
          <View style={[styles.knob, privateAccount ? styles.knobActive : null]} />
        </View>
      </Pressable>
      <AppText variant="h4">Blocked users</AppText>
      {blocked.length === 0 ? <AppText variant="bodyMuted">No blocked users.</AppText> : null}
      {blocked.map((user) => (
        <View key={user.id} style={styles.blockedRow}>
          <Avatar initials={user.initials} uri={user.avatarUrl} size={42} />
          <View style={{ flex: 1 }}>
            <AppText style={styles.itemLabel}>{user.displayName}</AppText>
            <AppText variant="small">@{user.username}</AppText>
          </View>
          <Button
            size="sm"
            variant="ghost"
            onPress={async () => {
              try {
                await blockService.unblockUser(user.id);
                await loadBlocked();
              } catch (error) {
                Alert.alert('Unblock failed', error instanceof Error ? error.message : 'Please try again.');
              }
            }}
          >
            Unblock
          </Button>
        </View>
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
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.md
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.overlays.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  itemLabel: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    backgroundColor: colors.dark[700]
  },
  switchActive: {
    backgroundColor: colors.orange[500]
  },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.light[0]
  },
  knobActive: {
    marginLeft: 'auto'
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.dark[800]
  }
});
