import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FxRate {
  usdRate: number;      // units of this currency per 1 USD
  marketRate: number;   // raw Yahoo market convention rate
  change: number;       // daily change in market convention
  changePct: number;    // daily change % in market convention
  symbol: string;       // Yahoo symbol (e.g., "EURUSD=X")
}

export interface FxRatesResponse {
  rates: Record<string, FxRate>;
  timestamp: number;
}

// Currency metadata for display
export const CURRENCIES: Record<string, { name: string; symbol: string }> = {
  USD: { name: 'US Dollar', symbol: '$' },
  EUR: { name: 'Euro', symbol: '\u20AC' },
  GBP: { name: 'British Pound', symbol: '\u00A3' },
  JPY: { name: 'Japanese Yen', symbol: '\u00A5' },
  CAD: { name: 'Canadian Dollar', symbol: 'C$' },
  AUD: { name: 'Australian Dollar', symbol: 'A$' },
  CHF: { name: 'Swiss Franc', symbol: 'Fr' },
  CNY: { name: 'Chinese Yuan', symbol: '\u00A5' },
  HKD: { name: 'Hong Kong Dollar', symbol: 'HK$' },
  KRW: { name: 'South Korean Won', symbol: '\u20A9' },
  INR: { name: 'Indian Rupee', symbol: '\u20B9' },
  BRL: { name: 'Brazilian Real', symbol: 'R$' },
  SGD: { name: 'Singapore Dollar', symbol: 'S$' },
  MXN: { name: 'Mexican Peso', symbol: 'Mex$' },
  NZD: { name: 'New Zealand Dollar', symbol: 'NZ$' },
  SEK: { name: 'Swedish Krona', symbol: 'kr' },
  NOK: { name: 'Norwegian Krone', symbol: 'kr' },
  DKK: { name: 'Danish Krone', symbol: 'kr' },
  ZAR: { name: 'South African Rand', symbol: 'R' },
  TRY: { name: 'Turkish Lira', symbol: '\u20BA' },
};

// Popular pairs for the display grid (market convention)
export const POPULAR_PAIRS = [
  { from: 'EUR', to: 'USD' },
  { from: 'GBP', to: 'USD' },
  { from: 'USD', to: 'JPY' },
  { from: 'USD', to: 'CAD' },
  { from: 'AUD', to: 'USD' },
  { from: 'USD', to: 'CHF' },
  { from: 'NZD', to: 'USD' },
  { from: 'USD', to: 'CNY' },
];

async function fetchFxRates(): Promise<FxRatesResponse> {
  const { data, error } = await supabase.functions.invoke('api-fx-rates');
  if (error) throw error;
  return data as FxRatesResponse;
}

/**
 * Hook that fetches all major FX rates in a single API call.
 * Returns rates map and a convert() function for instant cross-rate conversion.
 *
 * Cached for 5 minutes — FX moves slowly and this avoids redundant calls.
 */
export function useCurrencyRates() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['fx-rates'],
    queryFn: fetchFxRates,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 2,
  });

  const rates = data?.rates ?? {};

  /**
   * Convert an amount from one currency to another using cached USD cross-rates.
   * Formula: amount * rate[to] / rate[from]
   */
  const convert = useCallback(
    (amount: number, from: string, to: string): number | null => {
      const fromRate = rates[from]?.usdRate;
      const toRate = rates[to]?.usdRate;
      if (fromRate == null || toRate == null || fromRate === 0) return null;
      return amount * toRate / fromRate;
    },
    [rates],
  );

  /**
   * Get the direct exchange rate from one currency to another.
   */
  const getRate = useCallback(
    (from: string, to: string): number | null => {
      const fromRate = rates[from]?.usdRate;
      const toRate = rates[to]?.usdRate;
      if (fromRate == null || toRate == null || fromRate === 0) return null;
      return toRate / fromRate;
    },
    [rates],
  );

  return {
    rates,
    convert,
    getRate,
    isLoading,
    isError,
    timestamp: data?.timestamp,
  };
}
