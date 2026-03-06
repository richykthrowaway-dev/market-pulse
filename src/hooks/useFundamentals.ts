import { useQuery } from '@tanstack/react-query';

interface UseFundamentalsParams {
  ticker: string;
  exchange: string;
}

export function useFundamentals({ ticker, exchange }: UseFundamentalsParams) {
  return useQuery({
    queryKey: ['fundamentals', ticker, exchange],
    queryFn: async () => {
      const params = new URLSearchParams({ ticker, exchange });
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-fundamentals?${params}`;
      const res = await fetch(url, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      if (!res.ok) throw new Error('Fundamentals fetch failed');
      return res.json();
    },
    enabled: !!ticker && !!exchange,
    staleTime: 3_600_000,
  });
}
