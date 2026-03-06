import { useQuery } from '@tanstack/react-query';
import { autocompleteSearch, type AutocompleteResult } from '@/services/searchService';
import { useState, useEffect } from 'react';

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useAutocomplete(query: string) {
  const debounced = useDebounce(query, 120);

  return useQuery<AutocompleteResult[]>({
    queryKey: ['autocomplete', debounced],
    queryFn: () => autocompleteSearch(debounced, 8),
    enabled: debounced.length >= 1,
    staleTime: 30_000,
    placeholderData: (prev) => prev, // keep previous results while loading
  });
}
