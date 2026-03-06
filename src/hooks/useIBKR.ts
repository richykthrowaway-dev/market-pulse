import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function ibkrFetch(endpoint: string, method = 'GET', body?: unknown) {
  const params = new URLSearchParams({ endpoint });
  const url = `${SUPABASE_URL}/functions/v1/api-ibkr?${params}`;
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json',
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error('IBKR request failed');
  const data = await res.json();
  // Graceful degradation: return null for gateway errors instead of throwing
  if (data?.error) {
    console.warn('IBKR gateway:', data.error);
    return null;
  }
  return data;
}

/** Check IBKR auth/session status */
export function useIBKRAuthStatus() {
  return useQuery({
    queryKey: ['ibkr', 'auth-status'],
    queryFn: () => ibkrFetch('/v1/api/iserver/auth/status'),
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}

/** Keep session alive */
export function useIBKRTickle() {
  return useQuery({
    queryKey: ['ibkr', 'tickle'],
    queryFn: () => ibkrFetch('/v1/api/tickle', 'POST'),
    staleTime: 50_000,
    refetchInterval: 55_000,
  });
}

/** Portfolio accounts */
export function useIBKRAccounts() {
  return useQuery({
    queryKey: ['ibkr', 'accounts'],
    queryFn: () => ibkrFetch('/v1/api/portfolio/accounts'),
    staleTime: 60_000,
  });
}

/** Portfolio positions for a given account */
export function useIBKRPositions(accountId: string) {
  return useQuery({
    queryKey: ['ibkr', 'positions', accountId],
    queryFn: () => ibkrFetch(`/v1/api/portfolio/positions/${accountId}`),
    enabled: !!accountId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/** Account P&L */
export function useIBKRPnL() {
  return useQuery({
    queryKey: ['ibkr', 'pnl'],
    queryFn: () => ibkrFetch('/v1/api/iserver/account/pnl/partitioned'),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/** Portfolio summary (NLV, buying power, etc.) */
export function useIBKRPortfolioSummary(accountId: string) {
  return useQuery({
    queryKey: ['ibkr', 'portfolio-summary', accountId],
    queryFn: () => ibkrFetch(`/v1/api/portfolio/summary`),
    enabled: !!accountId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** Live orders */
export function useIBKROrders() {
  return useQuery({
    queryKey: ['ibkr', 'orders'],
    queryFn: () => ibkrFetch('/v1/api/iserver/account/orders'),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

/** Recent trades */
export function useIBKRTrades() {
  return useQuery({
    queryKey: ['ibkr', 'trades'],
    queryFn: () => ibkrFetch('/v1/api/iserver/account/trades'),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/** Contract search */
export function useIBKRContractSearch(symbol: string) {
  return useQuery({
    queryKey: ['ibkr', 'contract-search', symbol],
    queryFn: () => ibkrFetch('/v1/api/iserver/contract/search', 'POST', { symbol }),
    enabled: !!symbol && symbol.length >= 1,
    staleTime: 300_000,
  });
}

/** Market data snapshot */
export function useIBKRSnapshot(conids: number[]) {
  return useQuery({
    queryKey: ['ibkr', 'snapshot', conids],
    queryFn: () => {
      const params = new URLSearchParams({
        endpoint: '/v1/api/iserver/marketdata/snapshot',
        conids: conids.join(','),
        fields: '31,84,85,86,88',
      });
      const url = `${SUPABASE_URL}/functions/v1/api-ibkr?${params}`;
      return fetch(url, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      }).then((r) => r.json());
    },
    enabled: conids.length > 0,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

/** Historical market data */
export function useIBKRHistory(conid: number, period = '1d', bar = '5min') {
  return useQuery({
    queryKey: ['ibkr', 'history', conid, period, bar],
    queryFn: () => {
      const params = new URLSearchParams({
        endpoint: '/v1/api/iserver/marketdata/history',
        conid: String(conid),
        period,
        bar,
      });
      const url = `${SUPABASE_URL}/functions/v1/api-ibkr?${params}`;
      return fetch(url, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      }).then((r) => r.json());
    },
    enabled: conid > 0,
    staleTime: 30_000,
  });
}

/** Place order */
export function useIBKRPlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      accountId,
      orders,
    }: {
      accountId: string;
      orders: Array<{
        conid: number;
        orderType: string;
        side: string;
        quantity: number;
        price?: number;
        tif: string;
      }>;
    }) => {
      return ibkrFetch(`/v1/api/iserver/account/${accountId}/orders`, 'POST', { orders });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ibkr', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['ibkr', 'positions'] });
    },
  });
}

/** Cancel order */
export function useIBKRCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ accountId, orderId }: { accountId: string; orderId: string }) => {
      return ibkrFetch(`/v1/api/iserver/account/${accountId}/order/${orderId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ibkr', 'orders'] });
    },
  });
}
