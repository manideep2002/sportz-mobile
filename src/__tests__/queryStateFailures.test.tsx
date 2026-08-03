import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockNavigation = { goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() };
const mockRoute: { params: Record<string, any> } = { params: {} };

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/lib/supabaseOnly', () => ({ assertSupabaseConfigured: () => {} }));

/* ── StoryViewerScreen state mocks ──────────────────────────────────────── */
let mockStoriesState: Record<string, any> = { data: [] };
const mockRefetchStories = jest.fn();

jest.mock('@react-navigation/native-stack', () => ({
  NativeStackNavigationProp: {}
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 })
}));
jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true
}));
jest.mock('@/hooks/useStories', () => ({
  useStories: () => mockStoriesState,
  useMarkStorySeen: () => jest.fn(),
  useDeleteStory: () => ({ isPending: false, mutate: jest.fn() })
}));
jest.mock('@/components/feed/StoryReactionOverlay', () => {
  const React = require('react');
  return {
    StoryReactionOverlay: React.forwardRef(function MockStoryReactionOverlay() {
      return null;
    })
  };
});
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ profile: { id: 'viewer-1' }, user: { id: 'viewer-1' } })
}));
jest.mock('@/services/messageService', () => ({
  messageService: { createDirectConversation: jest.fn(), sendMessage: jest.fn() }
}));
jest.mock('@/services/storyService', () => ({
  storyService: { recordReaction: jest.fn(), recordReply: jest.fn() }
}));

/* ── Athlete stats hooks ────────────────────────────────────────────────── */
let mockSeasonsState: Record<string, any> = { data: [], isLoading: false, isError: false, error: null, isRefetching: false, refetch: jest.fn() };
let mockMatchesState: Record<string, any> = { data: [], isLoading: false, isError: false, error: null, isRefetching: false, refetch: jest.fn() };
let mockSummaryState: Record<string, any> = { data: null, isLoading: false, isError: false, error: null, isRefetching: false, refetch: jest.fn() };

jest.mock('@/hooks/useAthleteStats', () => ({
  useAthleteSeasons: () => mockSeasonsState,
  useAthleteMatches: () => mockMatchesState,
  useAthleteStatSummary: () => mockSummaryState,
  useCreateAthleteSeason: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRecordAthleteMatch: () => ({ mutateAsync: jest.fn(), isPending: false })
}));
jest.mock('@/services/athleteStatsService', () => ({
  sportKeyFor: () => 'basketball',
  sportLabelFor: (sport: string) => sport,
  STRUCTURED_SPORTS: ['basketball'],
  SPORT_STAT_SCHEMAS: { basketball: [] }
}));

/* ── UserProfileScreen hooks ────────────────────────────────────────────── */
let mockProfileState: Record<string, any> = { data: null, isLoading: false, isError: false, isRefetching: false, refetch: jest.fn() };
let mockIsFollowingState: Record<string, any> = { data: false, isLoading: false, isError: false, refetch: jest.fn() };
let mockFollowRequestState: Record<string, any> = { data: null, isLoading: false, isError: false, refetch: jest.fn() };
let mockIsBlockedState: Record<string, any> = { data: false, isLoading: false, isError: false, refetch: jest.fn() };
let mockUserPostsState: Record<string, any> = { data: [], isLoading: false, isError: false, error: null, refetch: jest.fn() };
const mockToggleFollow = jest.fn();
const mockToggleBlock = jest.fn();

jest.mock('@/hooks/useProfile', () => ({
  useProfile: () => mockProfileState,
  useIsFollowing: () => mockIsFollowingState,
  useFollowRequestStatus: () => mockFollowRequestState,
  useIsBlocked: () => mockIsBlockedState,
  useToggleFollow: () => ({ mutate: mockToggleFollow, isPending: false }),
  useToggleBlock: () => ({ mutate: mockToggleBlock, isPending: false })
}));
jest.mock('@/hooks/useFeed', () => ({
  useUserPosts: () => mockUserPostsState
}));
jest.mock('@/components/profile/ProfileCover', () => ({
  ProfileCover: () => null
}));
jest.mock('@/services/reportService', () => ({
  reportService: { reportEntity: jest.fn() },
  reportReasons: ['Spam', 'Harassment']
}));
jest.mock('@/services/canonicalLinkService', () => ({
  shareCanonicalEntity: jest.fn()
}));
jest.mock('@/utils/format', () => ({
  compactNumber: (value: number) => String(value)
}));

// eslint-disable-next-line import/first
import { StoryViewerScreen } from '@/screens/feed/StoryViewerScreen';
// eslint-disable-next-line import/first
import { MatchHistoryScreen } from '@/screens/stats/MatchHistoryScreen';
// eslint-disable-next-line import/first
import { StatsEntryScreen } from '@/screens/stats/StatsEntryScreen';
// eslint-disable-next-line import/first
import { StructuredStatsPanel } from '@/components/profile/StructuredStatsPanel';
// eslint-disable-next-line import/first
import { UserProfileScreen } from '@/screens/profile/UserProfileScreen';

const profile = {
  id: 'target-id',
  username: 'target',
  displayName: 'Target Player',
  initials: 'TP',
  avatarUrl: null,
  coverUrl: null,
  bio: 'Bio',
  city: 'Bengaluru',
  country: 'India',
  primarySport: 'Basketball',
  sports: ['Basketball'],
  skillLevel: 'Intermediate',
  isOnline: false,
  isVerified: false,
  isPrivate: false,
  isHireable: false,
  badges: [],
  stats: { followers: 2, following: 3, posts: 1, winRate: 50, games: 2 }
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});
const renderUserProfile = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <UserProfileScreen />
    </QueryClientProvider>
  );

describe('StoryViewerScreen request failure states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute.params = { storyId: 'story-1' };
    mockStoriesState = { data: [], isLoading: false, isError: false, error: null, refetch: mockRefetchStories };
  });

  it('shows a retryable error instead of the unavailable-story business state', async () => {
    mockStoriesState = {
      data: [],
      isLoading: false,
      isError: true,
      error: new Error('Network down'),
      refetch: mockRefetchStories
    };

    await render(<StoryViewerScreen />);

    expect(screen.getByText('Could not load stories')).toBeTruthy();
    expect(screen.getByText('Network down')).toBeTruthy();
    expect(screen.queryByText('Story unavailable')).toBeNull();
    expect(screen.queryByText('This story is no longer available.')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Retry loading stories' }));
    expect(mockRefetchStories).toHaveBeenCalled();
  });

  it('shows a loading indicator while stories are fetching', async () => {
    mockStoriesState = {
      data: [],
      isLoading: true,
      isError: false,
      error: null,
      refetch: mockRefetchStories
    };

    const view = await render(<StoryViewerScreen />);

    expect(view.getByTestId('story-loading-indicator')).toBeTruthy();
    expect(screen.queryByText('Story unavailable')).toBeNull();
  });
});

describe('MatchHistoryScreen request failure states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute.params = {};
    mockSeasonsState = { data: [], isLoading: false, isError: false, error: null, isRefetching: false, refetch: jest.fn() };
    mockMatchesState = { data: [], isLoading: false, isError: false, error: null, isRefetching: false, refetch: jest.fn() };
  });

  it('shows an error state instead of "No matches recorded" when matches fail', async () => {
    mockSeasonsState = { data: [{ id: 's1', sport: 'basketball', label: '2026' }], isLoading: false, isError: false, error: null, isRefetching: false, refetch: jest.fn() };
    mockMatchesState = { data: [], isLoading: false, isError: true, error: new Error('Matches failed'), isRefetching: false, refetch: jest.fn() };

    await render(<MatchHistoryScreen />);

    expect(screen.getByText('Could not load this')).toBeTruthy();
    expect(screen.getByText('Matches failed')).toBeTruthy();
    expect(screen.queryByText('No matches recorded')).toBeNull();
  });

  it('shows an error state instead of the empty state when seasons fail', async () => {
    mockSeasonsState = { data: [], isLoading: false, isError: true, error: new Error('Seasons failed'), isRefetching: false, refetch: jest.fn() };
    mockMatchesState = { data: [], isLoading: false, isError: false, error: null, isRefetching: false, refetch: jest.fn() };

    await render(<MatchHistoryScreen />);

    expect(screen.getByText('Could not load this')).toBeTruthy();
    expect(screen.queryByText('No matches recorded')).toBeNull();
  });
});

describe('StatsEntryScreen request failure states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute.params = {};
    mockSeasonsState = { data: [], isLoading: false, isError: false, error: null, isRefetching: false, refetch: jest.fn() };
  });

  it('shows an error state and does not auto-open the season form when seasons fail', async () => {
    mockSeasonsState = { data: [], isLoading: false, isError: true, error: new Error('Seasons failed'), isRefetching: false, refetch: jest.fn() };

    await render(<StatsEntryScreen />);

    expect(screen.getByText('Could not load this')).toBeTruthy();
    expect(screen.getByText('Seasons failed')).toBeTruthy();
    expect(screen.queryByText(/New Basketball Season/)).toBeNull();
  });
});

describe('StructuredStatsPanel request failure states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSeasonsState = { data: [], isLoading: false, isError: false, error: null, isRefetching: false, refetch: jest.fn() };
    mockSummaryState = { data: null, isLoading: false, isError: false, error: null, isRefetching: false, refetch: jest.fn() };
  });

  it('shows an error instead of the create-season empty state when seasons fail', async () => {
    mockSeasonsState = { data: [], isLoading: false, isError: true, error: new Error('Seasons failed'), isRefetching: false, refetch: jest.fn() };

    await render(<StructuredStatsPanel profile={profile} />);

    expect(screen.getByText('Could not load this')).toBeTruthy();
    expect(screen.queryByText(/Create a basketball season/)).toBeNull();
    expect(screen.queryByText(/No structured statistics/)).toBeNull();
  });

  it('shows an error instead of a stats summary when the summary fails', async () => {
    mockSeasonsState = { data: [{ id: 's1', sport: 'basketball', label: '2026' }], isLoading: false, isError: false, error: null, isRefetching: false, refetch: jest.fn() };
    mockSummaryState = { data: null, isLoading: false, isError: true, error: new Error('Summary failed'), isRefetching: false, refetch: jest.fn() };

    await render(<StructuredStatsPanel profile={profile} />);

    expect(screen.getByText('Could not load this')).toBeTruthy();
    expect(screen.queryByText('SELF-REPORTED')).toBeNull();
  });
});

describe('UserProfileScreen request failure states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute.params = { userId: 'target-id' };
    mockProfileState = { data: profile, isLoading: false, isError: false, isRefetching: false, refetch: jest.fn() };
    mockIsFollowingState = { data: false, isLoading: false, isError: false, refetch: jest.fn() };
    mockFollowRequestState = { data: null, isLoading: false, isError: false, refetch: jest.fn() };
    mockIsBlockedState = { data: false, isLoading: false, isError: false, refetch: jest.fn() };
    mockUserPostsState = { data: [], isLoading: false, isError: false, error: null, refetch: jest.fn() };
  });

  it('disables follow and message while relationship state is loading', async () => {
    mockIsFollowingState = { data: false, isLoading: true, isError: false, refetch: jest.fn() };
    mockFollowRequestState = { data: null, isLoading: true, isError: false, refetch: jest.fn() };
    mockIsBlockedState = { data: false, isLoading: true, isError: false, refetch: jest.fn() };

    await renderUserProfile();

    const follow = screen.getByRole('button', { name: 'Follow' });
    const message = screen.getByRole('button', { name: 'Message' });
    expect(follow.props.accessibilityState?.disabled).toBe(true);
    expect(message.props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(follow);
    expect(mockToggleFollow).not.toHaveBeenCalled();
  });

  it('disables follow and message when a relationship query errors', async () => {
    mockIsBlockedState = { data: false, isLoading: false, isError: true, error: new Error('Block check failed'), refetch: jest.fn() };

    await renderUserProfile();

    const follow = screen.getByRole('button', { name: 'Follow' });
    const message = screen.getByRole('button', { name: 'Message' });
    expect(follow.props.accessibilityState?.disabled).toBe(true);
    expect(message.props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(follow);
    expect(mockToggleFollow).not.toHaveBeenCalled();
  });

  it('shows a retryable error instead of "No posts shared yet" when posts fail', async () => {
    mockUserPostsState = { data: [], isLoading: false, isError: true, error: new Error('Posts failed'), refetch: jest.fn() };

    await renderUserProfile();

    expect(screen.getByText('Could not load this')).toBeTruthy();
    expect(screen.getByText('Posts failed')).toBeTruthy();
    expect(screen.queryByText('No posts shared yet.')).toBeNull();
  });

  it('shows an error instead of "No stats posts yet" on the highlights tab', async () => {
    mockUserPostsState = { data: [], isLoading: false, isError: true, error: new Error('Posts failed'), refetch: jest.fn() };

    await renderUserProfile();
    fireEvent.press(screen.getByText('Highlights'));

    expect(screen.getByText('Could not load this')).toBeTruthy();
    expect(screen.queryByText('No stats posts yet')).toBeNull();
  });
});

