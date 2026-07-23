import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockNavigation = {
  goBack: jest.fn(),
  replace: jest.fn()
};
const mockRoute = { params: { courtId: 'court-1' } };
const mockBookCourt = jest.fn();
const mockRefetchCourt = jest.fn();
const mockRefetchAvailability = jest.fn();

const court = {
  id: 'court-1',
  name: 'Indiranagar Arena',
  sport: 'Basketball',
  city: 'Bengaluru',
  address: '100 Feet Road',
  latitude: 12.9,
  longitude: 77.6,
  distanceKm: 1.2,
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

const slots = [{
  startsAt: '2026-07-14T12:30:00.000Z',
  endsAt: '2026-07-14T13:30:00.000Z',
  slotDurationMinutes: 60,
  price: 900,
  currency: 'INR'
}];

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute
}));
jest.mock('@/hooks/useCourts', () => ({
  useCourt: () => ({
    data: court,
    isLoading: false,
    isError: false,
    isRefetching: false,
    refetch: mockRefetchCourt
  }),
  useCourtAvailability: () => ({
    data: slots,
    isLoading: false,
    isError: false,
    isRefetching: false,
    refetch: mockRefetchAvailability
  }),
  useBookCourt: () => ({
    mutateAsync: (...args: unknown[]) => mockBookCourt(...args),
    isPending: false
  })
}));

// eslint-disable-next-line import/first
import { CourtBookingScreen } from '@/screens/courts/CourtBookingScreen';

describe('CourtBookingScreen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-14T04:30:00.000Z'));
    jest.clearAllMocks();
    mockBookCourt.mockResolvedValue({ bookingId: 'booking-1', status: 'pending' });
    mockRefetchCourt.mockResolvedValue(undefined);
    mockRefetchAvailability.mockResolvedValue(undefined);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    jest.useRealTimers();
  });

  it('renders only server-returned slots and submits the exact selected interval', async () => {
    await render(<CourtBookingScreen />);

    expect(screen.getByText('Indiranagar Arena')).toBeTruthy();
    expect(screen.getByText(/Payment is handled directly by the venue/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '7:00 PM' })).toBeNull();

    await waitFor(() => expect(screen.getByRole('button', { name: /6:00\s*pm/i })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /6:00\s*pm/i }));
    await fireEvent.press(screen.getByRole('button', { name: 'Request Booking' }));

    await waitFor(() => expect(mockBookCourt).toHaveBeenCalledWith({
      startsAt: slots[0].startsAt,
      endsAt: slots[0].endsAt
    }));

    const actions = alertSpy.mock.calls.find(([title]) => title === 'Booking requested')?.[2];
    actions[0].onPress();
    expect(mockNavigation.replace).toHaveBeenCalledWith('CourtBookingDetail', {
      bookingId: 'booking-1'
    });
  });
});
