import { Alert } from 'react-native';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockNavigation = {
  addListener: jest.fn(() => jest.fn()),
  dispatch: jest.fn(),
  goBack: jest.fn()
};
const mockRoute = { params: { eventId: 'event-1' } };
const mockUpdateEvent = jest.fn();
let mockEvent: Record<string, any> | undefined;

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn()
}));
jest.mock('@/hooks/useCommunities', () => ({ useCommunityMembers: () => ({ data: [] }) }));
jest.mock('@/services/profileService', () => ({ profileService: { listPlayers: jest.fn() } }));
jest.mock('@/hooks/usePlayerSearch', () => ({
  usePlayerSearch: () => ({
    query: '', setQuery: jest.fn(), results: [],
    isLoading: false, isFetching: false, isError: false, error: null,
    retry: jest.fn(), hasMore: false, loadMore: jest.fn()
  })
}));
jest.mock('@/hooks/useEvents', () => ({
  useEvent: () => ({ data: mockEvent, isLoading: false, isError: false, isRefetching: false, error: null, refetch: jest.fn() }),
  useEventWaitlist: () => ({ data: [], isError: false, isRefetching: false, refetch: jest.fn() }),
  useEventInvitations: () => ({ data: [], refetch: jest.fn() }),
  useUpdateEvent: () => ({ mutateAsync: mockUpdateEvent, isPending: false }),
  useCancelEvent: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRemoveEventAttendee: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRemoveEventWaitlistUser: () => ({ mutateAsync: jest.fn(), isPending: false }),
  usePromoteEventWaitlistUser: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useInviteToEvent: () => ({ mutate: jest.fn(), isPending: false }),
  useRevokeEventInvitation: () => ({ mutate: jest.fn(), isPending: false })
}));

// eslint-disable-next-line import/first
import { ManageEventScreen } from '@/screens/events/ManageEventScreen';

const organizer = {
  id: 'organizer-1',
  displayName: 'Organizer',
  username: 'organizer',
  initials: 'OR',
  avatarUrl: null,
  bio: '', city: '', country: '', primarySport: 'Basketball', sports: ['Basketball'],
  skillLevel: 'Intermediate', isOnline: false, badges: [],
  stats: { followers: 0, following: 0, posts: 0, winRate: 0, games: 0 }
};

const event = {
  id: 'event-1', title: 'Friday Hoops', eventType: 'Pickup Game', sport: 'Basketball', status: 'open',
  visibility: 'public', description: 'Bring water.', coverUrl: null,
  startsAt: '2099-08-21T12:30:00.000Z', endsAt: '2099-08-21T14:30:00.000Z',
  locationName: 'Central Court', city: 'Bengaluru', latitude: 12.9, longitude: 77.6,
  maxPlayers: 10, playerCount: 2, entryFeeCents: 0, currency: 'INR', entryFeeLabel: 'Free',
  organizer, attendees: []
};

describe('ManageEventScreen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEvent = event;
    mockUpdateEvent.mockResolvedValue(event);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    cleanup();
  });

  it('saves editable fee and date fields after material-change confirmation', async () => {
    await render(<ManageEventScreen />);
    await waitFor(() => expect(screen.getByLabelText('Title').props.value).toBe('Friday Hoops'));

    fireEvent.changeText(screen.getByLabelText('Entry fee'), '50');
    await waitFor(() => expect(screen.getByLabelText('Entry fee').props.value).toBe('50'));
    fireEvent.press(screen.getAllByRole('button', { name: 'Save' })[0]);

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'Notify attendees?',
      'This change affects attendees. They will be notified.',
      expect.any(Array)
    ));
    const confirmation = alertSpy.mock.calls.find(([title]) => title === 'Notify attendees?');
    await confirmation?.[2]?.[1]?.onPress?.();

    await waitFor(() => expect(mockUpdateEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'event-1',
      updates: expect.objectContaining({ sport: 'Basketball', entryFeeCents: 5000 })
    })));
  });

  it('locks sport once players have joined and retains inputs when saving fails', async () => {
    mockUpdateEvent.mockRejectedValue(new Error('RLS denied'));
    render(<ManageEventScreen />);
    await waitFor(() => expect(screen.getByLabelText('Title').props.value).toBe('Friday Hoops'));

    const football = screen.getByText('Football').parent;
    expect(football?.props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByLabelText('Title'), 'Still Friday Hoops');
    fireEvent.press(screen.getAllByRole('button', { name: 'Save' })[0]);

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Save failed', 'RLS denied'));
    expect(screen.getByLabelText('Title').props.value).toBe('Still Friday Hoops');
  });

});
