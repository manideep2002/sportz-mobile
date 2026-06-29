import { useQuery } from '@tanstack/react-query';

import { useDebounce } from '@/hooks/useDebounce';
import { searchService } from '@/services/searchService';

export const useSearch = (query: string) => {
  const debouncedQuery = useDebounce(query, 300);

  return useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchService.search(debouncedQuery)
  });
};

export const useTrendingTags = () =>
  useQuery({
    queryKey: ['search', 'trending-tags'],
    queryFn: () => searchService.getTrending()
  });
