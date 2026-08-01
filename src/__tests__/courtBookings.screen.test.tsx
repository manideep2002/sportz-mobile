import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn()
};
let mockRoute: { params?: { bookingId?: string; admin?: boolean } } = {};
const mockCancel = jest.fn();
const mockUpdateStatus = jest.fn();

/* ── fixtures ── */
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

const playerProfile = {
  id: 'player-id',
  displayName: 'Player One',
  initials: 'PO',
  avatarUrl: null
};

const buildBooking = (overrides: Partial<typeof mockUpcomingBooking> = {}) => ({
  id: 'booking-upcoming',
  court: { ...court, name: 'Upcoming Arena' },
  user: playerProfile,
  startsAt: '2026-07-26T12:30:00.000Z',
  endsAt: '2026-07-26T13:30:00.000Z',
  status: 'confirmed' as const,
  price: 900,
  currency: 'INR',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  cancellationDeadline: '2026-07-26T06:30:00.000Z',
  capabilities: {
    isOwnBooking: true,
    canCancel: true,
    canConfirm: false,
    canViewPlayer: false
  },
  ...overrides
});

const mockUpcomingBooking = buildBooking();

const mockCancelledBooking = buildBooking({
  id: 'booking-cancelled',
  court: { ...court, name: 'Cancelled Arena' },
  status: 'cancelled',
  cancelledAt: '2026-07-21T00:00:00.000Z',
  capabilities: { isOwnBooking: true, canCancel: false, canConfirm: false, canViewPlayer: false }
});

const mockPendingBooking = buildBooking({
  id: 'booking-pending',
  status: 'pending',
  court: { ...court, name: 'Pending Arena' },
  capabilities: { isOwnBooking: false, canCancel: true, canConfirm: true, canViewPlayer: true }
});

const mockMyQuery = {
  data: [mockUpcomingBooking, mockCancelledBooking],
  isLoading: false,
  isError: false,
  isRefetching: false,
  error: null,
  refetch: jest.fn()
};

let mockBookingDetail = mockUpcomingBooking;
let mockIsAdmin = false;

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { profile: { isAdmin: boolean } }) => unknown) =>
    selector({ profile: { isAdmin: mockIsAdmin } })
}));
jest.mock('@/hooks/useCourts', () => ({
  useMyCourtBookings: () => mockMyQuery,
  useAdminCourtBookings: () => ({ ...mockMyQuery, data: [mockPendingBooking] }),
  useUpdateCourtBookingStatus: () => ({ mutateAsync: (...args: unknown[]) => mockUpdateStatus(...args), isPending: false }),
  useCourtBooking: () => ({
    data: mockBookingDetail,
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
    mockIsAdmin = false;
    mockBookingDetail = mockUpcomingBooking;
    mockCancel.mockResolvedValue(undefined);
    mockUpdateStatus.mockResolvedValue(undefined);
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

/* ───────────────────────────────────────── */
/*   Player — capability-driven actions      */
/* ───────────────────────────────────────── */
describe('player capability tests', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-23T00:00:00.000Z'));
    jest.clearAllMocks();
    mockIsAdmin = false;
    mockCancel.mockResolvedValue(undefined);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => { alertSpy.mockRestore(); jest.useRealTimers(); });

  it('shows Cancel Booking when canCancel=true (within deadline)', async () => {
    mockBookingDetail = buildBooking({
      capabilities: { isOwnBooking: true, canCancel: true, canConfirm: false, canViewPlayer: false }
    });
    mockRoute = { params: { bookingId: 'booking-upcoming' } };
    await render(<CourtBookingDetailScreen />);
    expect(screen.getByRole('button', { name: 'Cancel Booking' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirm Booking' })).toBeNull();
  });

  it('shows disabled Cancel Booking when canCancel=false and isOwnBooking=true (past deadline)', async () => {
    mockBookingDetail = buildBooking({
      capabilities: { isOwnBooking: true, canCancel: false, canConfirm: false, canViewPlayer: false }
    });
    mockRoute = { params: { bookingId: 'booking-upcoming' } };
    await render(<CourtBookingDetailScreen />);

    // Disabled cancel button should exist but pressing it must not call any mutation
    const btn = screen.getByRole('button', { name: 'Cancel Booking' });
    expect(btn).toBeTruthy();
    await fireEvent.press(btn);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('shows no action buttons for an unrelated user', async () => {
    mockBookingDetail = buildBooking({
      capabilities: { isOwnBooking: false, canCancel: false, canConfirm: false, canViewPlayer: false }
    });
    mockRoute = { params: { bookingId: 'booking-upcoming' } };
    await render(<CourtBookingDetailScreen />);

    expect(screen.queryByRole('button', { name: 'Cancel Booking' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirm Booking' })).toBeNull();
  });

  it('shows no action buttons for a cancelled booking (any actor)', async () => {
    mockBookingDetail = buildBooking({
      status: 'cancelled',
      capabilities: { isOwnBooking: true, canCancel: false, canConfirm: false, canViewPlayer: false }
    });
    mockRoute = { params: { bookingId: 'booking-cancelled' } };
    await render(<CourtBookingDetailScreen />);

    expect(screen.queryByRole('button', { name: 'Cancel Booking' })).toBeNull();
  });
});

/* ───────────────────────────────────────── */
/*   Administrator capability tests          */
/* ───────────────────────────────────────── */
describe('administrator capability tests', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-23T00:00:00.000Z'));
    jest.clearAllMocks();
    mockIsAdmin = true;
    mockCancel.mockResolvedValue(undefined);
    mockUpdateStatus.mockResolvedValue(undefined);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => { alertSpy.mockRestore(); jest.useRealTimers(); });

  it('list — shows Confirm button for a pending booking with canConfirm=true', async () => {
    mockRoute = { params: { admin: true } };
    await render(<CourtBookingsScreen />);
    expect(screen.getByRole('button', { name: 'Confirm Booking' })).toBeTruthy();
  });

  it('list — shows Cancel button that navigates to detail (not inline mutation)', async () => {
    mockRoute = { params: { admin: true } };
    await render(<CourtBookingsScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel Booking' }));
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(mockNavigation.navigate).toHaveBeenCalledWith('CourtBookingDetail', expect.objectContaining({ bookingId: 'booking-pending' }));
  });

  it('list — Confirm calls updateStatus with confirmed status', async () => {
    mockRoute = { params: { admin: true } };
    await render(<CourtBookingsScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Confirm Booking' }));
    await waitFor(() => expect(mockUpdateStatus).toHaveBeenCalledWith(expect.objectContaining({ bookingId: 'booking-pending', status: 'confirmed' })));
  });

  it('detail — shows Confirm + Cancel Booking + player profile link', async () => {
    mockBookingDetail = buildBooking({
      status: 'pending',
      capabilities: { isOwnBooking: false, canCancel: true, canConfirm: true, canViewPlayer: true }
    });
    mockRoute = { params: { bookingId: 'booking-pending', admin: true } };
    await render(<CourtBookingDetailScreen />);

    expect(screen.getByRole('button', { name: 'Confirm Booking' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel Booking' })).toBeTruthy();
    expect(screen.getByRole('button', { name: `View ${playerProfile.displayName}'s profile` })).toBeTruthy();
  });

  it('detail — admin cancel shows reason input then submits', async () => {
    mockBookingDetail = buildBooking({
      status: 'pending',
      capabilities: { isOwnBooking: false, canCancel: true, canConfirm: true, canViewPlayer: true }
    });
    mockRoute = { params: { bookingId: 'booking-pending', admin: true } };
    await render(<CourtBookingDetailScreen />);

    // Tap Cancel Booking to reveal reason input
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel Booking' }));
    const reasonInput = screen.getByLabelText('Cancellation reason');
    expect(reasonInput).toBeTruthy();

    await fireEvent.changeText(reasonInput, 'Court maintenance');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm Admin Cancel' }));

    await waitFor(() =>
      expect(mockCancel).toHaveBeenCalledWith({ id: mockBookingDetail.id, reason: 'Court maintenance' })
    );
  });

  it('detail — admin cancel without reason submits with no reason', async () => {
    mockBookingDetail = buildBooking({
      status: 'pending',
      capabilities: { isOwnBooking: false, canCancel: true, canConfirm: true, canViewPlayer: true }
    });
    mockRoute = { params: { bookingId: 'booking-pending', admin: true } };
    await render(<CourtBookingDetailScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel Booking' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm Admin Cancel' }));

    await waitFor(() =>
      expect(mockCancel).toHaveBeenCalledWith({ id: mockBookingDetail.id, reason: undefined })
    );
  });

  it('list — surfaces slot conflict error distinctly', async () => {
    mockUpdateStatus.mockRejectedValue(new Error('exclusion_violation: overlapping slot'));
    mockRoute = { params: { admin: true } };
    await render(<CourtBookingsScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Confirm Booking' }));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Slot conflict', expect.stringContaining('booked by someone else'))
    );
  });

  it('detail — confirms a booking and shows success alert', async () => {
    mockBookingDetail = buildBooking({
      id: 'booking-pending',
      status: 'pending',
      capabilities: { isOwnBooking: false, canCancel: true, canConfirm: true, canViewPlayer: true }
    });
    mockRoute = { params: { bookingId: 'booking-pending', admin: true } };
    await render(<CourtBookingDetailScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Confirm Booking' }));
    const actions = alertSpy.mock.calls.find(([title]) => title === 'Confirm this booking?')?.[2];
    await actions[1].onPress();

    await waitFor(() =>
      expect(mockUpdateStatus).toHaveBeenCalledWith(expect.objectContaining({ bookingId: 'booking-pending', status: 'confirmed' }))
    );
    expect(alertSpy).toHaveBeenCalledWith('Booking confirmed', 'The player has been notified.');
  });

  it('detail — cancelled booking shows audit trail (cancelledAt)', async () => {
    mockBookingDetail = buildBooking({
      status: 'cancelled',
      cancelledAt: '2026-07-21T10:00:00.000Z',
      cancellationReason: 'Maintenance',
      capabilities: { isOwnBooking: false, canCancel: false, canConfirm: false, canViewPlayer: true }
    });
    mockRoute = { params: { bookingId: 'booking-cancelled', admin: true } };
    await render(<CourtBookingDetailScreen />);

    expect(screen.getByText('Maintenance', { exact: false })).toBeTruthy();
  });
});
