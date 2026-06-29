import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';

import { AppText, Button, Chip, IconButton, Screen } from '@/components/ui';
import { allSports } from '@/constants/sports';
import { spacing } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import { profileService } from '@/services/profileService';
import { useAuthStore } from '@/store/authStore';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function SportsInterestsScreen() {
  const navigation = useNavigation<Navigation>();
  const profile = useAuthStore((state) => state.profile);
  const setProfile = useAuthStore((state) => state.setProfile);
  const [sports, setSports] = useState(profile?.sports ?? []);
  const [saving, setSaving] = useState(false);

  const toggle = (sport: string) => {
    setSports((old) => old.includes(sport) ? old.filter((item) => item !== sport) : [...old, sport]);
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await profileService.updateProfile(profile.id, { sports, primarySport: sports[0] ?? profile.primarySport });
      setProfile({ ...profile, sports, primarySport: sports[0] ?? profile.primarySport });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}><IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} /><AppText variant="h3">Sports Interests</AppText><Button size="sm" loading={saving} onPress={save}>Save</Button></View>
      <ScrollView contentContainerStyle={styles.wrap}>
        {allSports.map((item) => <Chip key={item} selected={sports.includes(item)} onPress={() => toggle(item)}>{item}</Chip>)}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingBottom: 40 },
});
