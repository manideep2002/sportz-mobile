/**
 * Screen integration tests for MF-02 report entry-points.
 *
 * RNTL 14: render() is async — every test awaits it before using screen.
 * Pattern mirrors manageEvent.screen.test.tsx (top-level imports first,
 * jest.mock hoisted by babel, component import last with eslint-disable).
 */

import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockReportEntity = jest.fn().mockResolvedValue('submitted');
const mockNetFetch = jest.fn().mockResolvedValue({ isConnected: true });
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockUseRoute = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  fetch: (...a: unknown[]) => mockNetFetch(...a)
}));
jest.mock('@/services/reportService', () => ({
  reportReasons: ['Spam', 'Harassment', 'Inappropriate content', 'Fake profile', 'Other'],
  reportService: { reportEntity: (...a: unknown[]) => mockReportEntity(...a) }
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
      background: '#000'
    }
  })
}));
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (sel: (s: { user: { id: string }; profile: { id: string } }) => unknown) =>
    sel({ user: { id: 'me-1' }, profile: { id: 'me-1' } })
}));
jest.mock('@/lib/supabaseOnly', () => ({ assertSupabaseConfigured: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { getUser: jest.fn() } } }));
jest.mock('@/services/canonicalLinkService', () => ({
  shareCanonicalEntity: jest.fn().mockResolvedValue(undefined)
}));
// Mock react-query for ModerationScreen and ModerationDetail tests below
jest.mock('@tanstack/react-query', () => {
  const React = require('react');
  return {
    useQueryClient: () => ({ invalidateQueries: jest.fn() }),
    useQuery: ({ queryFn, enabled }: { queryFn: () => Promise<unknown>; enabled?: boolean }) => {
      const [state, setState] = React.useState({
        data: undefined as unknown,
        isLoading: true,
        isError: false,
        error: null as Error | null,
        isRefetching: false, refetch: jest.fn()
      });
      React.useEffect(() => {
        if (enabled === false) {
          setState((prev) => ({ ...prev, data: undefined, isLoading: false }));
          return;
        }
        setState((prev) => ({ ...prev, isLoading: true }));
        queryFn()
          .then((data) => setState((prev) => ({ ...prev, data, isLoading: false, isRefetching: false })))
          .catch((err: Error) => setState((prev) => ({ ...prev, isLoading: false, isError: true, error: err, isRefetching: false })));
      }, [enabled]);
      return state;
    },
    useMutation: ({ mutationFn, onSuccess, onError }: { mutationFn?: (...a: unknown[]) => Promise<unknown>; onSuccess?: (r: unknown) => void; onError?: (e: Error) => void }) => ({
      mutate: (...args: unknown[]) => {
        const promise = mutationFn ? mutationFn(...args) : Promise.resolve({});
        promise
          .then((result: unknown) => onSuccess?.(result))
          .catch((err: Error) => onError?.(err));
      },
      isPending: false
    })
  };
});
jest.mock('@/layout/responsive', () => ({
  useResponsiveLayout: () => ({ isExpanded: false, feedMaxWidth: 600 })
}));
jest.mock('expo-image', () => ({ Image: 'ExpoImage' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('@/utils/share', () => ({
  shareEvent: jest.fn(), sharePost: jest.fn(), openPostMedia: jest.fn()
}));
jest.mock('@/utils/format', () => ({
  eventDate: () => 'Aug 1', formatTime: () => '10:00 AM', timeAgo: () => '1h'
}));
jest.mock('@/utils/mediaOptimization', () => ({
  mediaVariants: { eventCover: () => null }
}));
jest.mock('@/constants/events', () => ({
  eventPaymentNotice: 'Pay at venue.', eventVisibilityLabel: () => 'Public'
}));
jest.mock('@/components/feed/CourtArt', () => ({ CourtArt: () => null }));
jest.mock('@/services/profileService', () => ({
  profileService: { listPlayers: jest.fn().mockResolvedValue([]) }
}));
jest.mock('@/components/feed/PostCard', () => ({ PostCard: () => null }));
jest.mock('@/components/feed/PostOptionsSheet', () => ({
  PostOptionsSheet: (props: { open: boolean; onReport?: () => void }) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return props.open
      ? React.createElement(
          Pressable,
          { accessibilityRole: 'button', accessibilityLabel: 'report-post-btn', onPress: props.onReport },
          React.createElement(Text, null, 'Report')
        )
      : null;
  }
}));
jest.mock('@/components/social/CommentInput', () => ({ CommentInput: () => null }));
jest.mock('@/components/community/CommunityPostFeed', () => ({
  CommunityPostFeed: () => null
}));
jest.mock('@/hooks/useEvents', () => ({
  useEvent: jest.fn(),
  useEventParticipation: jest.fn(),
  useJoinEvent: jest.fn(),
  useLeaveEvent: jest.fn(),
  useLeaveEventWaitlist: jest.fn(),
  useMyEventInvitation: jest.fn(),
  useRespondEventInvitation: jest.fn(),
  useCommunityEvents: jest.fn()
}));
jest.mock('@/hooks/useCommunities', () => ({
  useCommunity: jest.fn(),
  useCommunityJoinRequests: jest.fn(),
  useCommunityMembers: jest.fn(),
  useInviteCommunityMember: jest.fn(),
  useJoinCommunity: jest.fn(),
  useLeaveCommunity: jest.fn(),
  useRemoveCommunityMember: jest.fn(),
  useRespondCommunityInvite: jest.fn(),
  useRespondCommunityJoinRequest: jest.fn(),
  useUpdateCommunityMemberRole: jest.fn()
}));
jest.mock('@/hooks/useFeed', () => ({
  usePost: jest.fn(),
  useComments: jest.fn(),
  usePostRealtimeUpdates: jest.fn(),
  useOptimisticPostSave: jest.fn(),
  useRecordPostShare: jest.fn(),
  useDeletePost: jest.fn(),
  useOptimisticCommentLike: jest.fn(),
  useDeleteComment: jest.fn(),
  useCommunityPosts: jest.fn(),
  flattenCommunityPostPages: jest.fn().mockReturnValue([])
}));

// ── imports after mocks ────────────────────────────────────────────────────
// eslint-disable-next-line import/first
import {
  useEvent, useEventParticipation, useJoinEvent, useLeaveEvent,
  useLeaveEventWaitlist, useMyEventInvitation, useRespondEventInvitation,
  useCommunityEvents
} from '@/hooks/useEvents';
// eslint-disable-next-line import/first
import {
  useCommunity, useCommunityMembers, useCommunityJoinRequests,
  useJoinCommunity, useLeaveCommunity, useInviteCommunityMember,
  useRespondCommunityInvite, useRespondCommunityJoinRequest,
  useUpdateCommunityMemberRole, useRemoveCommunityMember
} from '@/hooks/useCommunities';
// eslint-disable-next-line import/first
import {
  usePost, useComments, usePostRealtimeUpdates, useOptimisticPostSave,
  useRecordPostShare, useDeletePost, useOptimisticCommentLike,
  useDeleteComment, useCommunityPosts, flattenCommunityPostPages
} from '@/hooks/useFeed';
// eslint-disable-next-line import/first
import { EventDetailScreen } from '@/screens/events/EventDetailScreen';
// eslint-disable-next-line import/first
import { GroupDetailScreen } from '@/screens/community/GroupDetailScreen';
// eslint-disable-next-line import/first
import { PageDetailScreen } from '@/screens/community/PageDetailScreen';
// eslint-disable-next-line import/first
import { PostDetailScreen } from '@/screens/feed/PostDetailScreen';

// ── fixtures ──────────────────────────────────────────────────────────────
const BASE_PROFILE = {
  id: 'organizer-1', username: 'org', displayName: 'Organizer', initials: 'OR',
  bio: '', city: '', country: '', primarySport: 'Basketball', sports: ['Basketball'],
  skillLevel: 'Intermediate' as const, isOnline: false, badges: [],
  stats: { followers: 0, following: 0, posts: 0, winRate: 0, games: 0 }
};
const BASE_COMMUNITY = {
  id: 'comm-1', type: 'group' as const, name: 'Test Group', slug: 'test-group',
  description: 'desc', sport: 'Basketball', city: 'Delhi', memberCount: 5,
  followerCount: 0, isPrivate: false, isAdmin: false, isOwner: false,
  isMember: true, canPost: false, canViewContent: true, canManageMembers: false,
  isArchived: false, isVerified: false, membershipStatus: 'joined' as const
};
const BASE_EVENT = {
  id: 'evt-1', title: 'Test Event', eventType: 'Pickup Game' as const,
  sport: 'Basketball', status: 'open' as const, visibility: 'public' as const,
  description: 'A game', startsAt: '2026-08-01T10:00:00Z', endsAt: '2026-08-01T12:00:00Z',
  locationName: 'Court A', city: 'Delhi', latitude: 0, longitude: 0,
  maxPlayers: 10, playerCount: 3, entryFeeCents: 0, currency: 'INR',
  entryFeeLabel: 'Free', organizer: { ...BASE_PROFILE, id: 'organizer-1' },
  attendees: [], coverUrl: null
};

// ══════════════════════════════════════════════════════════════════════════
// EventDetailScreen
// ══════════════════════════════════════════════════════════════════════════

function setupEventHooks(overrides = {}) {
  (useEvent as jest.Mock).mockReturnValue({
    data: { ...BASE_EVENT, ...overrides },
    isLoading: false, isError: false, isRefetching: false, refetch: jest.fn()
  });
  (useEventParticipation as jest.Mock).mockReturnValue({
    data: 'none', isRefetching: false, refetch: jest.fn()
  });
  (useJoinEvent as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
  (useLeaveEvent as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
  (useLeaveEventWaitlist as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
  (useMyEventInvitation as jest.Mock).mockReturnValue({ data: null, refetch: jest.fn() });
  (useRespondEventInvitation as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
}

describe('EventDetailScreen — report entry-point', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({ params: { eventId: 'evt-1' } });
    setupEventHooks();
  });

  it('renders the Report event button for non-organizers', async () => {
    await render(<EventDetailScreen />);
    expect(screen.getByRole('button', { name: 'Report event' })).toBeTruthy();
  });

  it('does NOT render the Report event button for the organizer', async () => {
    setupEventHooks({ organizer: { ...BASE_PROFILE, id: 'me-1' } });
    await render(<EventDetailScreen />);
    expect(screen.queryByRole('button', { name: 'Report event' })).toBeNull();
  });

  it('opens ReportSheet when Report event is pressed', async () => {
    await render(<EventDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Report event' }));
    await waitFor(() =>
      expect(screen.getByText('Why are you reporting this event?')).toBeTruthy()
    );
  });

  it('submits an event report with the chosen reason', async () => {
    await render(<EventDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Report event' }));
    await waitFor(() => screen.getByRole('button', { name: 'Report for Spam' }));
    fireEvent.press(screen.getByRole('button', { name: 'Report for Spam' }));
    await waitFor(() =>
      expect(mockReportEntity).toHaveBeenCalledWith('event', 'evt-1', 'Spam')
    );
    await waitFor(() => expect(screen.getByText('Report submitted')).toBeTruthy());
  });
});

// ══════════════════════════════════════════════════════════════════════════
// GroupDetailScreen
// ══════════════════════════════════════════════════════════════════════════

function setupGroupHooks(overrides = {}) {
  const community = { ...BASE_COMMUNITY, ...overrides };
  (useCommunity as jest.Mock).mockReturnValue({
    data: community, isLoading: false, isError: false, isRefetching: false, refetch: jest.fn()
  });
  (useCommunityMembers as jest.Mock).mockReturnValue({
    data: [], isLoading: false, isError: false, isRefetching: false, refetch: jest.fn()
  });
  (useCommunityJoinRequests as jest.Mock).mockReturnValue({
    data: [], isLoading: false, isRefetching: false, refetch: jest.fn()
  });
  (useCommunityPosts as jest.Mock).mockReturnValue({
    data: undefined, isLoading: false, isError: false, isRefetching: false,
    refetch: jest.fn(), fetchNextPage: jest.fn(),
    hasNextPage: false, isFetchingNextPage: false, isFetchNextPageError: false
  });
  (flattenCommunityPostPages as jest.Mock).mockReturnValue([]);
  (useCommunityEvents as jest.Mock).mockReturnValue({
    data: [], isLoading: false, isError: false, refetch: jest.fn()
  });
  (useJoinCommunity as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
  (useLeaveCommunity as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
  (useInviteCommunityMember as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
  (useRespondCommunityInvite as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
  (useRespondCommunityJoinRequest as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
  (useUpdateCommunityMemberRole as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
  (useRemoveCommunityMember as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
}

describe('GroupDetailScreen — report entry-point', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({ params: { communityId: 'comm-1' } });
    setupGroupHooks();
  });

  it('shows "Report group" in the options Alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    await render(<GroupDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Group options' }));
    expect(alertSpy).toHaveBeenCalledWith(
      expect.any(String), expect.any(String),
      expect.arrayContaining([expect.objectContaining({ text: 'Report group' })]),
      expect.any(Object)
    );
    alertSpy.mockRestore();
  });

  it('does NOT include "Report group" when current user is the owner', async () => {
    setupGroupHooks({ isOwner: true });
    const alertSpy = jest.spyOn(Alert, 'alert');
    await render(<GroupDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Group options' }));
    const buttons = (alertSpy.mock.calls[0][2] ?? []) as { text: string }[];
    expect(buttons.map((b) => b.text)).not.toContain('Report group');
    alertSpy.mockRestore();
  });

  it('opens ReportSheet when "Report group" is selected', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const btn = (buttons as { text: string; onPress?: () => void }[]).find(
        (b) => b.text === 'Report group'
      );
      btn?.onPress?.();
    });
    await render(<GroupDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Group options' }));
    await waitFor(() =>
      expect(screen.getByText('Why are you reporting this group?')).toBeTruthy()
    );
    alertSpy.mockRestore();
  });

  it('submits a group report', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const btn = (buttons as { text: string; onPress?: () => void }[]).find(
        (b) => b.text === 'Report group'
      );
      btn?.onPress?.();
    });
    await render(<GroupDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Group options' }));
    await waitFor(() => screen.getByRole('button', { name: 'Report for Harassment' }));
    fireEvent.press(screen.getByRole('button', { name: 'Report for Harassment' }));
    await waitFor(() =>
      expect(mockReportEntity).toHaveBeenCalledWith('group', 'comm-1', 'Harassment')
    );
    alertSpy.mockRestore();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// PageDetailScreen
// ══════════════════════════════════════════════════════════════════════════

const PAGE_COMMUNITY = {
  ...BASE_COMMUNITY, type: 'page' as const, name: 'Test Page',
  isVerified: false, isMember: false, isOwner: false
};

function setupPageHooks(overrides = {}) {
  const community = { ...PAGE_COMMUNITY, ...overrides };
  (useCommunity as jest.Mock).mockReturnValue({
    data: community, isLoading: false, isError: false, isRefetching: false, refetch: jest.fn()
  });
  (useCommunityPosts as jest.Mock).mockReturnValue({
    data: undefined, isLoading: false, isError: false, isRefetching: false,
    refetch: jest.fn(), fetchNextPage: jest.fn(),
    hasNextPage: false, isFetchingNextPage: false, isFetchNextPageError: false
  });
  (flattenCommunityPostPages as jest.Mock).mockReturnValue([]);
  (useJoinCommunity as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
  (useLeaveCommunity as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
}

describe('PageDetailScreen — report entry-point', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({ params: { communityId: 'comm-1' } });
    setupPageHooks();
  });

  it('shows "Report page" in the options Alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    await render(<PageDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Page options' }));
    expect(alertSpy).toHaveBeenCalledWith(
      expect.any(String), expect.any(String),
      expect.arrayContaining([expect.objectContaining({ text: 'Report page' })]),
      expect.any(Object)
    );
    alertSpy.mockRestore();
  });

  it('does NOT include "Report page" when current user is the owner', async () => {
    setupPageHooks({ isOwner: true });
    const alertSpy = jest.spyOn(Alert, 'alert');
    await render(<PageDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Page options' }));
    const buttons = (alertSpy.mock.calls[0][2] ?? []) as { text: string }[];
    expect(buttons.map((b) => b.text)).not.toContain('Report page');
    alertSpy.mockRestore();
  });

  it('opens ReportSheet when "Report page" is selected', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const btn = (buttons as { text: string; onPress?: () => void }[]).find(
        (b) => b.text === 'Report page'
      );
      btn?.onPress?.();
    });
    await render(<PageDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Page options' }));
    await waitFor(() =>
      expect(screen.getByText('Why are you reporting this page?')).toBeTruthy()
    );
    alertSpy.mockRestore();
  });

  it('submits a page report', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const btn = (buttons as { text: string; onPress?: () => void }[]).find(
        (b) => b.text === 'Report page'
      );
      btn?.onPress?.();
    });
    await render(<PageDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Page options' }));
    await waitFor(() => screen.getByRole('button', { name: 'Report for Other' }));
    fireEvent.press(screen.getByRole('button', { name: 'Report for Other' }));
    await waitFor(() =>
      expect(mockReportEntity).toHaveBeenCalledWith('page', 'comm-1', 'Other')
    );
    alertSpy.mockRestore();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// PostDetailScreen — comment reporting
// ══════════════════════════════════════════════════════════════════════════

const OTHER_COMMENT = {
  id: 'cmt-1', postId: 'post-1', parentCommentId: null,
  author: { ...BASE_PROFILE, id: 'other-user-2' },
  body: 'Nice play!', likes: 0, likedByMe: false, createdAt: '2026-07-28T10:00:00Z'
};
const MY_COMMENT = { ...OTHER_COMMENT, author: { ...BASE_PROFILE, id: 'me-1' } };

function setupPostDetailHooks(comments = [OTHER_COMMENT]) {
  (usePost as jest.Mock).mockReturnValue({
    data: {
      id: 'post-1', author: BASE_PROFILE, kind: 'post', sport: 'Basketball',
      body: 'test', likedByMe: false, savedByMe: false,
      likes: 0, comments: 1, shares: 0, createdAt: '2026-07-28T10:00:00Z'
    },
    isLoading: false, isError: false, isRefetching: false, refetch: jest.fn()
  });
  (useComments as jest.Mock).mockReturnValue({
    data: comments, isLoading: false, isError: false, isRefetching: false, refetch: jest.fn()
  });
  (usePostRealtimeUpdates as jest.Mock).mockReturnValue(undefined);
  (useOptimisticPostSave as jest.Mock).mockReturnValue({ mutate: jest.fn() });
  (useRecordPostShare as jest.Mock).mockReturnValue({ mutate: jest.fn() });
  (useDeletePost as jest.Mock).mockReturnValue({ mutate: jest.fn() });
  (useOptimisticCommentLike as jest.Mock).mockReturnValue({ mutate: jest.fn() });
  (useDeleteComment as jest.Mock).mockReturnValue({ mutate: jest.fn() });
}

describe('PostDetailScreen — comment report entry-point', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({ params: { postId: 'post-1' } });
    setupPostDetailHooks();
  });

  it('shows "Report comment" when another user\'s comment is long-pressed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    await render(<PostDetailScreen />);
    const commentBtn = screen.getByRole('button', { name: 'Comment by Organizer' });
    expect(commentBtn).toBeTruthy();
    fireEvent(commentBtn, 'longPress');
    expect(alertSpy).toHaveBeenCalledWith(
      'Comment options', expect.anything(),
      expect.arrayContaining([expect.objectContaining({ text: 'Report comment' })]),
      expect.any(Object)
    );
    alertSpy.mockRestore();
  });

  it('opens ReportSheet when "Report comment" is selected', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const btn = (buttons as { text: string; onPress?: () => void }[]).find(
        (b) => b.text === 'Report comment'
      );
      btn?.onPress?.();
    });
    await render(<PostDetailScreen />);
    fireEvent(screen.getByRole('button', { name: 'Comment by Organizer' }), 'longPress');
    await waitFor(() =>
      expect(screen.getByText('Why are you reporting this comment?')).toBeTruthy()
    );
    alertSpy.mockRestore();
  });

  it('submits a comment report', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const btn = (buttons as { text: string; onPress?: () => void }[]).find(
        (b) => b.text === 'Report comment'
      );
      btn?.onPress?.();
    });
    await render(<PostDetailScreen />);
    fireEvent(screen.getByRole('button', { name: 'Comment by Organizer' }), 'longPress');
    await waitFor(() => screen.getByRole('button', { name: 'Report for Spam' }));
    fireEvent.press(screen.getByRole('button', { name: 'Report for Spam' }));
    await waitFor(() =>
      expect(mockReportEntity).toHaveBeenCalledWith('comment', 'cmt-1', 'Spam')
    );
    alertSpy.mockRestore();
  });

  it('offers "Delete comment" for own comments, not "Report comment"', async () => {
    setupPostDetailHooks([MY_COMMENT]);
    const alertSpy = jest.spyOn(Alert, 'alert');
    await render(<PostDetailScreen />);
    fireEvent(screen.getByRole('button', { name: 'Comment by Organizer' }), 'longPress');
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete comment', expect.anything(),
      expect.arrayContaining([expect.objectContaining({ text: 'Delete' })]),
      expect.any(Object)
    );
    expect(alertSpy.mock.calls.some((c) => c[0] === 'Comment options')).toBe(false);
    alertSpy.mockRestore();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ModerationScreen -> ModerationDetail navigation
// ══════════════════════════════════════════════════════════════════════════

jest.mock('@/services/moderationService', () => ({
  moderationService: {
    getReportDetail: jest.fn(),
    getEntityPreview: jest.fn(),
    getReporterProfile: jest.fn(),
    dismissReport: jest.fn().mockResolvedValue({}),
    removeContent: jest.fn().mockResolvedValue({}),
    restrictAccount: jest.fn().mockResolvedValue({})
  }
}));

// eslint-disable-next-line import/first
import { ModerationScreen } from '@/screens/settings/ModerationScreen';

const mockListReports = jest.fn();

// Override the reportService mock for ModerationScreen's query
// We need to reach into the existing mock; the module is already mocked above.
// Use require to get the module reference and extend it.
const reportServiceMock = require('@/services/reportService').reportService;
reportServiceMock.listReports = mockListReports;

const mockModService = require('@/services/moderationService').moderationService;

const SAMPLE_REPORTS = [
  {
    id: 'rpt-1',
    reporter: { id: 'user-1', username: 'asha', displayName: 'Asha', initials: 'AS', avatarUrl: null },
    entityType: 'post' as const,
    entityId: 'post-1',
    reason: 'Harassment',
    status: 'open' as const,
    resolution: null,
    createdAt: '2026-07-28T10:00:00Z',
    reviewedAt: null
  }
];

describe('ModerationScreen — navigation to detail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListReports.mockResolvedValue(SAMPLE_REPORTS);
    mockUseRoute.mockReturnValue({ params: {} });
    mockNavigate.mockClear();
  });

  it('renders report list with pressable items', async () => {
    await render(<ModerationScreen />);
    await waitFor(() => expect(screen.getByText('Harassment')).toBeTruthy());
  });

  it('navigates to ModerationDetail when a report is pressed', async () => {
    await render(<ModerationScreen />);
    await waitFor(() => screen.getByText('Harassment'));
    fireEvent.press(screen.getByRole('button', { name: /Report: Harassment/ }));
    expect(mockNavigate).toHaveBeenCalledWith('ModerationDetail', { reportId: 'rpt-1' });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ModerationDetailScreen — full enforcement flow integration
// ══════════════════════════════════════════════════════════════════════════

const DETAIL_REPORT = {
  id: 'rpt-1',
  reporterId: 'user-1',
  entityType: 'post' as const,
  entityId: 'post-1',
  reason: 'Spam',
  status: 'open' as const,
  resolution: null,
  createdAt: '2026-07-28T10:00:00Z',
  reviewedBy: null,
  reviewedAt: null,
  auditLog: []
};

const DETAIL_PREVIEW = {
  id: 'post-1', authorId: 'user-bad',
  body: 'Buy cheap stuff',
  removedByModerator: false, createdAt: '2026-07-28T10:00:00Z'
};

const DETAIL_REPORTER = { id: 'user-1', username: 'vik', displayName: 'Vik', avatarUrl: null };

describe('ModerationDetailScreen — integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoute.mockReturnValue({ params: { reportId: 'rpt-1' } });
    mockModService.getReportDetail.mockResolvedValue(DETAIL_REPORT);
    mockModService.getEntityPreview.mockResolvedValue(DETAIL_PREVIEW);
    mockModService.getReporterProfile.mockResolvedValue(DETAIL_REPORTER);
    mockModService.dismissReport.mockResolvedValue({});
    mockModService.removeContent.mockResolvedValue({});
    mockModService.restrictAccount.mockResolvedValue({});
    mockNetFetch.mockResolvedValue({ isConnected: true });
    // Ensure ReportSheet uses our mock
    mockReportEntity.mockResolvedValue('submitted');
  });

  // eslint-disable-next-line import/first
  const { ModerationDetailScreen } = require('@/screens/settings/ModerationDetailScreen');

  it('loads and displays full report detail', async () => {
    await render(<ModerationDetailScreen />);
    await waitFor(() => expect(screen.getByText('Spam')).toBeTruthy());
    expect(screen.getByText(/post/)).toBeTruthy();
    expect(screen.getByText('@vik')).toBeTruthy();
    expect(screen.getByText('Buy cheap stuff')).toBeTruthy();
  });

  it('dismisses a report and shows success alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    await render(<ModerationDetailScreen />);
    await waitFor(() => screen.getByRole('button', { name: 'Dismiss Report' }));
    fireEvent.press(screen.getByRole('button', { name: 'Dismiss Report' }));
    await waitFor(() => screen.getByPlaceholderText('Enter reason...'));
    fireEvent.changeText(screen.getByPlaceholderText('Enter reason...'), 'Not a violation');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Confirm' }).props.accessibilityState.disabled).toBe(false)
    );
    fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(mockModService.dismissReport).toHaveBeenCalledWith('rpt-1', 'Not a violation')
    );
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Report dismissed', expect.any(String))
    );
    alertSpy.mockRestore();
  });

  it('removes content and shows success alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      if (!buttons) return;
      const btn = (buttons as { text: string; onPress?: () => void }[]).find((b) => b.text === 'Remove');
      btn?.onPress?.();
    });
    await render(<ModerationDetailScreen />);
    await waitFor(() => screen.getByRole('button', { name: 'Remove Content' }));
    fireEvent.press(screen.getByRole('button', { name: 'Remove Content' }));
    await waitFor(() => screen.getByPlaceholderText('Enter reason...'));
    fireEvent.changeText(screen.getByPlaceholderText('Enter reason...'), 'Spam content');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Confirm' }).props.accessibilityState.disabled).toBe(false)
    );
    fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(mockModService.removeContent).toHaveBeenCalledWith('rpt-1', 'post', 'post-1', 'Spam content')
    );
    alertSpy.mockRestore();
  });

  it('restricts account and shows success alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      if (!buttons) return;
      const btn = (buttons as { text: string; onPress?: () => void }[]).find((b) => b.text === 'Restrict');
      btn?.onPress?.();
    });
    await render(<ModerationDetailScreen />);
    await waitFor(() => screen.getByRole('button', { name: 'Restrict Account' }));
    fireEvent.press(screen.getByRole('button', { name: 'Restrict Account' }));
    await waitFor(() => screen.getByPlaceholderText('Enter reason...'));
    fireEvent.changeText(screen.getByPlaceholderText('Enter reason...'), 'Repeated spam');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Confirm' }).props.accessibilityState.disabled).toBe(false)
    );
    fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(mockModService.restrictAccount).toHaveBeenCalledWith('rpt-1', 'user-bad', 'Repeated spam')
    );
    alertSpy.mockRestore();
  });
});
