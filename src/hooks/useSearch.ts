import { useQuery } from '@tanstack/react-query';

import { searchService } from '@/services/searchService';

export const useSearch = (query: string) =>
  useQuery({
    queryKey: ['search', query],
    queryFn: () => searchService.search(query)
  });
