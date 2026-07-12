import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, ChevronLeft, Calendar, Clock } from 'lucide-react-native';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { addDays, format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import { AppText, Button, Chip, IconButton, Input } from '@/components/ui';
import { eventPaymentNotice, eventTypes, eventVisibilityOptions } from '@/constants/events';
import { allSports } from '@/constants/sports';
import { colors, radii, spacing, typography } from '@/design/tokens';
import { useCreateEvent } from '@/hooks/useEvents';
import type { AppStackParamList } from '@/navigation/routes';
import type { Sport } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const sports: Sport[] = allSports;

const formatDateInput = (date: Date) => format(date, 'yyyy-MM-dd');
const formatTimeInput = (date: Date) => format(date, 'HH:mm');

type ManualStartDateResult = { date: Date } | { error: string };

const parseManualStartDate = (dateText: string, timeText: string): ManualStartDateResult => {
  const trimmedDate = dateText.trim();
  const trimmedTime = timeText.trim();
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedDate);
  if (!dateMatch) {
    return { error: 'Enter the date as YYYY-MM-DD.' };
  }

  const timeMatch = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(trimmedTime);
  if (!timeMatch) {
    return { error: 'Enter the time as HH:mm using 24-hour time.' };
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return { error: 'Enter a valid calendar date.' };
  }

  return { date: parsed };
};

export function CreateEventScreen() {
  const navigation = useNavigation<Navigation>();
  const [sport, setSport] = useState<Sport>('Basketball');
  const [title, setTitle] = useState('');
  const [locationName, setLocationName] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [description, setDescription] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('10');
  const [eventType, setEventType] = useState(eventTypes[0]);
  const [visibility, setVisibility] = useState(eventVisibilityOptions[0].value);
  const [entryFee, setEntryFee] = useState('0');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  
  // Date/Time state - default to tomorrow at 6 PM
  const tomorrow = addDays(new Date(), 1);
  tomorrow.setHours(18, 0, 0, 0);
  const [startDate, setStartDate] = useState(tomorrow);
  const [dateText, setDateText] = useState(formatDateInput(tomorrow));
  const [timeText, setTimeText] = useState(formatTimeInput(tomorrow));
  const [duration, setDuration] = useState('2'); // hours
  
  const createEvent = useCreateEvent();
  const visibilityDescription = eventVisibilityOptions.find((option) => option.value === visibility)?.description;
  const parsedEntryFee = Number(entryFee);
  const showPaymentNotice = Number.isFinite(parsedEntryFee) && parsedEntryFee > 0;
  const previewStart = parseManualStartDate(dateText, timeText);
  const displayStartDate = 'date' in previewStart ? previewStart.date : startDate;

  const setEventStartDate = (date: Date) => {
    setStartDate(date);
    setDateText(formatDateInput(date));
    setTimeText(formatTimeInput(date));
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to add a cover photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
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
    if (!city.trim()) {
      Alert.alert('Missing Information', 'Please enter a city');
      return;
    }
    if (!locationName.trim()) {
      Alert.alert('Missing Information', 'Please enter a location');
      return;
    }
    const capacity = Number(maxPlayers);
    if (!Number.isInteger(capacity) || capacity < 2) {
      Alert.alert('Invalid Input', 'Max players must be at least 2');
      return;
    }

    try {
      const manualStart = parseManualStartDate(dateText, timeText);
      if ('error' in manualStart) {
        Alert.alert('Invalid date or time', manualStart.error);
        return;
      }
      const eventStartDate = manualStart.date;
      const durationHours = Number(duration);
      if (!Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 24) {
        Alert.alert('Invalid time', 'Duration must be greater than 0 and no more than 24 hours.');
        return;
      }
      if (eventStartDate <= new Date()) {
        Alert.alert('Invalid date', 'Event start time must be in the future.');
        return;
      }
      const feeAmount = Number(entryFee);
      if (!Number.isFinite(feeAmount) || feeAmount < 0) {
        Alert.alert('Invalid fee', 'Entry fee must be 0 or a positive amount.');
        return;
      }
      const endsAt = new Date(eventStartDate.getTime() + durationHours * 60 * 60 * 1000);
      if (endsAt <= eventStartDate) {
        Alert.alert('Invalid time', 'Event end time must be after the start time.');
        return;
      }
      let geocoded: Location.LocationGeocodedLocation | undefined;
      try {
        [geocoded] = await Location.geocodeAsync(`${locationName.trim()}, ${city.trim()}`);
      } catch {
        geocoded = undefined;
      }
      
      const created = await createEvent.mutateAsync({
        title: title.trim(),
        eventType,
        sport,
        description: description.trim(),
        startsAt: eventStartDate.toISOString(),
        endsAt: endsAt.toISOString(),
        locationName: locationName.trim(),
        city: city.trim(),
        latitude: geocoded?.latitude,
        longitude: geocoded?.longitude,
        coverImageUri: coverImage,
        maxPlayers: capacity,
        entryFeeCents: Math.round(feeAmount * 100),
        visibility
      });
      Alert.alert('Event created', 'Your event is ready.', [
        { text: 'View event', onPress: () => navigation.replace('EventDetail', { eventId: created.id }) }
      ]);
    } catch (error) {
      Alert.alert('Could not create event', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const adjustDate = (days: number) => {
    const manualStart = parseManualStartDate(dateText, timeText);
    const baseDate = 'date' in manualStart ? manualStart.date : startDate;
    setEventStartDate(addDays(baseDate, days));
  };

  const adjustTime = (hours: number) => {
    const manualStart = parseManualStartDate(dateText, timeText);
    const newDate = new Date('date' in manualStart ? manualStart.date : startDate);
    newDate.setHours(newDate.getHours() + hours);
    setEventStartDate(newDate);
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
              <Image source={{ uri: coverImage }} resizeMode="cover" style={styles.coverImage} />
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
              <AppText style={styles.dateTimeText}>{format(displayStartDate, 'EEE, MMM d')}</AppText>
            </View>
            <View style={styles.dateTimeCard}>
              <Clock size={16} color={colors.orange[500]} />
              <AppText style={styles.dateTimeText}>{format(displayStartDate, 'h:mm a')}</AppText>
            </View>
          </View>
          <View style={styles.dateAdjust}>
            <Button size="sm" variant="dark" onPress={() => adjustDate(-1)}>-1 day</Button>
            <Button size="sm" variant="dark" onPress={() => adjustDate(1)}>+1 day</Button>
            <Button size="sm" variant="dark" onPress={() => adjustTime(-1)}>-1 hr</Button>
            <Button size="sm" variant="dark" onPress={() => adjustTime(1)}>+1 hr</Button>
          </View>
          <View style={styles.manualDateTimeRow}>
            <View style={styles.manualDateTimeField}>
              <Input
                label="Date"
                value={dateText}
                onChangeText={setDateText}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View style={styles.manualDateTimeField}>
              <Input
                label="Time"
                value={timeText}
                onChangeText={setTimeText}
                keyboardType="numbers-and-punctuation"
                placeholder="HH:mm"
              />
            </View>
          </View>
          <AppText variant="small" style={styles.helper}>
            Use 24-hour time, e.g. 18:30.
          </AppText>
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
          label="Entry Fee (INR, optional)"
          value={entryFee}
          onChangeText={setEntryFee}
          keyboardType="numeric"
          placeholder="0 for free"
        />
        {showPaymentNotice ? (
          <AppText variant="small" style={styles.helper}>
            {eventPaymentNotice}
          </AppText>
        ) : null}
        
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

        <View style={styles.group}>
          <AppText style={styles.label}>Visibility</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {eventVisibilityOptions.map((option) => (
              <Chip
                key={option.value}
                selected={option.value === visibility}
                onPress={() => setVisibility(option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </ScrollView>
          {visibilityDescription ? (
            <AppText variant="small" style={styles.helper}>
              {visibilityDescription}
            </AppText>
          ) : null}
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
  coverImage: {
    ...StyleSheet.absoluteFillObject
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
  helper: {
    color: colors.text.tertiary,
    marginTop: -spacing.xs
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
  },
  manualDateTimeRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  manualDateTimeField: {
    flex: 1
  }
});
