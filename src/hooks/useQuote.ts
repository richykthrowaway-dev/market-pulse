import { useQuery } from '@tanstack/react-query';
import { requestQuote } from '@/services/batchQuoteService';
import { QUERY_CONFIG } from '@/config/queryDefaults';

interface UseQuoteParams {
  ticker: string;
  exchange: string;
}

export function useQuote({ ticker, exchange }: UseQuoteParams) {
  return useQuery({
    queryKey: ['quote', ticker, exchange],
    queryFn: () => requestQuote(ticker, exchange),
    enabled: !!ticker && !!exchange,
    ...QUERY_CONFIG.quotes,
  });
}
