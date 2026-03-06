import { useQuery } from '@tanstack/react-query';

interface UseFinancialsParams {
  ticker: string;
  exchange: string;
  type: 'income' | 'balance' | 'cashflow';
  period: 'annual' | 'quarterly';
}

export function useFinancials({ ticker, exchange, type, period }: UseFinancialsParams) {
  return useQuery({
    queryKey: ['financials', ticker, exchange, type, period],
    queryFn: async () => {
      const params = new URLSearchParams({ ticker, exchange, type, period });
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-financials?${params}`;
      const res = await fetch(url, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      if (!res.ok) throw new Error('Financials fetch failed');
      return res.json();
    },
    enabled: !!ticker && !!exchange,
    staleTime: 3_600_000,
  });
}
