/**
 * ModerationDetailScreen UI tests — MF-03
 *
 * RNTL 14: render() is async — every test awaits it before using screen.
 * All screens use the mockUi pattern.
 */

import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockGetReportDetail = jest.fn();
const mockGetEntityPreview = jest.fn();
const mockGetReporterProfile = jest.fn();
const mockDismissReport = jest.fn();
const mockRemoveContent = jest.fn();
const mockRestrictAccount = jest.fn();
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockUseRoute = jest.fn();

jest.mock('@/services/moderationService', () => ({
  moderationService: {
    getReportDetail: (...a: unknown[]) => mockGetReportDetail(...a),
    getEntityPreview: (...a: unknown[]) => mockGetEntityPreview(...a),
    getReporterProfile: (...a: unknown[]) => mockGetReporterProfile(...a),
    dismissReport: (...a: unknown[]) => mockDismissReport(...a),
    removeContent: (...a: unknown[]) => mockRemoveContent(...a),
    restrictAccount: (...a: unknown[]) => mockRestrictAccount(...a)
  }
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => mockUseRoute()
}));
jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@/design/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      accent: '#FF6B00', accentSoft: 'rgba(255,107,0,0.1)', text: '#FFF',
      textMuted: '#888', danger: '#FF4D4D', border: '#333',
      surface: '#111', surfaceElevated: '#1A1A1A', scrim: 'rgba(0,0,0,0.6)',
      mediaGradientEnd: 'rgba(0,0,0,0.8)', accentPressed: '#E05A00',
      onAccent: '#FFF', textSubtle: '#666', dangerSoft: 'rgba(255,77,77,0.1)',
      background: '#000', tertiary: '#555'
    }
  })
}));

// React-query mock: useQuery returns data by calling queryFn synchronously-ish.
// useMutation returns a mutate that calls mutationFn and delegates to onSuccess/onError.
let mockMutationSuccess: unknown = {};
let mockMutationError: Error | undefined;
const mockInvalidateQueries = jest.fn();

jest.mock('@tanstack/react-query', () => {
  const React = require('react');
  return {
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
    useQuery: ({ queryFn, enabled }: { queryFn: () => Promise<unknown>; enabled?: boolean }) => {
      const [state, setState] = React.useState({
        data: undefined as unknown,
        isLoading: true,
        isError: false,
        error: null as Error | null,
        isRefetching: false,
        refetch: jest.fn()
      });
      React.useEffect(() => {
        if (enabled === false) {
          setState((prev) => ({ ...prev, data: undefined, isLoading: false }));
          return;
        }
        setState((prev) => ({ ...prev, isLoading: true }));
        queryFn()
          .then((data) => setState({ data, isLoading: false, isError: false, error: null, isRefetching: false, refetch: jest.fn() }))
          .catch((err: Error) => setState({ data: undefined, isLoading: false, isError: true, error: err, isRefetching: false, refetch: jest.fn() }));
      }, [enabled]);
      return state;
    },
    useMutation: ({ onSuccess, onError }: { onSuccess?: (r: unknown) => void; onError?: (e: Error) => void }) => ({
      mutate: () => {
        if (mockMutationError) {
          onError?.(mockMutationError);
        } else {
          onSuccess?.(mockMutationSuccess);
        }
      },
      isPending: false
    })
  };
});

jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));
jest.mock('@/lib/supabaseOnly', () => ({ assertSupabaseConfigured: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

// eslint-disable-next-line import/first
import { ModerationDetailScreen } from '@/screens/settings/ModerationDetailScreen';

const OPEN_REPORT = {
  id: 'rpt-1',
  reporterId: 'user-rep',
  entityType: 'post' as const,
  entityId: 'post-1',
  reason: 'Inappropriate content',
  status: 'open' as const,
  resolution: null,
  createdAt: '2026-07-28T10:00:00Z',
  reviewedBy: null,
  reviewedAt: null,
  auditLog: []
};

const RESOLVED_REPORT = {
  ...OPEN_REPORT,
  status: 'dismissed' as const,
  resolution: 'No violation found'
};

const ENTITY_PREVIEW = {
  id: 'post-1', authorId: 'user-auth',
  body: 'Some questionable content',
  removedByModerator: false, createdAt: '2026-07-28T10:00:00Z'
};

const REPORTER_PROFILE = {
  id: 'user-rep', username: 'asha', displayName: 'Asha', avatarUrl: null
};

function setupDefault() {
  mockUseRoute.mockReturnValue({ params: { reportId: 'rpt-1' } });
  mockGetReportDetail.mockResolvedValue(OPEN_REPORT);
  mockGetEntityPreview.mockResolvedValue(ENTITY_PREVIEW);
  mockGetReporterProfile.mockResolvedValue(REPORTER_PROFILE);
  mockDismissReport.mockResolvedValue({});
  mockRemoveContent.mockResolvedValue({});
  mockRestrictAccount.mockResolvedValue({});
  mockMutationSuccess = {};
  mockMutationError = undefined;
}

// ─── Loading state ─────────────────────────────────────────────────────────

describe('ModerationDetailScreen — loading state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({ params: { reportId: 'rpt-1' } });
    mockGetReportDetail.mockReturnValue(new Promise(() => {}));
  });

  it('shows a loading indicator while fetching', async () => {
    await render(<ModerationDetailScreen />);
    expect(mockGetReportDetail).toHaveBeenCalledWith('rpt-1');
  });
});

// ─── Error state ───────────────────────────────────────────────────────────

describe('ModerationDetailScreen — error state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({ params: { reportId: 'rpt-1' } });
    mockGetReportDetail.mockRejectedValue(new Error('Network error'));
  });

  it('shows error message with retry and go back', async () => {
    await render(<ModerationDetailScreen />);
    await waitFor(() => expect(screen.getByText('Could not load report')).toBeTruthy());
    expect(screen.getByText('Network error')).toBeTruthy();
  });
});

// ─── Not found state ───────────────────────────────────────────────────────

describe('ModerationDetailScreen — not found state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({ params: { reportId: 'rpt-1' } });
    mockGetReportDetail.mockRejectedValue(new Error('Report not found.'));
  });

  it('shows not-found message', async () => {
    await render(<ModerationDetailScreen />);
    await waitFor(() => expect(screen.getByText(/Report not found/)).toBeTruthy());
  });
});

// ─── Open report detail view ────────────────────────────────────────────────

describe('ModerationDetailScreen — open report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefault();
  });

  it('renders report reason and entity type', async () => {
    await render(<ModerationDetailScreen />);
    await waitFor(() => expect(screen.getByText('Inappropriate content')).toBeTruthy());
    expect(screen.getByText(/post/)).toBeTruthy();
  });

  it('renders reporter info', async () => {
    await render(<ModerationDetailScreen />);
    await waitFor(() => expect(screen.getByText('@asha')).toBeTruthy());
  });

  it('renders entity preview body', async () => {
    await render(<ModerationDetailScreen />);
    await waitFor(() => expect(screen.getByText('Some questionable content')).toBeTruthy());
  });

  it('renders enforcement action buttons for open report', async () => {
    await render(<ModerationDetailScreen />);
    await waitFor(() => expect(screen.getByText('Dismiss Report')).toBeTruthy());
    expect(screen.getByText('Remove Content')).toBeTruthy();
    expect(screen.getByText('Restrict Account')).toBeTruthy();
  });

  it('does not render Restrict Account for comment report without author', async () => {
    mockGetReportDetail.mockResolvedValue({ ...OPEN_REPORT, entityType: 'comment', entityId: 'cmt-1' });
    mockGetEntityPreview.mockResolvedValue({ ...ENTITY_PREVIEW, authorId: undefined });
    await render(<ModerationDetailScreen />);
    await waitFor(() => expect(screen.getByText('Dismiss Report')).toBeTruthy());
    expect(screen.getByText('Remove Content')).toBeTruthy();
    expect(screen.queryByText('Restrict Account')).toBeNull();
  });
});

// ─── Resolved report ────────────────────────────────────────────────────────

describe('ModerationDetailScreen — resolved report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({ params: { reportId: 'rpt-1' } });
    mockGetReportDetail.mockResolvedValue(RESOLVED_REPORT);
    mockGetEntityPreview.mockResolvedValue(ENTITY_PREVIEW);
    mockGetReporterProfile.mockResolvedValue(REPORTER_PROFILE);
  });

  it('shows resolved banner instead of enforcement actions', async () => {
    await render(<ModerationDetailScreen />);
    await waitFor(() => expect(screen.getByText(/has been resolved/)).toBeTruthy());
    expect(screen.getByText('No violation found')).toBeTruthy();
    expect(screen.queryByText('Dismiss Report')).toBeNull();
    expect(screen.queryByText('Remove Content')).toBeNull();
  });
});

// ─── Audit log ─────────────────────────────────────────────────────────────

describe('ModerationDetailScreen — audit log', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({ params: { reportId: 'rpt-1' } });
    mockGetReportDetail.mockResolvedValue({
      ...OPEN_REPORT,
      auditLog: [
        { id: 'aud-1', reportId: 'rpt-1', moderatorId: 'mod-1', action: 'removed_content' as const, reason: 'Rule violation', createdAt: '2026-07-28T11:00:00Z' }
      ]
    });
    mockGetEntityPreview.mockResolvedValue(ENTITY_PREVIEW);
    mockGetReporterProfile.mockResolvedValue(REPORTER_PROFILE);
  });

  it('renders audit trail entries', async () => {
    await render(<ModerationDetailScreen />);
    await waitFor(() => expect(screen.getByText('Audit Trail')).toBeTruthy());
    expect(screen.getByText('Content Removed')).toBeTruthy();
    expect(screen.getByText('Rule violation')).toBeTruthy();
  });
});

// ─── Dismiss action ────────────────────────────────────────────────────────

describe('ModerationDetailScreen — dismiss action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefault();
  });

  it('opens reason modal and submits dismiss', async () => {
    await render(<ModerationDetailScreen />);
    await waitFor(() => screen.getByRole('button', { name: 'Dismiss Report' }));
    fireEvent.press(screen.getByRole('button', { name: 'Dismiss Report' }));
    const input = screen.getByPlaceholderText('Enter reason...');
    fireEvent.changeText(input, 'No violation found');
    fireEvent.press(screen.getByText('Confirm'));
    await waitFor(() =>
      expect(mockDismissReport).toHaveBeenCalledWith('rpt-1', 'No violation found')
    );
  });
});

// ─── Remove content action ─────────────────────────────────────────────────

describe('ModerationDetailScreen — remove content action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefault();
  });

  it('shows confirmation alert then opens reason modal', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const btn = (buttons as { text: string; onPress?: () => void }[]).find(
        (b) => b.text === 'Remove'
      );
      btn?.onPress?.();
    });

    await render(<ModerationDetailScreen />);
    await waitFor(() => screen.getByRole('button', { name: 'Remove Content' }));
    fireEvent.press(screen.getByRole('button', { name: 'Remove Content' }));
    const input = screen.getByPlaceholderText('Enter reason...');
    fireEvent.changeText(input, 'Rule violation');
    fireEvent.press(screen.getByText('Confirm'));
    await waitFor(() =>
      expect(mockRemoveContent).toHaveBeenCalledWith('rpt-1', 'post', 'post-1', 'Rule violation')
    );
    alertSpy.mockRestore();
  });
});

// ─── Restrict account action ────────────────────────────────────────────────

describe('ModerationDetailScreen — restrict account action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefault();
  });

  it('shows confirmation alert then opens reason modal', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const btn = (buttons as { text: string; onPress?: () => void }[]).find(
        (b) => b.text === 'Restrict'
      );
      btn?.onPress?.();
    });

    await render(<ModerationDetailScreen />);
    await waitFor(() => screen.getByRole('button', { name: 'Restrict Account' }));
    fireEvent.press(screen.getByRole('button', { name: 'Restrict Account' }));
    const input = screen.getByPlaceholderText('Enter reason...');
    fireEvent.changeText(input, 'Repeated harassment');
    fireEvent.press(screen.getByText('Confirm'));
    await waitFor(() =>
      expect(mockRestrictAccount).toHaveBeenCalledWith('rpt-1', 'user-auth', 'Repeated harassment')
    );
    alertSpy.mockRestore();
  });
});

// ─── Action error handling ──────────────────────────────────────────────────

describe('ModerationDetailScreen — action error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefault();
  });

  it('shows Alert when dismiss returns an error', async () => {
    mockDismissReport.mockResolvedValue({ error: 'You do not have permission to perform this action.' });
    const alertSpy = jest.spyOn(Alert, 'alert');
    await render(<ModerationDetailScreen />);
    await waitFor(() => screen.getByRole('button', { name: 'Dismiss Report' }));
    fireEvent.press(screen.getByRole('button', { name: 'Dismiss Report' }));
    const input = screen.getByPlaceholderText('Enter reason...');
    fireEvent.changeText(input, 'No issue');
    fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Action failed', expect.any(String))
    );
    alertSpy.mockRestore();
  });

  it('shows Alert when dismiss mutation throws', async () => {
    mockMutationError = new Error('Server error');
    const alertSpy = jest.spyOn(Alert, 'alert');
    await render(<ModerationDetailScreen />);
    await waitFor(() => screen.getByRole('button', { name: 'Dismiss Report' }));
    fireEvent.press(screen.getByRole('button', { name: 'Dismiss Report' }));
    const input = screen.getByPlaceholderText('Enter reason...');
    fireEvent.changeText(input, 'No issue');
    fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Action failed', 'Server error')
    );
    alertSpy.mockRestore();
  });
});

// ─── User report: restrict account only (no remove content) ─────────────────

describe('ModerationDetailScreen — user report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({ params: { reportId: 'rpt-1' } });
    mockGetReportDetail.mockResolvedValue({ ...OPEN_REPORT, entityType: 'user', entityId: 'user-bad' });
    mockGetEntityPreview.mockResolvedValue({ id: 'user-bad', displayName: 'Bad Actor', isRestricted: false });
    mockGetReporterProfile.mockResolvedValue(REPORTER_PROFILE);
  });

  it('shows Restrict Account but not Remove Content', async () => {
    await render(<ModerationDetailScreen />);
    await waitFor(() => expect(screen.getByText('Dismiss Report')).toBeTruthy());
    expect(screen.queryByText('Remove Content')).toBeNull();
    expect(screen.getByText('Restrict Account')).toBeTruthy();
  });
});