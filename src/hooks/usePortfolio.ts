import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-portfolio`;
      const res = await fetch(url, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        if (res.status === 401) return [];
        throw new Error('Portfolio fetch failed');
      }
      return res.json();
    },
    staleTime: 30_000,
  });
}

interface AddHoldingParams {
  ticker: string;
  exchange: string;
  shares: number;
  avgCostBasis: number;
  purchaseDate: string;
  notes?: string;
}

export function useAddHolding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AddHoldingParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-portfolio`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add holding');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
}
