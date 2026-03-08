import { useQuery } from '@tanstack/react-query';
import type { NewsItem } from '@/utils/stocksApi';

/**
 * Hooks for querying the DefeatBeta Data Backend (DuckDB + HuggingFace parquet).
 *
 * The backend runs on localhost:4400 and queries the
 * defeatbeta/yahoo-finance-data HuggingFace dataset.
 *
 * Available hooks:
 *   useCompanyProfile(symbol)    — sector, industry, country, employees, summary
 *   useFinancials(symbol, opts)  — income statements, balance sheets, cash flow
 *   useHistoricalPrices(symbol)  — OHLCV daily price data
 *   useEarningsCalendar(symbol)  — upcoming & past earnings dates
 *   useTrailingEps(symbol)       — trailing EPS history
 *   useDividends(symbol)         — dividend history
 *   useStockSplits(symbol)       — stock split events
 *   useCompanyOfficers(symbol)   — executive officers
 *   useSharesOutstanding(symbol) — shares outstanding history
 *   useRevenueBreakdown(symbol)  — revenue by segment/geography
 *   useSecFilings(symbol, type)  — SEC filings (10-K, 10-Q, etc.)
 *   useEarningsTranscripts(sym)  — earnings call transcripts
 *   useTreasuryYields(days)      — US Treasury yield curve
 *   useExchangeRates(from, to)   — currency exchange rates
 */

const BACKEND_URL = 'http://localhost:4400';

async function fetchApi<T>(endpoint: string, params: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${BACKEND_URL}${endpoint}`);
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined) url.searchParams.set(key, String(val));
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`DefeatBeta API ${res.status}: ${endpoint}`);
  return res.json();
}

// ── Company Profile ─────────────────────────────────────────────────────────

export interface CompanyProfile {
  symbol: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  zip: string;
  industry: string;
  sector: string;
  long_business_summary: string;
  full_time_employees: number;
  web_site: string;
  report_date: string;
}

export function useCompanyProfile(symbol: string | undefined) {
  return useQuery({
    queryKey: ['defeatbeta', 'profile', symbol],
    queryFn: () => fetchApi<{ data: CompanyProfile | null }>('/api/profile', { symbol: symbol! }),
    enabled: !!symbol,
    staleTime: 24 * 60 * 60_000, // 24h — profile data rarely changes
    gcTime: 60 * 60_000,
    select: (d) => d.data,
  });
}

// ── Financial Statements ────────────────────────────────────────────────────

export interface FinancialItem {
  symbol: string;
  report_date: string;
  item_name: string;
  item_value: number | null;
  finance_type: string;   // 'income_statement' | 'balance_sheet' | 'cash_flow'
  period_type: string;    // 'annual' | 'quarterly'
}

export function useFinancials(
  symbol: string | undefined,
  type?: 'income_statement' | 'balance_sheet' | 'cash_flow',
  period?: 'annual' | 'quarterly',
) {
  return useQuery({
    queryKey: ['defeatbeta', 'financials', symbol, type, period],
    queryFn: () => fetchApi<{ data: FinancialItem[] }>('/api/financials', { symbol: symbol!, type, period }),
    enabled: !!symbol,
    staleTime: 60 * 60_000, // 1h — financials update quarterly
    gcTime: 30 * 60_000,
    select: (d) => d.data,
  });
}

// ── Historical Prices ───────────────────────────────────────────────────────

export interface PriceBar {
  symbol: string;
  report_date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export function useHistoricalPrices(symbol: string | undefined, days = 365) {
  return useQuery({
    queryKey: ['defeatbeta', 'prices', symbol, days],
    queryFn: () => fetchApi<{ data: PriceBar[] }>('/api/prices', { symbol: symbol!, days }),
    enabled: !!symbol,
    staleTime: 30 * 60_000,
    gcTime: 15 * 60_000,
    select: (d) => d.data,
  });
}

// ── Earnings Calendar ───────────────────────────────────────────────────────

export interface EarningsEvent {
  symbol: string;
  report_date: string;
  time: string;
  name: string;
  fiscal_quarter_ending: string;
}

export function useEarningsCalendar(symbol: string | undefined) {
  return useQuery({
    queryKey: ['defeatbeta', 'earnings', symbol],
    queryFn: () => fetchApi<{ data: EarningsEvent[] }>('/api/earnings', { symbol: symbol! }),
    enabled: !!symbol,
    staleTime: 60 * 60_000,
    gcTime: 30 * 60_000,
    select: (d) => d.data,
  });
}

// ── Trailing EPS ────────────────────────────────────────────────────────────

export interface TrailingEps {
  symbol: string;
  report_date: string;
  tailing_eps: number;
  eps: number;
  update_time: string;
}

export function useTrailingEps(symbol: string | undefined) {
  return useQuery({
    queryKey: ['defeatbeta', 'trailing-eps', symbol],
    queryFn: () => fetchApi<{ data: TrailingEps[] }>('/api/trailing-eps', { symbol: symbol! }),
    enabled: !!symbol,
    staleTime: 60 * 60_000,
    select: (d) => d.data,
  });
}

// ── Dividends ───────────────────────────────────────────────────────────────

export interface DividendEvent {
  symbol: string;
  report_date: string;
  amount: number;
}

export function useDividends(symbol: string | undefined) {
  return useQuery({
    queryKey: ['defeatbeta', 'dividends', symbol],
    queryFn: () => fetchApi<{ data: DividendEvent[] }>('/api/dividends', { symbol: symbol! }),
    enabled: !!symbol,
    staleTime: 24 * 60 * 60_000,
    select: (d) => d.data,
  });
}

// ── Stock Splits ────────────────────────────────────────────────────────────

export function useStockSplits(symbol: string | undefined) {
  return useQuery({
    queryKey: ['defeatbeta', 'splits', symbol],
    queryFn: () => fetchApi<{ data: any[] }>('/api/splits', { symbol: symbol! }),
    enabled: !!symbol,
    staleTime: 24 * 60 * 60_000,
    select: (d) => d.data,
  });
}

// ── Company Officers ────────────────────────────────────────────────────────

export interface CompanyOfficer {
  symbol: string;
  name: string;
  title: string;
  age: number;
  born: number;
  pay: number | null;
  exercised: number;
  unexercised: number;
}

export function useCompanyOfficers(symbol: string | undefined) {
  return useQuery({
    queryKey: ['defeatbeta', 'officers', symbol],
    queryFn: () => fetchApi<{ data: CompanyOfficer[] }>('/api/officers', { symbol: symbol! }),
    enabled: !!symbol,
    staleTime: 24 * 60 * 60_000,
    select: (d) => d.data,
  });
}

// ── Shares Outstanding ──────────────────────────────────────────────────────

export function useSharesOutstanding(symbol: string | undefined) {
  return useQuery({
    queryKey: ['defeatbeta', 'shares', symbol],
    queryFn: () => fetchApi<{ data: any[] }>('/api/shares', { symbol: symbol! }),
    enabled: !!symbol,
    staleTime: 24 * 60 * 60_000,
    select: (d) => d.data,
  });
}

// ── Revenue Breakdown ───────────────────────────────────────────────────────

export interface RevenueBreakdown {
  symbol: string;
  breakdown_type: string; // 'geography' | 'segment' | 'product'
  report_date: string;
  item_name: string;
  item_value: number;
}

export function useRevenueBreakdown(symbol: string | undefined) {
  return useQuery({
    queryKey: ['defeatbeta', 'revenue-breakdown', symbol],
    queryFn: () => fetchApi<{ data: RevenueBreakdown[] }>('/api/revenue-breakdown', { symbol: symbol! }),
    enabled: !!symbol,
    staleTime: 60 * 60_000,
    select: (d) => d.data,
  });
}

// ── SEC Filings ─────────────────────────────────────────────────────────────

export interface SecFiling {
  symbol: string;
  cik: string;
  accession_number: string;
  company_name: string;
  form_type: string;
  form_type_description: string;
  filing_date: string;
  report_date: string;
  acceptance_date_time: string;
  filing_url: string;
}

export function useSecFilings(symbol: string | undefined, formType?: string) {
  return useQuery({
    queryKey: ['defeatbeta', 'sec-filings', symbol, formType],
    queryFn: () => fetchApi<{ data: SecFiling[] }>('/api/sec-filings', { symbol: symbol!, type: formType }),
    enabled: !!symbol,
    staleTime: 24 * 60 * 60_000,
    select: (d) => d.data,
  });
}

// ── Earnings Transcripts ────────────────────────────────────────────────────

export function useEarningsTranscripts(symbol: string | undefined, limit = 4) {
  return useQuery({
    queryKey: ['defeatbeta', 'transcripts', symbol, limit],
    queryFn: () => fetchApi<{ data: any[] }>('/api/transcripts', { symbol: symbol!, limit }),
    enabled: !!symbol,
    staleTime: 24 * 60 * 60_000,
    select: (d) => d.data,
  });
}

// ── Treasury Yields ─────────────────────────────────────────────────────────

export interface TreasuryYield {
  report_date: string;
  bc1_month: number | null;
  bc2_month: number | null;
  bc3_month: number | null;
  bc6_month: number | null;
  bc1_year: number | null;
  bc2_year: number | null;
  bc3_year: number | null;
  bc5_year: number | null;
  bc7_year: number | null;
  bc10_year: number | null;
  bc30_year: number | null;
}

export function useTreasuryYields(days = 30) {
  return useQuery({
    queryKey: ['defeatbeta', 'treasury-yields', days],
    queryFn: () => fetchApi<{ data: TreasuryYield[] }>('/api/treasury-yields', { days }),
    staleTime: 60 * 60_000,
    select: (d) => d.data,
  });
}

// ── Exchange Rates ──────────────────────────────────────────────────────────

export function useExchangeRates(from?: string, to?: string) {
  return useQuery({
    queryKey: ['defeatbeta', 'exchange-rates', from, to],
    queryFn: () => fetchApi<{ data: any[] }>('/api/exchange-rates', { from, to }),
    staleTime: 60 * 60_000,
    select: (d) => d.data,
  });
}

// ── News (per-watchlist batch) ───────────────────────────────────────────────

interface RawNewsItem {
  uuid: string;
  related_symbols: string;
  title: string;
  publisher: string;
  report_date: string;
  type: string;
  link: string;
}

export function useDefeatBetaNews(symbols: string[]) {
  const sortedKey = symbols.slice().sort();
  return useQuery({
    queryKey: ['defeatbeta', 'news', sortedKey],
    queryFn: async (): Promise<NewsItem[]> => {
      const results = await Promise.all(
        symbols.map(symbol =>
          fetchApi<{ data: RawNewsItem[] }>('/api/news', { symbol, limit: 20 })
        )
      );
      const seen = new Set<string>();
      const articles: NewsItem[] = [];
      for (const { data } of results) {
        for (const item of data) {
          if (seen.has(item.uuid)) continue;
          seen.add(item.uuid);
          articles.push({
            id: `db-${item.uuid}`,
            title: item.title,
            summary: '',
            source: item.publisher,
            url: item.link,
            publishedAt: new Date(`${item.report_date}T12:00:00`),
            relatedSymbols: item.related_symbols
              ? item.related_symbols.split(',').map(s => s.trim()).filter(Boolean)
              : undefined,
          });
        }
      }
      articles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
      return articles;
    },
    enabled: symbols.length > 0,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}
