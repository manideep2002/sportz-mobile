/**
 * Tests for P1-10 search fixes:
 *  - Court navigation
 *  - Error versus empty
 *  - Debounce and request race
 *  - Unicode and PostgREST-special characters
 *  - Filtered pagination
 *  - Privacy/block filtering (server-side)
 */

import { fireEvent, render, act } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mock variables
// ---------------------------------------------------------------------------

const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockFetchNextPage = jest.fn();
const mockRefetch = jest.fn();

// ---------------------------------------------------------------------------
// jest.mock registrations
// ---------------------------------------------------------------------------

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args)
  }
}));

jest.mock('@/lib/env', () => ({
  env: { isSupabaseConfigured: true }
}));

jest.mock('@/components/ui', () => require('@/test/mockUi'));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: {} })
}));

jest.mock('@/design/ThemeProvider', () => ({
  useAppTheme: () => ({ colors: { accent: '#3b82d4', border: '#e5e7eb', background: '#000' } })
}));

jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));

jest.mock('@/hooks/useSearch', () => ({
  useSearch: jest.fn(),
  useTrendingTags: () => ({ data: [], isRefetching: false, refetch: jest.fn() })
}));


// ---------------------------------------------------------------------------
// Imports of modules under test
// ---------------------------------------------------------------------------

// eslint-disable-next-line import/first
import { searchService } from '@/services/searchService';
// eslint-disable-next-line import/first
import { SearchScreen } from '@/screens/feed/SearchScreen';
// eslint-disable-next-line import/first
import { useSearch } from '@/hooks/useSearch';

const mockedUseSearch = useSearch as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SearchItem = { id: string; type: string; title: string; subtitle: string; skillLevel?: string };

function makeRpcRow(id: string, type: string, title: string, subtitle: string, skill_level: string | null = 'Intermediate') {
  return { id, type, title, subtitle, skill_level };
}

function makeRpcResponse(rows: ReturnType<typeof makeRpcRow>[] = [makeRpcRow('row-1', 'player', 'Alice', 'Basketball - Bengaluru')]) {
  return { data: rows, error: null };
}

function makeSearchState(
  items: SearchItem[],
  opts: { hasMore?: boolean; isFetching?: boolean; isError?: boolean; error?: Error | null } = {}
) {
  const hasMore = opts.hasMore ?? false;
  return {
    data: opts.isFetching || opts.isError
      ? undefined
      : { pages: [{ items, hasMore }], pageParams: [0] },
    isFetching: opts.isFetching ?? false,
    isFetchingNextPage: false,
    isError: opts.isError ?? false,
    error: opts.error ?? null,
    refetch: mockRefetch,
    fetchNextPage: mockFetchNextPage,
    hasNextPage: hasMore
  };
}

function setResults(items: SearchItem[], hasMore = false) {
  mockedUseSearch.mockImplementation(() => makeSearchState(items, { hasMore }));
}

function setLoading() {
  mockedUseSearch.mockImplementation(() => makeSearchState([], { isFetching: true }));
}

function setError(message: string) {
  mockedUseSearch.mockImplementation(() =>
    makeSearchState([], { isError: true, error: new Error(message) })
  );
}

// ---------------------------------------------------------------------------
// Unit: searchService.search
// ---------------------------------------------------------------------------

describe('searchService.search', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls search_content RPC with correct parameters', async () => {
    mockRpc.mockResolvedValue(makeRpcResponse());
    await searchService.search('tennis', 'court', 0, 20);
    expect(mockRpc).toHaveBeenCalledWith('search_content', {
      search_query: 'tennis',
      filter_type: 'court',
      result_limit: 21,
      result_offset: 0
    });
  });

  it('passes null filter_type when undefined is given', async () => {
    mockRpc.mockResolvedValue(makeRpcResponse());
    await searchService.search('foo', undefined, 0, 20);
    expect(mockRpc).toHaveBeenCalledWith(
      'search_content',
      expect.objectContaining({ filter_type: null })
    );
  });

  it('detects hasMore when rows exceed page size', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => makeRpcRow(`row-${i}`, 'player', `Player ${i}`, 'sub'));
    mockRpc.mockResolvedValue({ data: rows, error: null });
    const page = await searchService.search('tennis', undefined, 0, 20);
    expect(page.hasMore).toBe(true);
    expect(page.items).toHaveLength(20);
    expect(page.nextOffset).toBe(20);
  });

  it('hasMore is false when rows do not exceed page size', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => makeRpcRow(`row-${i}`, 'player', `P${i}`, 'sub'));
    mockRpc.mockResolvedValue({ data: rows, error: null });
    const page = await searchService.search('tennis', undefined, 0, 20);
    expect(page.hasMore).toBe(false);
  });

  it('does NOT interpolate user input into query strings (injection safety)', async () => {
    mockRpc.mockResolvedValue(makeRpcResponse([]));
    await searchService.search("50%_off(ilike.hack,')", undefined, 0, 20);
    const callArgs = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(callArgs[0]).toBe('search_content');
    // Raw string must be a bind parameter, not a pre-built .or() pattern
    expect(callArgs[1].search_query).toBe("50%_off(ilike.hack,')");
    // supabase.from() .or() must NOT be used
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('handles Unicode queries without throwing', async () => {
    mockRpc.mockResolvedValue(makeRpcResponse([]));
    await expect(
      searchService.search('クリケット 🏏 Ünïcödé', undefined, 0, 20)
    ).resolves.toMatchObject({ items: [], hasMore: false });
  });

  it('throws on RPC error instead of returning empty results', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Database error', code: '500' } });
    await expect(searchService.search('foo', undefined, 0, 20)).rejects.toMatchObject({
      message: 'Database error'
    });
  });

  it('maps skill_level from RPC row', async () => {
    mockRpc.mockResolvedValue(makeRpcResponse([makeRpcRow('r-1', 'player', 'Alice', 'sub', 'Advanced')]));
    const page = await searchService.search('Alice', 'player', 0, 20);
    expect(page.items[0].skillLevel).toBe('Advanced');
  });

  it('omits skillLevel when skill_level is null', async () => {
    mockRpc.mockResolvedValue(makeRpcResponse([makeRpcRow('r-1', 'event', 'Match', 'sub', null)]));
    const page = await searchService.search('match', 'event', 0, 20);
    expect(page.items[0]).not.toHaveProperty('skillLevel');
  });

  it('supports pagination via offset', async () => {
    mockRpc.mockResolvedValue(makeRpcResponse([makeRpcRow('row-21', 'player', 'Z', 'sub')]));
    await searchService.search('tennis', undefined, 20, 20);
    expect(mockRpc).toHaveBeenCalledWith(
      'search_content',
      expect.objectContaining({ result_offset: 20 })
    );
  });

  it('does not call supabase.from("blocks") — block filtering is server-side', async () => {
    mockRpc.mockResolvedValue(makeRpcResponse([]));
    await searchService.search('foo', undefined, 0, 20);
    const fromCalls = mockFrom.mock.calls.map((c: unknown[]) => c[0]);
    expect(fromCalls).not.toContain('blocks');
  });
});

// ---------------------------------------------------------------------------
// SearchScreen integration
// ---------------------------------------------------------------------------

describe('SearchScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setResults([]);
    mockFetchNextPage.mockReset();
    mockRefetch.mockReset();
  });

  // ------------------------------------------------------------------
  // Court navigation
  // ------------------------------------------------------------------

  it('navigates to CourtDetail when a court result is pressed', async () => {
    setResults([{ id: 'court-42', type: 'court', title: 'Metro Arena', subtitle: 'Basketball - Bengaluru' }]);
    const { getByText } = await render(<SearchScreen />);
    expect(getByText('Metro Arena')).toBeTruthy();
    fireEvent.press(getByText('Metro Arena'));
    expect(mockNavigate).toHaveBeenCalledWith('CourtDetail', { courtId: 'court-42' });
    expect(mockNavigate).not.toHaveBeenCalledWith('Courts');
  });

  it('navigates to UserProfile for player results', async () => {
    setResults([{ id: 'player-1', type: 'player', title: 'Alice', subtitle: 'Basketball - BLR' }]);
    const { getByText } = await render(<SearchScreen />);
    fireEvent.press(getByText('Alice'));
    expect(mockNavigate).toHaveBeenCalledWith('UserProfile', { userId: 'player-1' });
  });

  it('navigates to EventDetail for event results', async () => {
    setResults([{ id: 'event-5', type: 'event', title: 'Sunday Pickup', subtitle: 'Pickup - Basketball' }]);
    const { getByText } = await render(<SearchScreen />);
    fireEvent.press(getByText('Sunday Pickup'));
    expect(mockNavigate).toHaveBeenCalledWith('EventDetail', { eventId: 'event-5' });
  });

  it('navigates to GroupDetail for group results', async () => {
    setResults([{ id: 'grp-1', type: 'group', title: 'Hoops Crew', subtitle: 'Basketball - BLR' }]);
    const { getByText } = await render(<SearchScreen />);
    fireEvent.press(getByText('Hoops Crew'));
    expect(mockNavigate).toHaveBeenCalledWith('GroupDetail', { communityId: 'grp-1' });
  });

  it('navigates to PageDetail for page results', async () => {
    setResults([{ id: 'page-2', type: 'page', title: 'Nike India', subtitle: 'Basketball - BLR' }]);
    const { getByText } = await render(<SearchScreen />);
    fireEvent.press(getByText('Nike India'));
    expect(mockNavigate).toHaveBeenCalledWith('PageDetail', { communityId: 'page-2' });
  });

  // ------------------------------------------------------------------
  // Error vs empty
  // ------------------------------------------------------------------

  it('shows error message and retry button on API failure, not empty state', async () => {
    setError('Network error');
    const { queryByText } = await render(<SearchScreen />);
    expect(queryByText(/Network error/i)).not.toBeNull();
    expect(queryByText(/Retry/i)).not.toBeNull();
    expect(queryByText(/No results match/i)).toBeNull();
  });

  it('shows empty state when server returned no rows', async () => {
    setResults([]);
    const { queryByText } = await render(<SearchScreen />);
    expect(queryByText(/No results match/i)).not.toBeNull();
  });

  it('does not show empty state while loading', async () => {
    setLoading();
    const { queryByText } = await render(<SearchScreen />);
    expect(queryByText(/No results match/i)).toBeNull();
  });

  it('does not show empty state on error', async () => {
    setError('Something failed');
    const { queryByText } = await render(<SearchScreen />);
    expect(queryByText(/No results match/i)).toBeNull();
  });

  // ------------------------------------------------------------------
  // Filter chip passes type to useSearch
  // ------------------------------------------------------------------

  it('passes the selected filter type to useSearch when a chip is pressed', async () => {
    setResults([]);
    const { getByText } = await render(<SearchScreen />);
    expect(mockedUseSearch).toHaveBeenCalledWith('', undefined);
    await act(async () => { fireEvent.press(getByText('Courts')); });
    expect(mockedUseSearch).toHaveBeenCalledWith('', 'court');
  });

  it('passes undefined filter when All chip is selected after another chip', async () => {
    setResults([]);
    const { getByText } = await render(<SearchScreen />);
    await act(async () => { fireEvent.press(getByText('Players')); });
    await act(async () => { fireEvent.press(getByText('All')); });
    const lastCall = mockedUseSearch.mock.calls.at(-1) as [string, unknown];
    expect(lastCall[1]).toBeUndefined();
  });

  // ------------------------------------------------------------------
  // Pagination
  // ------------------------------------------------------------------

  it('shows Load-more button when hasMore is true', async () => {
    setResults([{ id: 'r-1', type: 'court', title: 'Court A', subtitle: 'sub' }], true);
    const { queryByText } = await render(<SearchScreen />);
    expect(queryByText('Load more results')).not.toBeNull();
  });

  it('does not show Load-more button when hasMore is false', async () => {
    setResults([{ id: 'r-1', type: 'court', title: 'Court A', subtitle: 'sub' }], false);
    const { queryByText } = await render(<SearchScreen />);
    expect(queryByText('Load more results')).toBeNull();
  });

  it('calls fetchNextPage when Load-more is pressed', async () => {
    setResults([{ id: 'r-1', type: 'court', title: 'Court A', subtitle: 'sub' }], true);
    const { getByText } = await render(<SearchScreen />);
    fireEvent.press(getByText('Load more results'));
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('deduplicates results that overlap page boundaries', async () => {
    const page1Items: SearchItem[] = Array.from({ length: 20 }, (_, i) => ({
      id: `r-${i}`, type: 'player', title: `Player ${i}`, subtitle: ''
    }));
    const page2Items: SearchItem[] = [
      { id: 'r-19', type: 'player', title: 'Player 19 DUP', subtitle: '' },
      { id: 'r-20', type: 'player', title: 'Player 20', subtitle: '' }
    ];
    mockedUseSearch.mockImplementation(() => ({
      data: {
        pages: [
          { items: page1Items, hasMore: true },
          { items: page2Items, hasMore: false }
        ],
        pageParams: [0, 20]
      },
      isFetching: false,
      isFetchingNextPage: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
      fetchNextPage: mockFetchNextPage,
      hasNextPage: false
    }));
    const { queryAllByText } = await render(<SearchScreen />);

    // r-19 from page 1 is used; the duplicate from page 2 is suppressed
    expect(queryAllByText('Player 19 DUP')).toHaveLength(0);
    expect(queryAllByText('Player 19')).toHaveLength(1);
    // r-20 from page 2 appears exactly once
    expect(queryAllByText('Player 20')).toHaveLength(1);
  });

  // ------------------------------------------------------------------
  // Privacy / block filtering: server-side only
  // ------------------------------------------------------------------

  it('does not call supabase.from("blocks") — block filtering is server-side', async () => {
    setResults([]);
    await render(<SearchScreen />);
    const fromCalls = mockFrom.mock.calls.map((c: unknown[]) => c[0]);
    expect(fromCalls).not.toContain('blocks');
  });

  it('renders results as-is without client-side block filtering', async () => {
    setResults([{ id: 'user-x', type: 'player', title: 'Some Player', subtitle: 'Basketball' }]);
    const { queryByText } = await render(<SearchScreen />);
    // Screen trusts the server to have filtered blocked users
    expect(queryByText('Some Player')).not.toBeNull();
  });
});
