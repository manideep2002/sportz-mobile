import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn()
};
let mockRoute: { params?: { bookingId?: string; admin?: boolean } } = {};
const mockCancel = jest.fn();

const court = {
  id: 'court-1',
  name: 'Indiranagar Arena',
  sport: 'Basketball',
  city: 'Bengaluru',
  address: '100 Feet Road',
  latitude: 12.9,
  longitude: 77.6,
  distanceKm: null,
  surface: 'Hardwood',
  rating: 4.8,
  hourlyPrice: 900,
  currency: 'INR',
  openNow: false,
  futureBookable: true,
  availabilityLabel: 'Bookable',
  timezone: 'Asia/Kolkata',
  slotDurationMinutes: 60,
  bookingWindowDays: 30,
  cancellationNoticeHours: 6,
  bookingRequiresApproval: true,
  paymentPolicy: 'external'
};

const profile = {
  id: 'user-1',
  displayName: 'Player One',
  initials: 'PO',
  avatarUrl: null
};

const mockUpcomingBooking = {
  id: 'booking-upcoming',
  court: { ...court, name: 'Upcoming Arena' },
  user: profile,
  startsAt: '2026-07-26T12:30:00.000Z',
  endsAt: '2026-07-26T13:30:00.000Z',
  status: 'confirmed',
  price: 900,
  currency: 'INR',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
  cancelledAt: null,
  cancellationReason: null,
  canCancel: true,
  cancellationDeadline: '2026-07-26T06:30:00.000Z'
};

const mockCancelledBooking = {
  ...mockUpcomingBooking,
  id: 'booking-cancelled',
  court: { ...court, name: 'Cancelled Arena' },
  status: 'cancelled',
  cancelledAt: '2026-07-21T00:00:00.000Z',
  canCancel: false
};

const mockMyQuery = {
  data: [mockUpcomingBooking, mockCancelledBooking],
  isLoading: false,
  isError: false,
  isRefetching: false,
  error: null,
  refetch: jest.fn()
};

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { profile: { isAdmin: boolean } }) => unknown) =>
    selector({ profile: { isAdmin: false } })
}));
jest.mock('@/hooks/useCourts', () => ({
  useMyCourtBookings: () => mockMyQuery,
  useAdminCourtBookings: () => ({ ...mockMyQuery, data: [] }),
  useUpdateCourtBookingStatus: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useCourtBooking: () => ({
    data: mockUpcomingBooking,
    isLoading: false,
    isError: false,
    isRefetching: false,
    error: null,
    refetch: jest.fn()
  }),
  useCancelCourtBooking: () => ({
    mutateAsync: (...args: unknown[]) => mockCancel(...args),
    isPending: false
  })
}));

// eslint-disable-next-line import/first
import { CourtBookingDetailScreen } from '@/screens/courts/CourtBookingDetailScreen';
// eslint-disable-next-line import/first
import { CourtBookingsScreen } from '@/screens/courts/CourtBookingsScreen';

describe('court booking tracking screens', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-23T00:00:00.000Z'));
    jest.clearAllMocks();
    mockRoute = {};
    mockCancel.mockResolvedValue(undefined);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    jest.useRealTimers();
  });

  it('separates upcoming and cancelled bookings', async () => {
    await render(<CourtBookingsScreen />);
    expect(screen.getByText('Upcoming Arena')).toBeTruthy();
    expect(screen.queryByText('Cancelled Arena')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancelled' }));
    expect(screen.getByText('Cancelled Arena')).toBeTruthy();
    expect(screen.queryByText('Upcoming Arena')).toBeNull();
  });

  it('cancels an eligible booking from booking detail', async () => {
    mockRoute = { params: { bookingId: 'booking-upcoming' } };
    await render(<CourtBookingDetailScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel Booking' }));
    const actions = alertSpy.mock.calls.find(([title]) => title === 'Cancel court booking?')?.[2];
    await actions[1].onPress();

    await waitFor(() => expect(mockCancel).toHaveBeenCalledWith({ id: 'booking-upcoming' }));
    expect(alertSpy).toHaveBeenCalledWith(
      'Booking cancelled',
      'The slot has been released for other players.'
    );
  });
});
