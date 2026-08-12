import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Calendar, Camera, ChevronLeft, Clock } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';


import { RemoveMemberSheet } from '@/components/community/RemoveMemberSheet';
import { AppRefreshControl, AppText, Avatar, Button, Chip, IconButton, Input, VerifiedName } from '@/components/ui';

import { eventPaymentNotice, eventTypes, eventVisibilityOptions } from '@/constants/events';
import { allSports } from '@/constants/sports';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import {
  useCancelEvent,
  useEvent,
  useEventInvitations,
  useEventWaitlist,
  useInviteToEvent,
  usePromoteEventWaitlistUser,
  useRemoveEventAttendee,
  useRemoveEventWaitlistUser,
  useRevokeEventInvitation,
  useUpdateEvent
} from '@/hooks/useEvents';
import { useCommunityMembers } from '@/hooks/useCommunities';
import { usePlayerSearch } from '@/hooks/usePlayerSearch';
import type { EventType, EventVisibility, Sport } from '@/types/domain';
import type { AppStackParamList } from '@/navigation/routes';
import { formatDateInput, formatTimeInput, getErrorMessage, parseManualStartDate } from '@/utils/eventDateValidation';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'ManageEvent'>;

export function ManageEventScreen() {
  const navigation = useNavigation<Navigation>();
  const { colors: theme } = useAppTheme();
  const route = useRoute<Route>();
  const { data: event, isLoading, isError, isRefetching, error, refetch } = useEvent(route.params.eventId);
  const {
    data: waitlist = [],
    isError: waitlistIsError,
    isRefetching: waitlistRefetching,
    refetch: refetchWaitlist
  } = useEventWaitlist(route.params.eventId);
  const { data: communityMembers = [] } = useCommunityMembers(event?.communityId ?? '', Boolean(event?.communityId));
  const { data: invitations = [], refetch: refetchInvitations } = useEventInvitations(route.params.eventId, Boolean(event));
  const updateEvent = useUpdateEvent();
  const cancelEvent = useCancelEvent();
  const removeAttendee = useRemoveEventAttendee();
  const removeWaitlistUser = useRemoveEventWaitlistUser();
  const promoteWaitlistUser = usePromoteEventWaitlistUser();
  const inviteToEvent = useInviteToEvent();
  const revokeInvitation = useRevokeEventInvitation();
  const [title, setTitle] = useState(event?.title ?? '');
  const [eventType, setEventType] = useState<EventType>(event?.eventType ?? eventTypes[0]);
  const [sport, setSport] = useState<Sport>(event?.sport ?? allSports[0]);
  const [visibility, setVisibility] = useState<EventVisibility>(event?.visibility ?? 'public');
  const [description, setDescription] = useState(event?.description ?? '');
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [duration, setDuration] = useState('2');
  const [locationName, setLocationName] = useState(event?.locationName ?? '');
  const [city, setCity] = useState(event?.city ?? '');
  const [maxPlayers, setMaxPlayers] = useState(event?.maxPlayers.toString() ?? '10');
  const [entryFee, setEntryFee] = useState(event ? String(event.entryFeeCents / 100) : '0');
  const [coverImage, setCoverImage] = useState<string | null>(event?.coverUrl ?? null);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [attendeeToRemove, setAttendeeToRemove] = useState<{
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    initials?: string;
    username?: string;
    isWaitlist?: boolean;
  } | null>(null);
  const initialForm = useRef<string | null>(null);
  const initializedEventId = useRef<string | null>(null);
  const excludedPlayerIds = useMemo(
    () => new Set([
      ...(event ? [event.organizer.id] : []),
      ...(event?.attendees ?? []).map((attendee) => attendee.id)
    ]),
    [event]
  );
  const playerSearch = usePlayerSearch({ excludeIds: excludedPlayerIds });

  const formSnapshot = (values: {
    title: string;
    eventType: EventType;
    sport: Sport;
    visibility: EventVisibility;
    description: string;
    dateText: string;
    timeText: string;
    duration: string;
    locationName: string;
    city: string;
    maxPlayers: string;
    entryFee: string;
    coverImage: string | null;
    coverRemoved: boolean;
  }) => JSON.stringify(values);

  useEffect(() => {
    if (!event || initializedEventId.current === event.id) return;
    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt);
    const durationHours = Math.max(0.25, (end.getTime() - start.getTime()) / (60 * 60 * 1000));
    setTitle(event.title);
    setEventType(event.eventType);
    setSport(event.sport);
    setVisibility(event.visibility);
    setDescription(event.description);
    setDateText(formatDateInput(start));
    setTimeText(formatTimeInput(start));
    setDuration(String(durationHours));
    setLocationName(event.locationName);
    setCity(event.city);
    setMaxPlayers(event.maxPlayers.toString());
    setEntryFee(String(event.entryFeeCents / 100));
    setCoverImage(event.coverUrl ?? null);
    setCoverRemoved(false);
    initialForm.current = formSnapshot({
      title: event.title,
      eventType: event.eventType,
      sport: event.sport,
      visibility: event.visibility,
      description: event.description,
      dateText: formatDateInput(start),
      timeText: formatTimeInput(start),
      duration: String(durationHours),
      locationName: event.locationName,
      city: event.city,
      maxPlayers: event.maxPlayers.toString(),
      entryFee: String(event.entryFeeCents / 100),
      coverImage: event.coverUrl ?? null,
      coverRemoved: false
    });
    initializedEventId.current = event.id;
  }, [event]);

  const isDirty = initialForm.current !== null && initialForm.current !== formSnapshot({
    title,
    eventType,
    sport,
    visibility,
    description,
    dateText,
    timeText,
    duration,
    locationName,
    city,
    maxPlayers,
    entryFee,
    coverImage,
    coverRemoved
  });

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (action) => {
      if (!isDirty || updateEvent.isPending) return;
      action.preventDefault();
      Alert.alert('Discard changes?', 'Your event edits have not been saved.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(action.data.action) }
      ]);
    });
    return unsubscribe;
  }, [isDirty, navigation, updateEvent.isPending]);

  const pickCover = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to change the event cover.');
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
        setCoverRemoved(false);
      }
    } catch (pickError) {
      Alert.alert('Cover unavailable', getErrorMessage(pickError));
    }
  };

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
    const parsedStart = parseManualStartDate(dateText, timeText);
    if ('error' in parsedStart) {
      Alert.alert('Invalid date or time', parsedStart.error);
      return;
    }
    const durationHours = Number(duration);
    if (!Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 24) {
      Alert.alert('Invalid time', 'Duration must be greater than 0 and no more than 24 hours.');
      return;
    }
    const startsAt = parsedStart.date.toISOString();
    const endsAt = new Date(parsedStart.date.getTime() + durationHours * 60 * 60 * 1000).toISOString();
    if (new Date(endsAt) <= parsedStart.date) {
      Alert.alert('Invalid time', 'Event end time must be after the start time.');
      return;
    }
    const capacity = Number(maxPlayers);
    if (!Number.isInteger(capacity) || capacity < 2 || capacity < event.playerCount) {
      Alert.alert('Invalid capacity', `Max players must be at least ${Math.max(2, event.playerCount)}.`);
      return;
    }
    const feeAmount = Number(entryFee);
    if (!Number.isFinite(feeAmount) || feeAmount < 0) {
      Alert.alert('Invalid fee', 'Entry fee must be 0 or a positive amount.');
      return;
    }
    const applySave = async () => {
      try {
      await updateEvent.mutateAsync({
        eventId: event.id,
        updates: {
          title: title.trim(),
          eventType,
          sport,
          description,
          startsAt,
          endsAt,
          locationName: locationName.trim(),
          city: city.trim(),
          maxPlayers: capacity,
          entryFeeCents: Math.round(feeAmount * 100),
          visibility,
          coverImageUri: coverRemoved ? null : coverImage !== event.coverUrl ? coverImage : undefined
        }
      });
      initialForm.current = formSnapshot({
        title,
        eventType,
        sport,
        visibility,
        description,
        dateText,
        timeText,
        duration,
        locationName,
        city,
        maxPlayers,
        entryFee,
        coverImage,
        coverRemoved
      });
      Alert.alert('Event saved', 'Your changes are live.', [
        { text: 'Done', onPress: () => navigation.goBack() }
      ]);
      } catch (saveError) {
        Alert.alert('Save failed', getErrorMessage(saveError));
      }
    };
    const isMaterialChange =
      new Date(event.startsAt).getTime() !== new Date(startsAt).getTime()
      || new Date(event.endsAt).getTime() !== new Date(endsAt).getTime()
      || event.locationName !== locationName.trim()
      || event.city !== city.trim()
      || event.entryFeeCents !== Math.round(feeAmount * 100);
    if (isMaterialChange) {
      Alert.alert('Notify attendees?', 'This change affects attendees. They will be notified.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save & Notify', onPress: () => void applySave() }
      ]);
      return;
    }
    await applySave();
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

  const confirmRemoveAttendee = (attendee: NonNullable<typeof event>['attendees'][number]) => {
    setAttendeeToRemove({
      id: attendee.id,
      displayName: attendee.displayName,
      avatarUrl: attendee.avatarUrl,
      initials: attendee.initials,
      username: attendee.username,
      isWaitlist: false
    });
  };

  const promoteWaitlistedUser = async (userId: string) => {
    if (!event) return;
    try {
      await promoteWaitlistUser.mutateAsync({ eventId: event.id, userId });
      Alert.alert('Player promoted', 'The player is now going and has been notified.');
    } catch (error) {
      Alert.alert('Promotion failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const confirmRemoveWaitlistedUser = (user: (typeof waitlist)[number]['user']) => {
    setAttendeeToRemove({
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      initials: user.initials,
      username: user.username,
      isWaitlist: true
    });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
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
        {isLoading ? <ActivityIndicator color={theme.accent} /> : null}
        {isError ? (
          <View style={[styles.state, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <AppText variant="bodyMuted" style={styles.stateText}>
              {error instanceof Error ? error.message : 'Could not load this event.'}
            </AppText>
            <Button size="sm" onPress={() => void refetch()}>Retry</Button>
          </View>
        ) : null}
        {!isLoading && !isError && !event ? (
          <View style={[styles.state, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <AppText variant="h4">Event not found</AppText>
            <Button size="sm" onPress={() => navigation.goBack()}>Go Back</Button>
          </View>
        ) : null}
        {event ? (
          <>
            <Pressable style={[styles.cover, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => void pickCover()}>
              {coverImage ? (
                <Image source={{ uri: coverImage }} resizeMode="cover" style={styles.coverImage} />
              ) : (
                <>
                  <Camera size={28} color={theme.textSubtle} />
                  <AppText variant="small">Add cover photo</AppText>
                </>
              )}
              <AppText variant="small" style={styles.coverAction}>
                {coverImage ? 'Tap to change' : 'Tap to add'}
              </AppText>
            </Pressable>
            {coverImage ? (
              <Button size="sm" variant="ghost" onPress={() => { setCoverImage(null); setCoverRemoved(true); }}>
                Remove cover
              </Button>
            ) : null}
            <Input label="Title" value={title} onChangeText={setTitle} />
            <View style={styles.group}>
              <AppText style={[styles.label, { color: theme.textSubtle }]}>Event Type</AppText>
              <ScrollView horizontal style={styles.chipScroller} contentContainerStyle={styles.chipContent} showsHorizontalScrollIndicator={false}>
                {eventTypes.map((item) => (
                  <Chip key={item} selected={item === eventType} onPress={() => setEventType(item)}>
                    {item}
                  </Chip>
                ))}
              </ScrollView>
            </View>
            <View style={styles.group}>
              <AppText style={[styles.label, { color: theme.textSubtle }]}>Sport</AppText>
              <ScrollView horizontal style={styles.chipScroller} contentContainerStyle={styles.chipContent} showsHorizontalScrollIndicator={false}>
                {allSports.map((item) => (
                  <Chip
                    key={item}
                    selected={item === sport}
                    disabled={event.playerCount > 0}
                    onPress={() => setSport(item)}
                  >
                    {item}
                  </Chip>
                ))}
              </ScrollView>
              {event.playerCount > 0 ? <AppText variant="small">Sport is locked after players join.</AppText> : null}
            </View>
            {event.communityId ? (
              <View style={styles.group}>
                <AppText style={[styles.label, { color: theme.textSubtle }]}>Visibility</AppText>
                <View style={styles.dateAdjust}>
                  <Chip accessibilityLabel="Group members" selected={visibility === 'group'} onPress={() => setVisibility('group')}>Group members</Chip>
                  <Chip accessibilityLabel="Invite-only" selected={visibility === 'invite'} onPress={() => setVisibility('invite')}>Invite-only</Chip>
                </View>
                <AppText variant="bodyMuted">Group events stay limited to group members or explicitly invited members.</AppText>
              </View>
            ) : (
              <View style={styles.group}>
                <AppText style={[styles.label, { color: theme.textSubtle }]}>Visibility</AppText>
                <ScrollView horizontal style={styles.chipScroller} contentContainerStyle={styles.chipContent} showsHorizontalScrollIndicator={false}>
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
            )}
            <Input label="Description" value={description} onChangeText={setDescription} multiline />
            <View style={styles.group}>
              <AppText style={[styles.label, { color: theme.textSubtle }]}>Date & Time</AppText>
              <View style={styles.manualDateTimeRow}>
                <View style={styles.manualDateTimeField}>
                  <Input label="Date" icon={Calendar} value={dateText} onChangeText={setDateText} placeholder="YYYY-MM-DD" />
                </View>
                <View style={styles.manualDateTimeField}>
                  <Input label="Time" icon={Clock} value={timeText} onChangeText={setTimeText} placeholder="HH:mm" keyboardType="numbers-and-punctuation" />
                </View>
              </View>
              <AppText variant="small">Use 24-hour time, e.g. 18:30.</AppText>
            </View>
            <Input label="Duration (hours)" value={duration} onChangeText={setDuration} keyboardType="numeric" />
            <Input label="Location" value={locationName} onChangeText={setLocationName} />
            <Input label="City" value={city} onChangeText={setCity} />
            <Input label="Max players" value={maxPlayers} onChangeText={setMaxPlayers} keyboardType="number-pad" placeholder={String(Math.max(2, event.playerCount))} />
            <Input label="Entry fee" value={entryFee} onChangeText={setEntryFee} keyboardType="decimal-pad" placeholder="0" />
            {Number(entryFee) > 0 ? <AppText variant="small">{eventPaymentNotice}</AppText> : null}
            <AppText variant="h4">Attendees</AppText>
            {event.attendees.map((attendee) => (
              <View key={attendee.id} style={[styles.attendee, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Avatar initials={attendee.initials} uri={attendee.avatarUrl} size={38} />
                <View style={{ flex: 1 }}>
                  <VerifiedName profile={attendee} style={styles.attendeeName} numberOfLines={1} />
                  <AppText variant="small">@{attendee.username}</AppText>
                </View>
                {attendee.id !== event.organizer.id ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={removeAttendee.isPending && attendeeToRemove?.id === attendee.id}
                    onPress={() => confirmRemoveAttendee(attendee)}
                  >
                    Remove
                  </Button>
                ) : null}
              </View>
            ))}
            <AppText variant="h4">Waitlist</AppText>
            <AppText variant="bodyMuted">
              Departures promote the longest-waiting eligible player automatically. Manual promotion is available only when a space is open.
            </AppText>
            {waitlistIsError ? (
              <View style={[styles.state, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <AppText variant="bodyMuted">Could not load the waitlist.</AppText>
                <Button size="sm" onPress={() => void refetchWaitlist()}>Retry</Button>
              </View>
            ) : null}
            {!waitlistIsError && waitlist.length === 0 ? (
              <AppText variant="bodyMuted">No players are waiting for a spot.</AppText>
            ) : null}
            {waitlist.map((entry) => (
              <View key={entry.id} style={[styles.attendee, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Avatar initials={entry.user.initials} uri={entry.user.avatarUrl} size={38} />
                <View style={{ flex: 1 }}>
                  <VerifiedName profile={entry.user} style={styles.attendeeName} numberOfLines={1} />
                  <AppText variant="small">@{entry.user.username}</AppText>
                </View>
                <View style={styles.waitlistActions}>
                  <Button
                    size="sm"
                    disabled={event.playerCount >= event.maxPlayers}
                    loading={
                      promoteWaitlistUser.isPending
                      && promoteWaitlistUser.variables?.userId === entry.user.id
                    }
                    onPress={() => void promoteWaitlistedUser(entry.user.id)}
                  >
                    Promote
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={
                      removeWaitlistUser.isPending
                      && removeWaitlistUser.variables?.userId === entry.user.id
                    }
                    onPress={() => confirmRemoveWaitlistedUser(entry.user)}
                  >
                    Remove
                  </Button>
                </View>
              </View>
            ))}
            {event.visibility === 'invite' ? (
              <>
                <AppText variant="h4">Invite Players</AppText>
                {event.communityId ? <AppText variant="bodyMuted">Only current group members can be invited to this group event.</AppText> : (
                  <>
                    <Input
                      label="Find players"
                      value={playerSearch.query}
                      onChangeText={playerSearch.setQuery}
                      placeholder="Search players"
                    />
                    {playerSearch.isLoading ? <ActivityIndicator color={theme.accent} /> : null}
                    {playerSearch.isError ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Retry player search"
                        onPress={() => void playerSearch.retry()}
                      >
                        <AppText variant="bodyMuted">Could not search players. Tap to retry.</AppText>
                      </Pressable>
                    ) : null}
                    {!playerSearch.isLoading && !playerSearch.isError && playerSearch.query.trim() && playerSearch.results.length === 0 ? (
                      <AppText variant="bodyMuted">No players found.</AppText>
                    ) : null}
                  </>
                )}
                {(event.communityId ? communityMembers.map((member) => member.profile) : playerSearch.results)
                  .filter((player) => player.id !== event.organizer.id && !event.attendees.some((attendee) => attendee.id === player.id))
                  .map((player) => {
                    const existing = invitations.find((invitation) => invitation.invitee?.id === player.id);
                    return (
                      <View key={player.id} style={[styles.attendee, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <Avatar initials={player.initials} uri={player.avatarUrl} size={38} />
                        <View style={{ flex: 1 }}>
                          <VerifiedName profile={player} style={styles.attendeeName} numberOfLines={1} />
                          <AppText variant="small">{existing ? existing.status : 'Not invited'}</AppText>
                        </View>
                        {existing?.status === 'pending' ? (
                          <Button size="sm" variant="ghost" loading={revokeInvitation.isPending} onPress={() => revokeInvitation.mutate(existing.id, { onSuccess: () => void refetchInvitations() })}>Revoke</Button>
                        ) : (
                          <Button size="sm" loading={inviteToEvent.isPending} onPress={() => inviteToEvent.mutate({ eventId: event.id, userId: player.id }, { onSuccess: () => void refetchInvitations() })}>Invite</Button>
                        )}
                      </View>
                    );
                  })}
              </>
            ) : null}
            <Button full variant="danger" loading={cancelEvent.isPending} onPress={cancel}>
              Cancel Event
            </Button>
          </>
        ) : null}
      </ScrollView>
      <RemoveMemberSheet
        open={Boolean(attendeeToRemove)}
        member={attendeeToRemove}
        title={attendeeToRemove?.isWaitlist ? 'Remove from waitlist' : 'Remove attendee'}
        contextName={event?.title}
        warningMessage={
          attendeeToRemove?.isWaitlist
            ? `Remove ${attendeeToRemove.displayName} from this event's waitlist?`
            : `Remove ${attendeeToRemove?.displayName} from this event?`
        }
        loading={removeAttendee.isPending || removeWaitlistUser.isPending}
        onClose={() => setAttendeeToRemove(null)}
        onConfirm={async () => {
          if (!attendeeToRemove || !event) return;
          const target = attendeeToRemove;
          try {
            if (target.isWaitlist) {
              await removeWaitlistUser.mutateAsync({ eventId: event.id, userId: target.id });
            } else {
              await removeAttendee.mutateAsync({ eventId: event.id, userId: target.id });
            }
            setAttendeeToRemove(null);
          } catch (error) {
            Alert.alert('Remove failed', error instanceof Error ? error.message : 'Please try again.');
          }
        }}
      />
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
  chipScroller: {
    flexGrow: 0
  },
  chipContent: {
    alignItems: 'flex-start'
  },
  dateAdjust: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  cover: {
    height: 164,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700]
  },
  coverImage: {
    width: '100%',
    height: '100%',
    position: 'absolute'
  },
  coverAction: {
    color: colors.light[0],
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 10
  },
  manualDateTimeRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  manualDateTimeField: {
    flex: 1
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
  },
  waitlistActions: {
    alignItems: 'flex-end',
    gap: spacing.xs
  }
});
