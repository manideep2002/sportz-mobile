/**
 * Tests for the multi-court discovery strip (CourtMapPreview).
 *
 * The component renders a horizontally scrollable set of accessible pin cards,
 * one per court with valid (non-zero) coordinates. It also handles loading,
 * empty, and permission-denied states, and opens the selected court in the
 * platform Maps application.
 *
 * All render() calls are awaited because RNTL 14's render() is async.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';

import { CourtMapPreview } from '@/components/courts/CourtMapPreview';
import type { Court } from '@/types/domain';

jest.mock('@/design/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      accent: '#FF5A1F',
      accentSoft: 'rgba(255,90,31,0.15)',
      accentBorder: 'rgba(255,90,31,0.35)',
      onAccent: '#FFFFFF',
      background: '#0A0907',
      surface: '#1E1A17',
      surfaceElevated: '#141210',
      surfaceMuted: '#2A2420',
      border: '#2A2420',
      text: '#F0EBE4',
      textSubtle: '#5C5650',
      textMuted: '#5C5650'
    }
  })
}));

jest.mock('@/components/ui', () => require('@/test/mockUi'));

// ── fixtures ─────────────────────────────────────────────────────────────────

const makeCourt = (overrides: Partial<Court> = {}): Court => ({
  id: 'court-1',
  name: 'Indiranagar Arena',
  sport: 'Basketball',
  city: 'Bengaluru',
  address: '100 Feet Road',
  latitude: 12.9,
  longitude: 77.6,
  distanceKm: 2.3,
  surface: 'Hardwood',
  rating: 4.5,
  hourlyPrice: 500,
  currency: 'INR',
  openNow: true,
  futureBookable: true,
  availabilityLabel: 'Open now',
  timezone: 'Asia/Kolkata',
  slotDurationMinutes: 60,
  bookingWindowDays: 30,
  cancellationNoticeHours: 6,
  bookingRequiresApproval: false,
  paymentPolicy: 'external',
  ...overrides
});

const courtA = makeCourt({ id: 'court-a', name: 'Indiranagar Arena', latitude: 12.9, longitude: 77.6 });
const courtB = makeCourt({ id: 'court-b', name: 'Koramangala Courts', latitude: 12.93, longitude: 77.62 });
const courtZero = makeCourt({ id: 'court-z', name: 'Zero Coords', latitude: 0, longitude: 0 });
const courtNaN = makeCourt({ id: 'court-nan', name: 'Bad Coords', latitude: NaN, longitude: NaN });

// ── suite ─────────────────────────────────────────────────────────────────────

describe('CourtMapPreview — multi-court discovery strip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── rendering ───────────────────────────────────────────────────────────────

  it('renders a pin card for each court with valid, non-zero coordinates', async () => {
    await render(
      <CourtMapPreview courts={[courtA, courtB, courtZero, courtNaN]} />
    );

    expect(screen.getByRole('radio', { name: 'Indiranagar Arena' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Koramangala Courts' })).toBeTruthy();

    // Courts with (0, 0) or NaN coords must not appear as selectable pins.
    expect(screen.queryByRole('radio', { name: 'Zero Coords' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Bad Coords' })).toBeNull();
  });

  it('announces the number of mappable courts in the container label', async () => {
    await render(<CourtMapPreview courts={[courtA, courtB]} />);
    expect(screen.getByLabelText('Court locations')).toBeTruthy();
    expect(screen.getByText('2 courts on the map')).toBeTruthy();
  });

  it('uses singular wording when exactly one court is mappable', async () => {
    await render(<CourtMapPreview courts={[courtA, courtZero]} />);
    expect(screen.getByText('1 court on the map')).toBeTruthy();
  });

  // ── accessible pin selection ────────────────────────────────────────────────

  it('marks the first mappable court as selected by default', async () => {
    await render(<CourtMapPreview courts={[courtA, courtB]} />);
    const pinA = screen.getByRole('radio', { name: 'Indiranagar Arena' });
    expect(pinA.props.accessibilityState?.checked).toBe(true);

    const pinB = screen.getByRole('radio', { name: 'Koramangala Courts' });
    expect(pinB.props.accessibilityState?.checked).toBe(false);
  });

  it('marks the explicitly provided selectedId as selected', async () => {
    await render(<CourtMapPreview courts={[courtA, courtB]} selectedId="court-b" />);
    const pinA = screen.getByRole('radio', { name: 'Indiranagar Arena' });
    const pinB = screen.getByRole('radio', { name: 'Koramangala Courts' });

    expect(pinA.props.accessibilityState?.checked).toBe(false);
    expect(pinB.props.accessibilityState?.checked).toBe(true);
  });

  it('calls onSelect with the court id when a pin card is pressed', async () => {
    const onSelect = jest.fn();
    await render(<CourtMapPreview courts={[courtA, courtB]} selectedId="court-a" onSelect={onSelect} />);

    fireEvent.press(screen.getByRole('radio', { name: 'Koramangala Courts' }));
    expect(onSelect).toHaveBeenCalledWith('court-b');
  });

  // ── Open in Maps ────────────────────────────────────────────────────────────

  it('opens the selected court in the platform Maps application', async () => {
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<CourtMapPreview courts={[courtA, courtB]} selectedId="court-a" />);

    fireEvent.press(screen.getByRole('button', { name: 'Open Indiranagar Arena in Maps' }));

    await waitFor(() => expect(openUrl).toHaveBeenCalledTimes(1));
    expect(openUrl.mock.calls[0][0]).toBe(
      Platform.OS === 'ios'
        ? 'https://maps.apple.com/?q=Indiranagar%20Arena%2C%20Bengaluru&ll=12.9,77.6'
        : Platform.OS === 'android'
          ? 'geo:12.9,77.6?q=Indiranagar%20Arena%2C%20Bengaluru'
          : 'https://www.google.com/maps/search/?api=1&query=Indiranagar%20Arena%2C%20Bengaluru%20(12.9%2C77.6)'
    );
  });

  it('falls back to Google Maps when the native URL cannot be opened', async () => {
    const openUrl = jest.spyOn(Linking, 'openURL')
      .mockRejectedValueOnce(new Error('Native maps unavailable'))
      .mockResolvedValueOnce(true);
    await render(<CourtMapPreview courts={[courtA]} selectedId="court-a" />);

    fireEvent.press(screen.getByRole('button', { name: 'Open Indiranagar Arena in Maps' }));

    await waitFor(() =>
      expect(openUrl).toHaveBeenCalledWith(
        'https://www.google.com/maps/search/?api=1&query=12.9%2C77.6'
      )
    );
  });

  // ── loading state ────────────────────────────────────────────────────────────

  it('renders a loading indicator when isLoading is true', async () => {
    await render(<CourtMapPreview courts={[]} isLoading />);
    expect(screen.getByLabelText('Loading court locations')).toBeTruthy();
    // No pin cards while loading.
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  // ── empty / no-valid-coords states ─────────────────────────────────────────

  it('renders an empty-filter message when the courts array is empty', async () => {
    await render(<CourtMapPreview courts={[]} />);
    expect(screen.getByLabelText('No courts match these filters.')).toBeTruthy();
  });

  it('renders a no-map-locations message when all courts have (0,0) coordinates', async () => {
    await render(<CourtMapPreview courts={[courtZero, courtNaN]} />);
    expect(screen.getByLabelText('No courts with map locations in this area.')).toBeTruthy();
  });

  // ── permission-denied state ─────────────────────────────────────────────────

  it('shows the permission-denied banner when locationStatus is denied', async () => {
    await render(
      <CourtMapPreview courts={[courtA]} locationStatus="denied" />
    );
    expect(
      screen.getByText('Location permission unavailable — distances may not reflect your position.')
    ).toBeTruthy();
  });

  it('shows the permission-denied banner when locationStatus is unavailable', async () => {
    await render(
      <CourtMapPreview courts={[courtA]} locationStatus="unavailable" />
    );
    expect(
      screen.getByText('Location permission unavailable — distances may not reflect your position.')
    ).toBeTruthy();
  });

  it('does not show the permission-denied banner when locationStatus is granted', async () => {
    await render(
      <CourtMapPreview courts={[courtA]} locationStatus="granted" />
    );
    expect(
      screen.queryByText('Location permission unavailable — distances may not reflect your position.')
    ).toBeNull();
  });

  it('shows the permission-denied banner in empty state when locationStatus is denied', async () => {
    await render(<CourtMapPreview courts={[]} locationStatus="denied" />);
    expect(
      screen.getByText('Location permission unavailable — distances may not reflect your position.')
    ).toBeTruthy();
    // Empty message still shown alongside the banner.
    expect(screen.getByLabelText('No courts match these filters.')).toBeTruthy();
  });

  // ── distance label ───────────────────────────────────────────────────────────

  it('displays the distance when distanceKm is available', async () => {
    await render(<CourtMapPreview courts={[courtA]} />);
    expect(screen.getByText('2.3 km')).toBeTruthy();
  });

  it('omits the distance label when distanceKm is null', async () => {
    await render(<CourtMapPreview courts={[makeCourt({ distanceKm: null })]} />);
    // No distance text should appear inside the pin card.
    expect(screen.queryByText(/ km$/)).toBeNull();
  });
});
