import { useCallback, useRef } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useDebounce } from '@/hooks/useDebounce';
import { searchService, SEARCH_PAGE_SIZE } from '@/services/searchService';
import type { SearchResult } from '@/types/domain';

/**
 * Search hook.
 *
 * - Debounces the raw query before firing any requests.
 * - Uses useInfiniteQuery so pagination is handled by react-query.
 * - Changing the debounced query or filter type resets to page 0.
 * - Stale data from a previous query is never surfaced as new results
 *   because react-query re-runs from the first page whenever the key changes.
 * - A generation counter prevents out-of-order responses from overwriting
 *   the latest result when a concurrent refetch is in flight (belt-and-suspenders
 *   on top of react-query's built-in deduplication).
 */
export const useSearch = (
  query: string,
  filterType?: SearchResult['type']
) => {
  const debouncedQuery = useDebounce(query, 300);
  // Track the current "generation" so stale concurrent fetches are ignored.
  const generationRef = useRef(0);

  const fetch = useCallback(
    async ({ pageParam = 0 }: { pageParam?: number }) => {
      const generation = ++generationRef.current;
      const page = await searchService.search(
        debouncedQuery,
        filterType,
        pageParam as number,
        SEARCH_PAGE_SIZE
      );
      // If a newer fetch already started, throw so react-query discards this result.
      if (generation !== generationRef.current) {
        throw new Error('stale');
      }
      return page;
    },
    [debouncedQuery, filterType]
  );

  return useInfiniteQuery({
    queryKey: ['search', debouncedQuery, filterType ?? null],
    queryFn: fetch,
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextOffset : undefined,
    retry: (failureCount, error) => {
      // Don't retry stale-request sentinel errors.
      if (error instanceof Error && error.message === 'stale') return false;
      return failureCount < 2;
    }
  });
};

export const useTrendingTags = () =>
  useQuery({
    queryKey: ['search', 'trending-tags'],
    queryFn: () => searchService.getTrending()
  });
