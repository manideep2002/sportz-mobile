import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';

import { AppText, Button, Chip, IconButton, Screen } from '@/components/ui';
import { allSports } from '@/constants/sports';
import { spacing } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';
import {
  changePrimaryProfileSport,
  normalizeProfileSportsSelection,
  toggleProfileSport
} from '@/schemas/profileSportsSchema';
import { profileService } from '@/services/profileService';
import { useAuthStore } from '@/store/authStore';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function SportsInterestsScreen() {
  const navigation = useNavigation<Navigation>();
  const profile = useAuthStore((state) => state.profile);
  const setProfile = useAuthStore((state) => state.setProfile);
  const [selection, setSelection] = useState(() =>
    normalizeProfileSportsSelection(
      profile?.primarySport ?? 'Basketball',
      profile?.sports ?? [profile?.primarySport ?? 'Basketball']
    )
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const updatedProfile = await profileService.updateProfile(profile.id, selection);
      setProfile(updatedProfile);
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
      <AppText variant="small">Primary sport</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {allSports.map((item) => (
          <Chip
            key={`primary-${item}`}
            selected={selection.primarySport === item}
            onPress={() => setSelection((current) => changePrimaryProfileSport(current, item))}
          >
            {item}
          </Chip>
        ))}
      </ScrollView>
      <AppText variant="small">Selected sports</AppText>
      <ScrollView contentContainerStyle={styles.wrap}>
        {allSports.map((item) => (
          <Chip
            disabled={selection.primarySport === item}
            key={item}
            selected={selection.sports.includes(item)}
            onPress={() => setSelection((current) => toggleProfileSport(current, item))}
          >
            {item}{selection.primarySport === item ? ' · Primary' : ''}
          </Chip>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingBottom: 40 },
});
