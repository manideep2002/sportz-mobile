import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, ChevronLeft } from 'lucide-react-native';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Chip, IconButton, Input } from '@/components/ui';
import { colors, radii, spacing } from '@/design/tokens';
import { useCreateEvent } from '@/hooks/useEvents';
import type { AppStackParamList } from '@/navigation/routes';
import type { Sport } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const sports: Sport[] = ['Basketball', 'Football', 'Tennis', 'Cricket', 'Badminton'];

export function CreateEventScreen() {
  const navigation = useNavigation<Navigation>();
  const [sport, setSport] = useState<Sport>('Basketball');
  const [title, setTitle] = useState('Weekend 5v5 Basketball');
  const [locationName, setLocationName] = useState('Koramangala Indoor Courts');
  const [description, setDescription] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('10');
  const createEvent = useCreateEvent();

  const handleCreate = async () => {
    try {
      const startsAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
      const endsAt = new Date(Date.now() + 1000 * 60 * 60 * 26).toISOString();
      await createEvent.mutateAsync({
        title,
        sport,
        description,
        startsAt,
        endsAt,
        locationName,
        city: 'Bengaluru',
        maxPlayers: Number(maxPlayers),
        entryFeeCents: 0,
        visibility: 'public'
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Could not create event', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Create Event</AppText>
        <Button size="sm" loading={createEvent.isPending} onPress={handleCreate}>Post</Button>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.cover}>
          <Camera size={28} color={colors.text.tertiary} />
          <AppText variant="small">Add cover photo</AppText>
        </View>
        <Input label="Event Title" value={title} onChangeText={setTitle} />
        <View style={styles.group}>
          <AppText style={styles.label}>Sport</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {sports.map((item) => (
              <Chip key={item} selected={item === sport} onPress={() => setSport(item)}>
                {item}
              </Chip>
            ))}
          </ScrollView>
        </View>
        <Input label="Location / Court" value={locationName} onChangeText={setLocationName} />
        <Input label="Max Players" value={maxPlayers} onChangeText={setMaxPlayers} keyboardType="number-pad" />
        <View style={styles.group}>
          <AppText style={styles.label}>Event Type</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['Pickup Game', 'Tournament', 'Training', 'Friendly'].map((item, index) => (
              <Chip key={item} selected={index === 0}>{item}</Chip>
            ))}
          </ScrollView>
        </View>
        <Input label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={4} placeholder="Describe rules, skill level, and requirements..." />
        <Button full size="lg" loading={createEvent.isPending} onPress={handleCreate}>
          Create Event
        </Button>
      </ScrollView>
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
  cover: {
    height: 120,
    borderRadius: radii.xl,
    backgroundColor: colors.dark[800],
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dark[600],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs
  },
  group: {
    gap: 8
  },
  label: {
    color: colors.text.tertiary,
    fontWeight: '700',
    fontSize: 12
  }
});
