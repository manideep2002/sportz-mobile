import { useEffect, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';


import { AppRefreshControl, AppText, Avatar, Button, Chip, IconButton, Input, VerifiedName } from '@/components/ui';

import { eventTypes, eventVisibilityOptions } from '@/constants/events';
import { colors, spacing, typography } from '@/design/tokens';
import { useCancelEvent, useEvent, useEventWaitlist, useRemoveEventAttendee, useUpdateEvent } from '@/hooks/useEvents';
import type { AppStackParamList } from '@/navigation/routes';
import type { EventType, EventVisibility } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'ManageEvent'>;

export function ManageEventScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { data: event, isLoading, isError, isRefetching, error, refetch } = useEvent(route.params.eventId);
  const {
    data: waitlist = [],
    isError: waitlistIsError,
    isRefetching: waitlistRefetching,
    refetch: refetchWaitlist
  } = useEventWaitlist(route.params.eventId);
  const updateEvent = useUpdateEvent();
  const cancelEvent = useCancelEvent();
  const removeAttendee = useRemoveEventAttendee();
  const [title, setTitle] = useState(event?.title ?? '');
  const [eventType, setEventType] = useState<EventType>(event?.eventType ?? eventTypes[0]);
  const [visibility, setVisibility] = useState<EventVisibility>(event?.visibility ?? 'public');
  const [description, setDescription] = useState(event?.description ?? '');
  const [startsAt, setStartsAt] = useState(event?.startsAt ?? '');
  const [endsAt, setEndsAt] = useState(event?.endsAt ?? '');
  const [locationName, setLocationName] = useState(event?.locationName ?? '');
  const [city, setCity] = useState(event?.city ?? '');
  const [maxPlayers, setMaxPlayers] = useState(event?.maxPlayers.toString() ?? '10');

  useEffect(() => {
    if (!event) return;
    setTitle(event.title);
    setEventType(event.eventType);
    setVisibility(event.visibility);
    setDescription(event.description);
    setStartsAt(event.startsAt);
    setEndsAt(event.endsAt);
    setLocationName(event.locationName);
    setCity(event.city);
    setMaxPlayers(event.maxPlayers.toString());
  }, [event]);

  const save = async () => {
    if (!event) return;
    if (!title.trim()) {
      Alert.alert('Missing information', 'Please enter an event title.');
      return;
    }
    if (!locationName.trim() || !city.trim()) {
      Alert.alert('Missing information', 'Please enter the location and city.');
      return;
    }
    const parsedStart = new Date(startsAt);
    const parsedEnd = new Date(endsAt);
    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime()) || parsedEnd <= parsedStart) {
      Alert.alert('Invalid time', 'Enter a valid start and end time.');
      return;
    }
    const capacity = Number(maxPlayers);
    if (!Number.isInteger(capacity) || capacity < 2) {
      Alert.alert('Invalid capacity', 'Max players must be at least 2.');
      return;
    }
    try {
      await updateEvent.mutateAsync({
        eventId: event.id,
        updates: {
          title: title.trim(),
          eventType,
          description,
          startsAt,
          endsAt,
          locationName: locationName.trim(),
          city: city.trim(),
          maxPlayers: capacity,
          visibility
        }
      });
      Alert.alert('Event saved', 'Your changes are live.', [
        { text: 'Done', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const cancel = () => {
    if (!event) return;
    Alert.alert('Cancel event', 'Attendees will see this event as cancelled.', [
      { text: 'Keep Event', style: 'cancel' },
      {
        text: 'Cancel Event',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelEvent.mutateAsync(event.id);
            navigation.goBack();
          } catch (error) {
            Alert.alert('Cancel failed', error instanceof Error ? error.message : 'Please try again.');
          }
        }
      }
    ]);
  };

  const confirmRemoveAttendee = (userId: string, displayName: string) => {
    if (!event) return;
    Alert.alert('Remove attendee', `Remove ${displayName} from this event?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeAttendee.mutateAsync({ eventId: event.id, userId });
          } catch (error) {
            Alert.alert('Remove failed', error instanceof Error ? error.message : 'Please try again.');
          }
        }
      }
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 10}
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">Manage Event</AppText>
        <Button size="sm" disabled={!event || isLoading} loading={updateEvent.isPending} onPress={save}>Save</Button>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        bounces
        overScrollMode="always"
        refreshControl={
          <AppRefreshControl
            refreshing={isRefetching || waitlistRefetching}
            onRefresh={() => void Promise.all([refetch(), refetchWaitlist()])}
          />
        }
      >
        {isLoading ? <ActivityIndicator color={colors.orange[500]} /> : null}
        {isError ? (
          <View style={styles.state}>
            <AppText variant="bodyMuted" style={styles.stateText}>
              {error instanceof Error ? error.message : 'Could not load this event.'}
            </AppText>
            <Button size="sm" onPress={() => void refetch()}>Retry</Button>
          </View>
        ) : null}
        {!isLoading && !isError && !event ? (
          <View style={styles.state}>
            <AppText variant="h4">Event not found</AppText>
            <Button size="sm" onPress={() => navigation.goBack()}>Go Back</Button>
          </View>
        ) : null}
        {event ? (
          <>
            <Input label="Title" value={title} onChangeText={setTitle} />
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
            </View>
            <Input label="Description" value={description} onChangeText={setDescription} multiline />
            <Input label="Starts at" value={startsAt} onChangeText={setStartsAt} />
            <Input label="Ends at" value={endsAt} onChangeText={setEndsAt} />
            <Input label="Location" value={locationName} onChangeText={setLocationName} />
            <Input label="City" value={city} onChangeText={setCity} />
            <Input label="Max players" value={maxPlayers} onChangeText={setMaxPlayers} keyboardType="number-pad" />
            <AppText variant="h4">Attendees</AppText>
            {event.attendees.map((attendee) => (
              <View key={attendee.id} style={styles.attendee}>
                <Avatar initials={attendee.initials} uri={attendee.avatarUrl} size={38} />
                <View style={{ flex: 1 }}>
                  <VerifiedName profile={attendee} style={styles.attendeeName} numberOfLines={1} />
                  <AppText variant="small">@{attendee.username}</AppText>
                </View>
                {attendee.id !== event.organizer.id ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={removeAttendee.isPending}
                    onPress={() => confirmRemoveAttendee(attendee.id, attendee.displayName)}
                  >
                    Remove
                  </Button>
                ) : null}
              </View>
            ))}
            <AppText variant="h4">Waitlist</AppText>
            {waitlistIsError ? (
              <View style={styles.state}>
                <AppText variant="bodyMuted">Could not load the waitlist.</AppText>
                <Button size="sm" onPress={() => void refetchWaitlist()}>Retry</Button>
              </View>
            ) : null}
            {!waitlistIsError && waitlist.length === 0 ? (
              <AppText variant="bodyMuted">No players are waiting for a spot.</AppText>
            ) : null}
            {waitlist.map((entry) => (
              <View key={entry.id} style={styles.attendee}>
                <Avatar initials={entry.user.initials} uri={entry.user.avatarUrl} size={38} />
                <View style={{ flex: 1 }}>
                  <VerifiedName profile={entry.user} style={styles.attendeeName} numberOfLines={1} />
                  <AppText variant="small">@{entry.user.username}</AppText>
                </View>
              </View>
            ))}
            <Button full variant="danger" loading={cancelEvent.isPending} onPress={cancel}>
              Cancel Event
            </Button>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  scroll: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    padding: spacing.screen,
    gap: spacing.md,
    paddingBottom: 40
  },
  state: {
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.md
  },
  stateText: {
    textAlign: 'center'
  },
  group: {
    gap: 8
  },
  label: {
    color: colors.text.tertiary,
    fontWeight: '700',
    fontSize: 12
  },
  attendee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    padding: spacing.sm
  },
  attendeeName: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  }
});
