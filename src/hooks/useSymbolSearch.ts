import { useQuery } from '@tanstack/react-query';
import { searchSymbols } from '@/services/symbolsService';

export function useSymbolSearch(query: string) {
  return useQuery({
    queryKey: ['symbol-search', query],
    queryFn: () => searchSymbols(query, 10),
    enabled: query.length >= 2,
    staleTime: 60_000,
  });
}
