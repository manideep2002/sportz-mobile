/**
 * ReportSheet UI tests — MF-02
 *
 * RNTL 14: render() is async — every test awaits it before using screen.
 */

import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockReportEntity = jest.fn();
const mockNetFetch = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  fetch: (...a: unknown[]) => mockNetFetch(...a)
}));
jest.mock('@/services/reportService', () => ({
  reportReasons: ['Spam', 'Harassment', 'Inappropriate content', 'Fake profile', 'Other'],
  reportService: { reportEntity: (...a: unknown[]) => mockReportEntity(...a) }
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
      background: '#000'
    }
  })
}));
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));

// eslint-disable-next-line import/first
import { ReportSheet } from '@/components/moderation/ReportSheet';

const defaultProps = {
  open: true,
  entityLabel: 'post',
  entityType: 'post' as const,
  entityId: 'post-1',
  onClose: jest.fn()
};

// ─── idle ─────────────────────────────────────────────────────────────────

describe('ReportSheet — idle state', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders all reason options when open', async () => {
    await render(<ReportSheet {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Report for Spam' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Report for Harassment' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Report for Inappropriate content' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Report for Fake profile' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Report for Other' })).toBeTruthy();
  });

  it('shows nothing when closed', async () => {
    await render(<ReportSheet {...defaultProps} open={false} />);
    expect(screen.queryByRole('button', { name: 'Report for Spam' })).toBeNull();
  });

  it('calls onClose when Cancel is pressed', async () => {
    const onClose = jest.fn();
    await render(<ReportSheet {...defaultProps} onClose={onClose} />);
    fireEvent.press(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─── success ──────────────────────────────────────────────────────────────

describe('ReportSheet — success flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetFetch.mockResolvedValue({ isConnected: true });
    mockReportEntity.mockResolvedValue('submitted');
  });

  it('calls reportService with correct entity type and reason', async () => {
    await render(
      <ReportSheet {...defaultProps} entityType="comment" entityId="cmt-1" entityLabel="comment" />
    );
    fireEvent.press(screen.getByRole('button', { name: 'Report for Harassment' }));
    await waitFor(() =>
      expect(mockReportEntity).toHaveBeenCalledWith('comment', 'cmt-1', 'Harassment')
    );
  });

  it('shows success state after submission', async () => {
    await render(<ReportSheet {...defaultProps} />);
    fireEvent.press(screen.getByRole('button', { name: 'Report for Spam' }));
    await waitFor(() => expect(screen.getByText('Report submitted')).toBeTruthy());
    expect(screen.getByText(/Thank you/)).toBeTruthy();
  });

  it('calls onClose when Done is pressed on success screen', async () => {
    const onClose = jest.fn();
    await render(<ReportSheet {...defaultProps} onClose={onClose} />);
    fireEvent.press(screen.getByRole('button', { name: 'Report for Spam' }));
    await waitFor(() => screen.getByText('Done'));
    fireEvent.press(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─── duplicate ────────────────────────────────────────────────────────────

describe('ReportSheet — duplicate flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetFetch.mockResolvedValue({ isConnected: true });
    mockReportEntity.mockResolvedValue('duplicate');
  });

  it('shows "Already reported" state', async () => {
    await render(
      <ReportSheet {...defaultProps} entityType="event" entityLabel="event" entityId="evt-1" />
    );
    fireEvent.press(screen.getByRole('button', { name: 'Report for Spam' }));
    await waitFor(() => expect(screen.getByText('Already reported')).toBeTruthy());
    expect(screen.getByText(/already reported this event/i)).toBeTruthy();
  });

  it('calls onClose when Done is pressed on duplicate screen', async () => {
    const onClose = jest.fn();
    await render(
      <ReportSheet {...defaultProps} onClose={onClose} entityType="group" entityLabel="group" entityId="grp-1" />
    );
    fireEvent.press(screen.getByRole('button', { name: 'Report for Other' }));
    await waitFor(() => screen.getByText('Done'));
    fireEvent.press(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─── offline ──────────────────────────────────────────────────────────────

describe('ReportSheet — offline flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetFetch.mockResolvedValue({ isConnected: false });
  });

  it('shows error state with offline message when not connected', async () => {
    await render(<ReportSheet {...defaultProps} />);
    fireEvent.press(screen.getByRole('button', { name: 'Report for Spam' }));
    await waitFor(() => expect(screen.getByText('Report failed')).toBeTruthy());
    expect(screen.getByText(/offline/i)).toBeTruthy();
    expect(mockReportEntity).not.toHaveBeenCalled();
  });
});

// ─── error ────────────────────────────────────────────────────────────────

describe('ReportSheet — error flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetFetch.mockResolvedValue({ isConnected: true });
    mockReportEntity.mockRejectedValue(new Error('Server error'));
  });

  it('shows error state with message from service', async () => {
    await render(<ReportSheet {...defaultProps} />);
    fireEvent.press(screen.getByRole('button', { name: 'Report for Spam' }));
    await waitFor(() => expect(screen.getByText('Report failed')).toBeTruthy());
    expect(screen.getByText('Server error')).toBeTruthy();
  });

  it('"Try Again" resets back to reason list', async () => {
    await render(<ReportSheet {...defaultProps} />);
    fireEvent.press(screen.getByRole('button', { name: 'Report for Spam' }));
    await waitFor(() => screen.getByText('Try Again'));
    fireEvent.press(screen.getByText('Try Again'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Report for Spam' })).toBeTruthy()
    );
  });
});

// ─── permission / auth ────────────────────────────────────────────────────

describe('ReportSheet — permission / auth error', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetFetch.mockResolvedValue({ isConnected: true });
    mockReportEntity.mockRejectedValue(new Error('You must be signed in'));
  });

  it('shows Alert and calls onClose for auth errors', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const onClose = jest.fn();
    await render(<ReportSheet {...defaultProps} onClose={onClose} />);
    fireEvent.press(screen.getByRole('button', { name: 'Report for Spam' }));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Permission denied', expect.any(String))
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });
});

// ─── entity label in copy ─────────────────────────────────────────────────

describe('ReportSheet — entity label in copy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetFetch.mockResolvedValue({ isConnected: true });
    mockReportEntity.mockResolvedValue('submitted');
  });

  const labels: { label: string; entityType: 'comment' | 'event' | 'group' | 'page' | 'post' }[] = [
    { label: 'comment', entityType: 'comment' },
    { label: 'event', entityType: 'event' },
    { label: 'group', entityType: 'group' },
    { label: 'page', entityType: 'page' },
    { label: 'post', entityType: 'post' }
  ];

  it.each(labels)('success copy mentions "$label"', async ({ label, entityType }) => {
    await render(
      <ReportSheet open entityLabel={label} entityType={entityType} entityId="eid-1" onClose={jest.fn()} />
    );
    fireEvent.press(screen.getByRole('button', { name: 'Report for Spam' }));
    await waitFor(() =>
      expect(screen.getAllByText(new RegExp(label, 'i')).length).toBeGreaterThan(0)
    );
  });
});
