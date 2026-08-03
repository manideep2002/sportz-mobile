/**
 * usePlayerSearch
 *
 * Shared debounced, cancellable player search used by every player-search
 * surface in the app (CreatePostScreen tag picker, NewMessageScreen,
 * GroupDetailScreen invite modal, ManageEventScreen invite flow, and
 * FindPlayersScreen browsing).
 *
 * Guarantees:
 *  - Stable query keys: every distinct (sport, query, page) combination maps to
 *    exactly one query key, so react-query caches each search independently and
 *    a slower old response can never replace a newer query's results.
 *  - Debounce: keystrokes are debounced (default 250ms) before any request.
 *  - Minimum query: queries shorter than `minQueryLength` are cleared
 *    immediately and never fetch.
 *  - Abort: the in-flight supabase request is aborted via AbortSignal when a
 *    newer query supersedes it or the consumer unmounts.
 *  - States: `isLoading` (initial fetch of the current key), `isFetching` (any
 *    request in flight), `isError`/`error`, and `retry` to refetch.
 *  - Duplicate avoidance: `excludeIds` filters already-selected players out of
 *    the results without triggering a refetch.
 *  - Optional pagination: with `pageSize` set, `hasMore`/`loadMore` accumulate
 *    pages, keeping previous page data visible while the next page loads.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { profileService } from '@/services/profileService';
import type { Sport, UserProfile } from '@/types/domain';

export const PLAYER_SEARCH_DEBOUNCE_MS = 250;
export const PLAYER_SEARCH_MIN_QUERY_LENGTH = 1;

export const playerSearchKeys = {
  all: ['player-search'] as const,
  list: (sport: Sport | undefined, query: string, page: number) =>
    ['player-search', 'list', sport ?? 'all', query, page] as const
};

export interface UsePlayerSearchOptions {
  /** Minimum query length that triggers a search (default 1). Use 0 to allow empty-query browsing. */
  minQueryLength?: number;
  /** Debounce delay in ms (default 250). */
  debounceMs?: number;
  /** Page size for paginated browsing; omit for single-shot searches. */
  pageSize?: number;
  /** Sport filter (undefined = all sports). */
  sport?: Sport | undefined;
  /** IDs to exclude from results (already selected/tagged/invited players). */
  excludeIds?: ReadonlySet<string> | null;
}

export function usePlayerSearch(options: UsePlayerSearchOptions = {}) {
  const {
    minQueryLength = PLAYER_SEARCH_MIN_QUERY_LENGTH,
    debounceMs = PLAYER_SEARCH_DEBOUNCE_MS,
    pageSize,
    sport,
    excludeIds
  } = options;

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<UserProfile[]>([]);

  // Debounce + minimum-query: below the minimum the effective query clears
  // immediately so stale results never linger.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < minQueryLength) {
      setDebouncedQuery('');
      return;
    }
    const timer = setTimeout(() => setDebouncedQuery(trimmed), debounceMs);
    return () => clearTimeout(timer);
  }, [debounceMs, minQueryLength, query]);

  // A new effective query or sport starts a fresh search at page 0.
  useEffect(() => {
    setPage(0);
    setItems([]);
  }, [debouncedQuery, sport]);

  const enabled = debouncedQuery.length >= minQueryLength;

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: playerSearchKeys.list(sport, debouncedQuery, page),
    queryFn: ({ signal }: { signal?: AbortSignal } = {}) =>
      profileService.listPlayers(debouncedQuery, sport, page, pageSize, signal),
    enabled,
    retry: false,
    // Keep the previous page of the SAME sport+query visible while the next
    // page loads, but never reuse data from a different query.
    placeholderData: (previousData, previousQuery) => {
      if (page === 0 || !previousData || !previousQuery) return undefined;
      const expected = playerSearchKeys.list(sport, debouncedQuery, page - 1);
      const previous = previousQuery.queryKey as readonly (string | number)[];
      const sameQuery =
        previous.length === expected.length &&
        previous.every((entry, index) => entry === expected[index]);
      return sameQuery ? previousData : undefined;
    }
  });

  // Accumulate pages for paginated browsing; page 0 replaces the list.
  useEffect(() => {
    if (!data) return;
    setItems((old) => {
      if (page === 0) return data;
      const seen = new Set(old.map((player) => player.id));
      return [...old, ...data.filter((player) => !seen.has(player.id))];
    });
  }, [data, page]);

  const results = useMemo(
    () => (excludeIds ? items.filter((player) => !excludeIds.has(player.id)) : items),
    [excludeIds, items]
  );

  const hasMore = Boolean(pageSize && data && data.length === pageSize);

  const loadMore = () => {
    if (hasMore && !isFetching) setPage((current) => current + 1);
  };

  return {
    query,
    setQuery,
    results,
    isLoading: isPending && isFetching,
    isFetching,
    isError,
    error,
    retry: () => refetch(),
    hasMore,
    loadMore
  };
}
