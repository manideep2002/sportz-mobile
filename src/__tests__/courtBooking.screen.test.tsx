import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockNavigation = {
  goBack: jest.fn()
};
const mockRoute = { params: { courtId: 'court-1' } };
const mockBookCourt = jest.fn();
const mockRefetch = jest.fn();

const court = {
  id: 'court-1',
  name: 'Indiranagar Arena',
  sport: 'Basketball',
  city: 'Bengaluru',
  latitude: 12.9,
  longitude: 77.6,
  distanceKm: 1.2,
  surface: 'Hardwood',
  rating: 4.8,
  hourlyPrice: 900,
  currency: 'INR',
  availableNow: true,
  availabilityLabel: 'Available'
};

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
    refetch: mockRefetch
  })
}));
jest.mock('@/services/courtService', () => ({
  courtService: { bookCourt: (...args: unknown[]) => mockBookCourt(...args) }
}));

// eslint-disable-next-line import/first
import { CourtBookingScreen } from '@/screens/courts/CourtBookingScreen';

describe('CourtBookingScreen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-14T04:30:00.000Z'));
    jest.clearAllMocks();
    mockBookCourt.mockResolvedValue(undefined);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    jest.useRealTimers();
  });

  it('submits the selected slot and returns after confirmation', async () => {
    await render(<CourtBookingScreen />);

    expect(screen.getByText('Indiranagar Arena')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '2 hr' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Request Booking' }));

    await waitFor(() => expect(mockBookCourt).toHaveBeenCalledTimes(1));
    const [, startsAt, endsAt] = mockBookCourt.mock.calls[0];
    expect(new Date(startsAt).getHours()).toBe(18);
    expect(new Date(endsAt).getTime() - new Date(startsAt).getTime()).toBe(2 * 60 * 60 * 1000);

    const actions = alertSpy.mock.calls.find(([title]) => title === 'Booking requested')?.[2];
    actions[0].onPress();
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });
});





