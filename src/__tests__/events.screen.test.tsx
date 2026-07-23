import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn()
};
const mockRoute: { params: Record<string, any> } = { params: {} };
const mockCreateEvent = jest.fn();
const mockJoinEvent = jest.fn();
const mockLeaveEvent = jest.fn();
const mockLeaveWaitlist = jest.fn();
const mockEventRefetch = jest.fn();
const mockParticipationRefetch = jest.fn();
const mockEventsRefetch = jest.fn();
const mockBatchParticipationRefetch = jest.fn();
let mockParticipation: string | undefined;
let mockParticipationBatch: Record<string, string> = {};
let mockEventsData: Record<string, any>[] = [];
let mockEventData: Record<string, any> | undefined;

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn()
}));
jest.mock('expo-location', () => ({
  geocodeAsync: jest.fn().mockResolvedValue([{ latitude: 12.9, longitude: 77.6 }])
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('@/components/feed/CourtArt', () => ({ CourtArt: () => null }));
jest.mock('@/utils/share', () => ({ shareEvent: jest.fn() }));
jest.mock('@/hooks/useEvents', () => ({
  useCreateEvent: () => ({ mutateAsync: mockCreateEvent, isPending: false }),
  useEvent: () => ({
    data: mockEventData,
    isLoading: false,
    isError: false,
    isRefetching: false,
    error: null,
    refetch: mockEventRefetch
  }),
  useJoinEvent: () => ({ mutateAsync: mockJoinEvent }),
  useLeaveEvent: () => ({ mutateAsync: mockLeaveEvent, isPending: false }),
  useLeaveEventWaitlist: () => ({ mutateAsync: mockLeaveWaitlist, isPending: false }),
  useEventParticipation: () => ({
    data: mockParticipation,
    isRefetching: false,
    refetch: mockParticipationRefetch
  }),
  useEvents: () => ({
    data: mockEventsData,
    isLoading: false,
    isError: false,
    isRefetching: false,
    refetch: mockEventsRefetch
  }),
  useEventParticipationBatch: () => ({
    data: mockParticipationBatch,
    isRefetching: false,
    refetch: mockBatchParticipationRefetch
  })
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ profile: { id: 'viewer-id' } })
}));

// eslint-disable-next-line import/first
import { CreateEventScreen } from '@/screens/events/CreateEventScreen';
// eslint-disable-next-line import/first
import { EventDetailScreen } from '@/screens/events/EventDetailScreen';
// eslint-disable-next-line import/first
import { EventsScreen } from '@/screens/events/EventsScreen';

const organizer = {
  id: 'organizer-id',
  username: 'host',
  displayName: 'Event Host',
  initials: 'EH',
  avatarUrl: null,
  bio: '',
  city: 'Bengaluru',
  country: 'India',
  primarySport: 'Basketball',
  sports: ['Basketball'],
  skillLevel: 'Intermediate',
  isOnline: true,
  badges: [],
  stats: { followers: 1, following: 1, posts: 1, winRate: 50, games: 2 }
};

const event = {
  id: 'event-42',
  title: 'Friday Night Hoops',
  eventType: 'Pickup Game',
  sport: 'Basketball',
  status: 'open',
  visibility: 'public',
  description: 'Friendly five on five.',
  coverUrl: null,
  startsAt: '2099-08-21T12:30:00.000Z',
  endsAt: '2099-08-21T14:30:00.000Z',
  locationName: 'Central Court',
  city: 'Bengaluru',
  latitude: 12.9,
  longitude: 77.6,
  maxPlayers: 10,
  playerCount: 4,
  entryFeeCents: 0,
  currency: 'INR',
  entryFeeLabel: 'Free',
  organizer,
  attendees: []
};

describe('event creation and joining', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockRoute.params = {};
    mockEventData = undefined;
    mockParticipation = undefined;
    mockParticipationBatch = {};
    mockEventsData = [];
    mockCreateEvent.mockResolvedValue({ id: 'created-event-id' });
    mockJoinEvent.mockResolvedValue('going');
    mockLeaveWaitlist.mockResolvedValue(undefined);
    mockEventRefetch.mockResolvedValue(undefined);
    mockParticipationRefetch.mockResolvedValue(undefined);
    mockEventsRefetch.mockResolvedValue(undefined);
    mockBatchParticipationRefetch.mockResolvedValue(undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('submits visible form choices and routes to the created event', async () => {
    await render(<CreateEventScreen />);

    await fireEvent.changeText(screen.getByLabelText('Event Title'), '  Summer League  ');
    await fireEvent.changeText(screen.getByLabelText('Location / Court'), '  Central Court  ');
    await fireEvent.changeText(screen.getByLabelText('City'), '  Mysuru  ');
    await fireEvent.changeText(screen.getByLabelText('Date'), '2099-08-21');
    await fireEvent.changeText(screen.getByLabelText('Time'), '18:30');
    await fireEvent.changeText(screen.getByLabelText('Entry Fee (INR, optional)'), '250');
    await fireEvent.press(screen.getByRole('button', { name: 'Invite-only' }));
    await fireEvent.press(screen.getAllByRole('button', { name: 'Create' })[0]);

    await waitFor(() =>
      expect(mockCreateEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Summer League',
          locationName: 'Central Court',
          city: 'Mysuru',
          entryFeeCents: 25000,
          visibility: 'invite',
          latitude: 12.9,
          longitude: 77.6
        })
      )
    );
    expect(alertSpy).toHaveBeenCalledWith(
      'Event created',
      'Your event is ready.',
      expect.any(Array)
    );

    const actions = alertSpy.mock.calls.find(([title]) => title === 'Event created')?.[2];
    actions[0].onPress();
    expect(mockNavigation.replace).toHaveBeenCalledWith('EventDetail', {
      eventId: 'created-event-id'
    });
  });

  it('joins an event and refreshes both event and attendance state', async () => {
    mockRoute.params = { eventId: event.id };
    mockEventData = event;
    await render(<EventDetailScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Join Event' }));

    await waitFor(() => expect(mockJoinEvent).toHaveBeenCalledWith(event.id));
    expect(alertSpy).toHaveBeenCalledWith('Joined event', 'You are on the attendee list.');
    expect(mockEventRefetch).toHaveBeenCalled();
    expect(mockParticipationRefetch).toHaveBeenCalled();
  });

  it('opens event chat only for an attendee', async () => {
    mockRoute.params = { eventId: event.id };
    mockEventData = event;
    mockParticipation = 'going';
    await render(<EventDetailScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Event Chat' }));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('EventChat', {
      eventId: event.id
    });
  });

  it('shows persistent waitlist state on the event list', async () => {
    mockEventsData = [event];
    mockParticipationBatch = { [event.id]: 'waitlisted' };
    await render(<EventsScreen />);

    expect(screen.getByRole('button', { name: 'Leave Waitlist' })).toBeTruthy();
  });

  it('leaves the waitlist after confirmation', async () => {
    mockRoute.params = { eventId: event.id };
    mockEventData = event;
    mockParticipation = 'waitlisted';
    await render(<EventDetailScreen />);

    expect(screen.getByText('WAITLISTED')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Leave Waitlist' }));
    const confirmation = alertSpy.mock.calls.find(([title]) => title === 'Leave waitlist');
    await confirmation?.[2]?.[1]?.onPress?.();

    await waitFor(() => expect(mockLeaveWaitlist).toHaveBeenCalledWith(event.id));
    expect(alertSpy).toHaveBeenCalledWith('Waitlist left', 'You are no longer waiting for this event.');
  });

  it('joins the waitlist when a full event is selected', async () => {
    mockRoute.params = { eventId: event.id };
    mockEventData = { ...event, status: 'full', playerCount: event.maxPlayers };
    mockJoinEvent.mockResolvedValue('waitlisted');
    await render(<EventDetailScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Join Waitlist' }));

    await waitFor(() => expect(mockJoinEvent).toHaveBeenCalledWith(event.id));
    expect(alertSpy).toHaveBeenCalledWith(
      'Added to waitlist',
      'You will be promoted automatically if a spot opens.'
    );
  });
});






