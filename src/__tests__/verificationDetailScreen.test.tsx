import React from 'react';
import { Alert } from 'react-native';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockRefetch = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: { matchId: 'match-1' } }),
  useFocusEffect: () => {}
}));

jest.mock('@/components/ui', () => require('@/test/mockUi'));

jest.mock('@/design/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: { accent: '#FF6B00', text: '#FFF', textMuted: '#888', surface: '#111', border: '#333', surfaceMuted: '#1A1A1A' }
  })
}));

// ── Mock hooks ──
const mockDetail: import('@/types/domain').VerificationDetail = {
  match: {
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
    evidenceUrl: 'https://example.com/evidence',
    createdAt: '2026-07-15T10:00:00Z',
    stats: [
      { definitionId: 'def-1', key: 'points', label: 'Points', unit: 'PTS', value: 28 },
      { definitionId: 'def-2', key: 'rebounds', label: 'Rebounds', unit: 'REB', value: 10 },
      { definitionId: 'def-3', key: 'assists', label: 'Assists', unit: 'AST', value: 6 }
    ]
  },
  athlete: { id: 'ath-1', username: 'jimmy', display_name: 'Jimmy Butler', avatar_url: null },
  season: { id: 'sea-1', athleteId: 'ath-1', sport: 'basketball', label: 'Summer 2026', startsOn: '2026-06-01', endsOn: '2026-09-30', createdAt: '2026-06-01T00:00:00Z' },
  stats: [
    { value: 28, definition: { id: 'def-1', stat_key: 'points', label: 'Points', unit: 'PTS', value_type: 'integer', aggregation: 'average', display_order: 10 } },
    { value: 10, definition: { id: 'def-2', stat_key: 'rebounds', label: 'Rebounds', unit: 'REB', value_type: 'integer', aggregation: 'average', display_order: 20 } },
    { value: 6, definition: { id: 'def-3', stat_key: 'assists', label: 'Assists', unit: 'AST', value_type: 'integer', aggregation: 'average', display_order: 30 } }
  ],
  auditLog: [
    { id: 'aud-1', matchId: 'match-1', verifierId: 'ver-1', previousStatus: 'self_reported', newStatus: 'verified', reason: 'Stats verified via video review', createdAt: '2026-07-16T10:00:00Z' }
  ]
};

let mockIsLoading = false;
let mockIsError = false;
let mockError: Error | null = null;
let mockDetailData: typeof mockDetail | undefined = mockDetail;

const mockVerifyMutate = jest.fn((_input, opts) => opts?.onSuccess?.());

jest.mock('@/hooks/useAthleteStats', () => ({
  useVerificationDetail: (_id: string) => ({
    data: mockDetailData,
    isLoading: mockIsLoading,
    isError: mockIsError,
    error: mockError,
    isRefetching: false,
    refetch: mockRefetch
  }),
  useVerifyAthleteMatch: () => ({
    mutate: mockVerifyMutate,
    isPending: false,
    isError: false,
    error: null
  })
}));

// eslint-disable-next-line import/first
import { VerificationDetailScreen } from '@/screens/stats/VerificationDetailScreen';

async function renderScreen() {
  return render(<VerificationDetailScreen />);
}

afterEach(() => {
  cleanup();
});

describe('VerificationDetailScreen — loading / error', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLoading = false;
    mockIsError = false;
    mockError = null;
    mockDetailData = mockDetail;
  });

  it('shows loading indicator', async () => {
    mockIsLoading = true;
    mockDetailData = undefined;
    await renderScreen();
    expect(screen.queryByText('Heat vs Lakers')).toBeNull();
  });

  it('shows error with retry and go back', async () => {
    mockIsError = true;
    mockError = new Error('Match not found.');
    mockDetailData = undefined;
    await renderScreen();
    expect(screen.getByText('Could not load match')).toBeTruthy();
    expect(screen.getByText('Match not found.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Retry'));
    expect(mockRefetch).toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Go back'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});

describe('VerificationDetailScreen — authorized verifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLoading = false;
    mockIsError = false;
    mockError = null;
    mockDetailData = mockDetail;
  });

  it('renders athlete info', async () => {
    await renderScreen();
    expect(screen.getByText('Jimmy Butler')).toBeTruthy();
    expect(screen.getByText('@jimmy')).toBeTruthy();
  });

  it('renders match details', async () => {
    await renderScreen();
    expect(screen.getByText('Heat vs Lakers')).toBeTruthy();
    expect(screen.getByText('SELF REPORTED')).toBeTruthy();
  });

  it('renders evidence link', async () => {
    await renderScreen();
    expect(screen.getByText('View evidence')).toBeTruthy();
  });

  it('renders stat values', async () => {
    await renderScreen();
    expect(screen.getByText('28')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
  });

  it('renders audit history', async () => {
    await renderScreen();
    expect(screen.getByText('VERIFIED')).toBeTruthy();
  });

  it('shows Verify and Reject buttons for self_reported match', async () => {
    await renderScreen();
    expect(screen.getByText('Verify')).toBeTruthy();
    expect(screen.getByText('Reject')).toBeTruthy();
  });

  it('does not show decision controls for already-verified match', async () => {
    mockDetailData = { ...mockDetail, match: { ...mockDetail.match, verificationStatus: 'verified' } };
    await renderScreen();
    expect(screen.queryByText('Verify')).toBeNull();
    expect(screen.queryByText('Reject')).toBeNull();
  });

  it('does not show decision controls for rejected match', async () => {
    mockDetailData = { ...mockDetail, match: { ...mockDetail.match, verificationStatus: 'rejected' } };
    await renderScreen();
    expect(screen.queryByText('Verify')).toBeNull();
  });

  it('allows entering a reason', async () => {
    await renderScreen();
    const input = screen.getByPlaceholderText('Optional reason...');
    await fireEvent.changeText(input, 'Stats confirmed via game footage');
    expect(screen.getByPlaceholderText('Optional reason...').props.value).toBe('Stats confirmed via game footage');
  });

  it('shows confirm button after selecting Verify', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Verify'));
    expect(screen.getByText('Selected: Verify')).toBeTruthy();
    expect(screen.getByText('Confirm Verify')).toBeTruthy();
  });

  it('shows confirm button after selecting Reject', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Reject'));
    expect(screen.getByText('Selected: Reject')).toBeTruthy();
    expect(screen.getByText('Confirm Reject')).toBeTruthy();
  });

  it('calls verify mutation on confirm and alerts on success', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const btn = buttons?.find((b: any) => b.text === 'Confirm Verify' || b.text === 'OK');
      btn?.onPress?.();
    });
    await renderScreen();
    await fireEvent.press(screen.getByText('Verify'));
    await fireEvent.press(screen.getByText('Confirm Verify'));
    await waitFor(() => {
      expect(mockVerifyMutate).toHaveBeenCalled();
    });
  });

  it('calls verify mutation with reason', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const btn = buttons?.find((b: any) => b.text === 'Confirm Verify' || b.text === 'OK');
      btn?.onPress?.();
    });
    await renderScreen();
    const input = screen.getByPlaceholderText('Optional reason...');
    await fireEvent.changeText(input, 'Good game footage');
    await fireEvent.press(screen.getByText('Verify'));
    await fireEvent.press(screen.getByText('Confirm Verify'));
    await waitFor(() => {
      expect(mockVerifyMutate).toHaveBeenCalledWith(
        expect.objectContaining({ matchId: 'match-1', status: 'verified', reason: 'Good game footage' }),
        expect.any(Object)
      );
    });
  });
});

describe('VerificationDetailScreen — unauthorized user', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLoading = false;
    mockIsError = false;
    mockError = null;
    mockDetailData = mockDetail;
  });

  it('shows error when RPC rejects unauthorized user', async () => {
    mockIsError = true;
    mockError = new Error('Only verifiers can view verification details.');
    mockDetailData = undefined;
    await renderScreen();
    expect(screen.getByText('Could not load match')).toBeTruthy();
    expect(screen.getByText('Only verifiers can view verification details.')).toBeTruthy();
  });
});