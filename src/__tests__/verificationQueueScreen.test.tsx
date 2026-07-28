import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockRefetch = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: {} }),
  useFocusEffect: (cb: () => void) => { cb(); return () => {}; }
}));

jest.mock('@/components/ui', () => require('@/test/mockUi'));

jest.mock('@/design/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: { accent: '#FF6B00', text: '#FFF', textMuted: '#888', surface: '#111', border: '#333', surfaceMuted: '#1A1A1A' }
  })
}));

// ── Mock the hooks directly (Pattern C) ──
const mockData: import('@/types/domain').VerificationQueueItem[] = [
  {
    id: 'match-1',
    athleteId: 'ath-1',
    seasonId: 'sea-1',
    sport: 'basketball',
    playedOn: '2026-07-15',
    teamName: 'Heat',
    opponentName: 'Lakers',
    teamScore: 98,
    opponentScore: 87,
    outcome: 'win',
    verificationStatus: 'self_reported',
    createdAt: '2026-07-15T10:00:00Z',
    athlete: { id: 'ath-1', username: 'jimmy', display_name: 'Jimmy Butler', avatar_url: null },
    season: { id: 'sea-1', label: 'Summer 2026' }
  },
  {
    id: 'match-2',
    athleteId: 'ath-2',
    seasonId: 'sea-1',
    sport: 'football',
    playedOn: '2026-07-14',
    teamName: 'United',
    opponentName: 'City',
    teamScore: 3,
    opponentScore: 1,
    outcome: 'win',
    verificationStatus: 'pending',
    createdAt: '2026-07-14T15:00:00Z',
    athlete: { id: 'ath-2', username: 'messi', display_name: 'Lionel Messi', avatar_url: null },
    season: { id: 'sea-1', label: 'Season 2026' }
  }
];

let mockIsLoading = false;
let mockIsError = false;
let mockError: Error | null = null;
let mockQueueData: typeof mockData | undefined = mockData;

jest.mock('@/hooks/useAthleteStats', () => ({
  usePendingVerifications: () => ({
    data: mockQueueData,
    isLoading: mockIsLoading,
    isError: mockIsError,
    error: mockError,
    isRefetching: false,
    refetch: mockRefetch
  })
}));

// eslint-disable-next-line import/first
import { VerificationQueueScreen } from '@/screens/stats/VerificationQueueScreen';

async function renderScreen() {
  return render(<VerificationQueueScreen />);
}

describe('VerificationQueueScreen — authorized user', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLoading = false;
    mockIsError = false;
    mockError = null;
    mockQueueData = mockData;
  });

  it('shows loading indicator while fetching', async () => {
    mockIsLoading = true;
    mockQueueData = undefined;
    await renderScreen();
    // Content not rendered while loading
    expect(screen.queryByText('All caught up')).toBeNull();
  });

  it('shows error with retry', async () => {
    mockIsError = true;
    mockError = new Error('Not authorized');
    mockQueueData = undefined;
    await renderScreen();
    expect(screen.getByText('Could not load queue')).toBeTruthy();
    expect(screen.getByText('Not authorized')).toBeTruthy();
    fireEvent.press(screen.getByText('Retry'));
    await waitFor(() => expect(mockRefetch).toHaveBeenCalled());
  });

  it('shows empty state when no pending matches', async () => {
    mockQueueData = [];
    await renderScreen();
    expect(screen.getByText('All caught up')).toBeTruthy();
    expect(screen.getByText('No pending match verifications.')).toBeTruthy();
  });

  it('renders list of pending verifications', async () => {
    await renderScreen();
    expect(screen.getByText('Heat vs Lakers')).toBeTruthy();
    expect(screen.getByText('United vs City')).toBeTruthy();
    expect(screen.getByText('@jimmy')).toBeTruthy();
    expect(screen.getByText('@messi')).toBeTruthy();
  });

  it('navigates to verification detail on press', async () => {
    await renderScreen();
    fireEvent.press(screen.getByLabelText('Verify match: Heat vs Lakers'));
    expect(mockNavigate).toHaveBeenCalledWith('VerificationDetail', { matchId: 'match-1' });
  });

  it('shows correct status badges', async () => {
    await renderScreen();
    expect(screen.getByText('SELF REPORTED')).toBeTruthy();
    expect(screen.getByText('PENDING')).toBeTruthy();
  });
});

describe('VerificationQueueScreen — unauthorized user', () => {
  it('shows error when RPC rejects unauthorized user', async () => {
    mockIsError = true;
    mockError = new Error('Only verifiers can list pending verifications.');
    mockQueueData = undefined;
    await renderScreen();
    expect(screen.getByText('Could not load queue')).toBeTruthy();
    expect(screen.getByText('Only verifiers can list pending verifications.')).toBeTruthy();
  });
});