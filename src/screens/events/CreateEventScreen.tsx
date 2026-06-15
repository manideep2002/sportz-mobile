import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, ChevronLeft, Calendar, Clock } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { addDays, format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';

import { AppText, Button, Chip, IconButton, Input } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/design/tokens';
import { useCreateEvent } from '@/hooks/useEvents';
import type { AppStackParamList } from '@/navigation/routes';
import type { Sport } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const sports: Sport[] = ['Basketball', 'Football', 'Tennis', 'Cricket', 'Badminton'];
const eventTypes = ['Pickup Game', 'Tournament', 'Training', 'Friendly'];

export function CreateEventScreen() {
  const navigation = useNavigation<Navigation>();
  const [sport, setSport] = useState<Sport>('Basketball');
  const [title, setTitle] = useState('');
  const [locationName, setLocationName] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [description, setDescription] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('10');
  const [eventType, setEventType] = useState('Pickup Game');
  const [entryFee, setEntryFee] = useState('0');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  
  // Date/Time state - default to tomorrow at 6 PM
  const tomorrow = addDays(new Date(), 1);
  tomorrow.setHours(18, 0, 0, 0);
  const [startDate, setStartDate] = useState(tomorrow);
  const [duration, setDuration] = useState('2'); // hours
  
  const createEvent = useCreateEvent();

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to add a cover photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8
      });

      if (!result.canceled && result.assets[0]) {
        setCoverImage(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleCreate = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Missing Information', 'Please enter an event title');
      return;
    }
    if (!locationName.trim()) {
      Alert.alert('Missing Information', 'Please enter a location');
      return;
    }
    if (!maxPlayers || Number(maxPlayers) < 2) {
      Alert.alert('Invalid Input', 'Max players must be at least 2');
      return;
    }

    try {
      const durationHours = Number(duration) || 2;
      const endsAt = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
      
      await createEvent.mutateAsync({
        title: title.trim(),
        sport,
        description: description.trim(),
        startsAt: startDate.toISOString(),
        endsAt: endsAt.toISOString(),
        locationName: locationName.trim(),
        city: city.trim(),
        maxPlayers: Number(maxPlayers),
        entryFeeCents: Math.round(Number(entryFee) * 100),
        visibility: 'public'
      });
      Alert.alert('Success', 'Event created successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Could not create event', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const adjustDate = (days: number) => {
    const newDate = addDays(startDate, days);
    setStartDate(newDate);
  };

  const adjustTime = (hours: number) => {
    const newDate = new Date(startDate);
    newDate.setHours(newDate.getHours() + hours);
    setStartDate(newDate);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Create Event</AppText>
        <Button size="sm" loading={createEvent.isPending} onPress={handleCreate}>Create</Button>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.cover} onPress={handlePickImage}>
          {coverImage ? (
            <View style={styles.coverImageContainer}>
              <AppText variant="small" style={styles.changeCover}>Tap to change</AppText>
            </View>
          ) : (
            <>
              <Camera size={28} color={colors.text.tertiary} />
              <AppText variant="small">Add cover photo</AppText>
            </>
          )}
        </Pressable>
        
        <Input
          label="Event Title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., Weekend 5v5 Basketball"
        />
        
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

        <View style={styles.group}>
          <AppText style={styles.label}>Date & Time</AppText>
          <View style={styles.dateTimeRow}>
            <View style={styles.dateTimeCard}>
              <Calendar size={16} color={colors.orange[500]} />
              <AppText style={styles.dateTimeText}>{format(startDate, 'EEE, MMM d')}</AppText>
            </View>
            <View style={styles.dateTimeCard}>
              <Clock size={16} color={colors.orange[500]} />
              <AppText style={styles.dateTimeText}>{format(startDate, 'h:mm a')}</AppText>
            </View>
          </View>
          <View style={styles.dateAdjust}>
            <Button size="sm" variant="dark" onPress={() => adjustDate(-1)}>-1 day</Button>
            <Button size="sm" variant="dark" onPress={() => adjustDate(1)}>+1 day</Button>
            <Button size="sm" variant="dark" onPress={() => adjustTime(-1)}>-1 hr</Button>
            <Button size="sm" variant="dark" onPress={() => adjustTime(1)}>+1 hr</Button>
          </View>
        </View>

        <Input
          label="Duration (hours)"
          value={duration}
          onChangeText={setDuration}
          keyboardType="numeric"
          placeholder="2"
        />
        
        <Input
          label="Location / Court"
          value={locationName}
          onChangeText={setLocationName}
          placeholder="e.g., Koramangala Indoor Courts"
        />

        <Input
          label="City"
          value={city}
          onChangeText={setCity}
        />
        
        <Input
          label="Max Players"
          value={maxPlayers}
          onChangeText={setMaxPlayers}
          keyboardType="number-pad"
          placeholder="10"
        />

        <Input
          label="Entry Fee (INR)"
          value={entryFee}
          onChangeText={setEntryFee}
          keyboardType="numeric"
          placeholder="0 for free"
        />
        
        <View style={styles.group}>
          <AppText style={styles.label}>Event Type</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {eventTypes.map((item) => (
              <Chip key={item} selected={item === eventType} onPress={() => setEventType(item)}>
                {item}
              </Chip>
            ))}
          </ScrollView>
        </View>
        
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          placeholder="Describe rules, skill level, and requirements..."
        />
        
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
  coverImageContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  changeCover: {
    color: colors.text.secondary
  },
  group: {
    gap: 8
  },
  label: {
    color: colors.text.tertiary,
    fontWeight: '700',
    fontSize: 12
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  dateTimeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.dark[800],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dark[700]
  },
  dateTimeText: {
    color: colors.text.primary,
    fontFamily: typography.bodyMedium,
    fontSize: 13
  },
  dateAdjust: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap'
  }
});
