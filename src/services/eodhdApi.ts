/**
 * EODHD API client utility — All-in-One plan
 *
 * Calls the `api-eodhd` Edge Function (never EODHD directly).
 * Wrapped with L2 (localStorage) cache via fetchCached.
 *
 * Key rotation: update the EODHD_API_KEY secret in Supabase dashboard.
 */

import { fetchCached } from "@/lib/apiCache";

const EODHD_FN_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/api-eodhd`;
const EODHD_HEADERS = {
  apikey:        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string}`,
};

// ── EOD bars ─────────────────────────────────────────────────────────────────

export interface EodBar {
  date:           string;
  open:           number;
  high:           number;
  low:            number;
  close:          number;
  adjusted_close: number;
  volume:         number;
}

/**
 * Fetch daily OHLCV bars via the edge function proxy.
 * @param symbol e.g. "AAPL.US"
 * @param from   ISO date string e.g. "2020-01-01"
 */
export async function fetchEodHistorical(
  symbol: string,
  from?: string,
  to?: string,
): Promise<EodBar[]> {
  return fetchCached(
    `eodhd:historical:${symbol}:${from ?? ''}:${to ?? ''}`,
    async () => {
      const params: Record<string, string> = { endpoint: 'eod', symbol };
      if (from) params.from = from;
      if (to)   params.to   = to;
      const res = await fetch(`${EODHD_FN_BASE}?${new URLSearchParams(params)}`, {
        headers: EODHD_HEADERS,
      });
      if (!res.ok) throw new Error(`EODHD eod failed (${res.status})`);
      return res.json();
    },
    { ttlMs: 60 * 60_000 }, // 1 h
  );
}

// ── Fundamentals ─────────────────────────────────────────────────────────────
// EODHD /fundamentals returns a large nested object.
// We type only the parts we actually consume.

export interface EodFundamentals {
  General: {
    Code:            string;
    Name:            string;
    Exchange:        string;
    CurrencyCode:    string;
    CurrencySymbol:  string;
    Sector:          string;
    Industry:        string;
    GicSector:       string;
    GicGroup:        string;
    GicIndustry:     string;
    GicSubIndustry:  string;
    Description:     string;
    ISIN:            string;
    CountryISO:      string;
    CountryName:     string;
    IPODate:         string;
    LogoURL:         string;
    WebURL:          string;
    FullTimeEmployees: number;
    Officers?: Record<string, {
      Name:        string;
      Title:       string;
      YearBorn?:   string | number;
    }>;
  };
  Highlights: {
    MarketCapitalization:       number;
    MarketCapitalizationMln:    number;
    EBITDA:                     number;
    PERatio:                    number;  // trailing P/E
    PEGRatio:                   number;
    WallStreetTargetPrice:      number;
    BookValue:                  number;
    DividendShare:              number;
    DividendYield:              number;  // fraction e.g. 0.0058
    EarningsShare:              number;  // EPS TTM
    EPSEstimateCurrentYear:     number;
    EPSEstimateNextYear:        number;
    EPSEstimateNextQuarter:     number;
    EPSEstimateCurrentQuarter:  number;
    MostRecentQuarter:          string;
    ProfitMargin:               number;
    OperatingMarginTTM:         number;
    ReturnOnAssetsTTM:          number;
    ReturnOnEquityTTM:          number;
    RevenueTTM:                 number;
    RevenuePerShareTTM:         number;
    QuarterlyRevenueGrowthYOY:  number;
    GrossProfitTTM:             number;
    DilutedEpsTTM:              number;
    QuarterlyEarningsGrowthYOY: number;
  };
  Technicals: {
    Beta:              number;
    '52WeekHigh':      number;
    '52WeekLow':       number;
    '50DayMA':         number;
    '200DayMA':        number;
    SharesShort:       number;
    SharesShortPriorMonth: number;
    ShortRatio:        number;
    ShortPercent:      number;
  };
  Valuation: {
    TrailingPE:       number;
    ForwardPE:        number;
    PriceSalesTTM:    number;
    PriceBookMRQ:     number;
    EnterpriseValue:  number;
    EnterpriseValueRevenue: number;
    EnterpriseValueEbitda:  number;
  };
  /** Quarterly earnings history — keyed by "YYYY-MM-DD" */
  Earnings: {
    History: Record<string, {
      reportDate:       string;
      date:             string;
      beforeAfterMarket: string | null;
      currency:         string | null;
      epsActual:        number | null;
      epsEstimate:      number | null;
      epsDifference:    number | null;
      surprisePercent:  number | null;
    }>;
    Annual: Record<string, {
      date:      string;
      epsActual: number | null;
    }>;
    /** Forward estimates */
    Trend: Record<string, unknown>;
  };
  /** Analyst ratings */
  AnalystRatings: {
    Rating:      number; // e.g. 2.5 (1=strong buy … 5=strong sell)
    TargetPrice: number;
    StrongBuy:   number;
    Buy:         number;
    Hold:        number;
    Sell:        number;
    StrongSell:  number;
  };
  SharesStats: {
    SharesOutstanding:  number;
    SharesFloat:        number;
    PercentInsiders:    number;
    PercentInstitutions: number;
    SharesShortPriorMonth: number;
    ShortRatio:         number;
  };
  Financials: {
    Balance_Sheet: {
      quarterly: Record<string, Record<string, number | null>>;
      yearly:    Record<string, Record<string, number | null>>;
    };
    Cash_Flow: {
      quarterly: Record<string, Record<string, number | null>>;
      yearly:    Record<string, Record<string, number | null>>;
    };
    Income_Statement: {
      quarterly: Record<string, Record<string, number | null>>;
      yearly:    Record<string, Record<string, number | null>>;
    };
  };
  /**
   * The following sections are present in EODHD's `/fundamentals/{ticker}`
   * payload but are optional (some are missing for non-US, ETF, or
   * recent-IPO tickers). All widgets read from the SAME 10-credit cached
   * payload — adding readers here costs zero additional EODHD credits.
   */
  Holders?: {
    Institutions?: Record<string, {
      name:         string;
      date:         string;
      totalShares:  number;       // % of shares outstanding
      totalAssets:  number;       // % of fund's portfolio
      currentShares: number;      // absolute share count
      change:       number;       // shares delta vs prior filing
      change_p:     number;       // % delta
    }>;
    Funds?: Record<string, {
      name:         string;
      date:         string;
      totalShares:  number;
      totalAssets:  number;
      currentShares: number;
      change:       number;
      change_p:     number;
    }>;
  };
  InsiderTransactions?: Record<string, {
    date:               string;   // "YYYY-MM-DD"
    ownerCik:           string | null;
    ownerName:          string;
    ownerRelationship:  string;   // "Director" / "Officer" / "10% owner" etc.
    ownerTitle:         string;
    transactionDate:    string;
    transactionCode:    string;   // "P"=Purchase, "S"=Sale, "M"=Option exercise...
    transactionAmount:  number;   // share count
    transactionPrice:   number;
    transactionAcquiredDisposed: 'A' | 'D' | string;
    postTransactionAmount: number;
    secLink:            string | null;
  }>;
  ESGScores?: {
    Disclaimer:                string;
    RatingDate:                string;
    TotalEsg:                  number;
    TotalEsgPercentile:        number;
    EnvironmentScore:          number;
    EnvironmentScorePercentile: number;
    SocialScore:               number;
    SocialScorePercentile:     number;
    GovernanceScore:           number;
    GovernanceScorePercentile: number;
    ControversyLevel:          number;       // 0=none, 5=severe
    ActivitiesInvolvement?: Record<string, { Involvement: 'Yes' | 'No' }>;
  };
  outstandingShares?: {
    annual?:    Record<string, { dateFormatted: string; sharesMln: string; shares: number }>;
    quarterly?: Record<string, { dateFormatted: string; sharesMln: string; shares: number }>;
  };
  SplitsDividends?: {
    ForwardAnnualDividendRate:  number | null;
    ForwardAnnualDividendYield: number | null;
    PayoutRatio:                number | null;
    DividendDate:               string | null;
    ExDividendDate:             string | null;
    LastSplitFactor:            string | null;
    LastSplitDate:              string | null;
    NumberDividendsByYear?:     Record<string, { Year: number; Count: number }>;
  };
}

/**
 * Fetch full fundamentals for a symbol (All-in-One plan required).
 * Results are cached 12 h in localStorage — fundamentals update quarterly.
 */
export async function fetchEodFundamentals(symbol: string): Promise<EodFundamentals | null> {
  return await fetchCached<EodFundamentals>(
    `eodhd:fundamentals:${symbol}`,
    async () => {
      const res = await fetch(
        `${EODHD_FN_BASE}?${new URLSearchParams({ endpoint: 'fundamentals', symbol })}`,
        { headers: EODHD_HEADERS },
      );
      // Surface the real edge-fn error (quota exhaustion → 429 with a
      // structured detail) instead of swallowing it. The UI catches this
      // and shows the message verbatim, so the user understands WHY the
      // lookup failed (quota vs bad ticker vs upstream EODHD outage).
      if (!res.ok) {
        let detail = '';
        try {
          const j = await res.json();
          detail = j?.detail || j?.error || '';
        } catch {
          detail = await res.text().catch(() => '');
        }
        if (res.status === 429) {
          throw new Error(`EODHD daily quota exhausted. ${detail || 'Resets at UTC midnight.'}`);
        }
        throw new Error(`EODHD fundamentals failed (${res.status}). ${detail}`.trim());
      }
      const data = await res.json();
      // Guard: EODHD returns { "message": "..." } for missing/restricted tickers
      if (!data?.General?.Code) throw new Error('No fundamentals data for this ticker — try a different .EXCHANGE suffix (e.g. .US, .TO, .L, .XETRA).');
      return data as EodFundamentals;
    },
    { ttlMs: 12 * 60 * 60_000 }, // 12 h
  );
}

// ── Convenience helpers ───────────────────────────────────────────────────────

/** Extract the most recent N quarterly earnings entries, newest first. */
export function eodQuarterlyEarnings(
  fund: EodFundamentals,
  limit = 4,
) {
  if (!fund.Earnings?.History) return [];
  return Object.values(fund.Earnings.History)
    .filter((e) => e.epsActual != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

/** Compute TTM EPS from the 4 most recent quarters. */
export function eodTtmEps(fund: EodFundamentals): number | null {
  // Prefer the pre-computed field when available
  const direct = fund.Highlights?.DilutedEpsTTM ?? fund.Highlights?.EarningsShare;
  if (direct != null && isFinite(direct) && direct !== 0) return direct;

  // Fall back to summing 4 most recent quarters
  const quarters = eodQuarterlyEarnings(fund, 4);
  if (quarters.length < 4) return null;
  return quarters.reduce((sum, q) => sum + (q.epsActual ?? 0), 0);
}

// ── Intraday bars ─────────────────────────────────────────────────────────────

export interface EodIntradayBar {
  timestamp: number; // unix seconds
  gmtoffset: number;
  datetime:  string; // "2025-01-15 14:30:00"
  open:      number;
  high:      number;
  low:       number;
  close:     number;
  volume:    number;
}

/**
 * Fetch intraday OHLCV bars via the edge function proxy.
 * interval: "1m" | "5m" | "1h"  (default "1h")
 * Replaces fetchYahooChart / useYahooHourlyBars.
 */
export async function fetchEodIntraday(
  symbol: string,
  interval: '1m' | '5m' | '1h' = '1h',
  from?: string,
  to?: string,
): Promise<EodIntradayBar[]> {
  try {
    return await fetchCached<EodIntradayBar[]>(
      `eodhd:intraday:${symbol}:${interval}:${from ?? ''}:${to ?? ''}`,
      async () => {
        const params: Record<string, string> = { endpoint: 'intraday', symbol, interval };
        if (from) params.from = from;
        if (to)   params.to   = to;
        const res = await fetch(
          `${EODHD_FN_BASE}?${new URLSearchParams(params)}`,
          { headers: EODHD_HEADERS },
        );
        if (!res.ok) throw new Error(`EODHD intraday failed (${res.status})`);
        const data = await res.json();
        if (!Array.isArray(data)) return [];
        return data as EodIntradayBar[];
      },
      { ttlMs: 10 * 60_000 }, // 10 min — intraday data
    );
  } catch {
    return [];
  }
}

// ── Financial news + sentiment ────────────────────────────────────────────────

export interface EodNewsItem {
  date:           string;   // "2025-01-15T14:30:00+00:00"
  title:          string;
  content:        string;
  link:           string;
  symbols:        string[]; // tickers mentioned
  tags:           string[];
  sentiment: {
    polarity:     number;   // -1 to 1
    neg:          number;
    neu:          number;
    pos:          number;
  } | null;
}

export async function fetchEodNews(
  symbol?: string,
  limit = 50,
  from?: string,
  to?: string,
): Promise<EodNewsItem[]> {
  try {
    return await fetchCached<EodNewsItem[]>(
      `eodhd:news:${symbol ?? 'market'}:${limit}:${from ?? ''}:${to ?? ''}`,
      async () => {
        const params: Record<string, string> = {
          endpoint: 'news',
          limit: String(limit),
        };
        if (symbol) params.s    = symbol;
        if (from)   params.from = from;
        if (to)     params.to   = to;
        const res = await fetch(
          `${EODHD_FN_BASE}?${new URLSearchParams(params)}`,
          { headers: EODHD_HEADERS },
        );
        if (!res.ok) throw new Error(`EODHD news failed (${res.status})`);
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      },
      { ttlMs: 5 * 60_000 }, // 5 min — news refreshes frequently
    );
  } catch {
    return [];
  }
}

// ── Technical indicators ──────────────────────────────────────────────────────

export interface EodTechnicalPoint {
  date:  string;
  value: number;
}

// MACD returns different shape
export interface EodMacdPoint {
  date:       string;
  macd:       number;
  signal:     number;
  histogram:  number;
}

export type EodTechnicalFunction =
  | 'sma' | 'ema' | 'wma' | 'rsi' | 'atr' | 'cci' | 'adx'
  | 'slope' | 'dmi' | 'macd' | 'bbands' | 'stochastic' | 'roc';

export async function fetchEodTechnical(
  symbol: string,
  fn: EodTechnicalFunction,
  period = 14,
  from?: string,
  to?: string,
): Promise<EodTechnicalPoint[] | EodMacdPoint[]> {
  try {
    return await fetchCached<EodTechnicalPoint[]>(
      `eodhd:technical:${symbol}:${fn}:${period}:${from ?? ''}:${to ?? ''}`,
      async () => {
        const params: Record<string, string> = {
          endpoint: 'technical',
          symbol,
          function: fn,
          period:   String(period),
          order:    'a',
        };
        if (from) params.from = from;
        if (to)   params.to   = to;
        const res = await fetch(
          `${EODHD_FN_BASE}?${new URLSearchParams(params)}`,
          { headers: EODHD_HEADERS },
        );
        if (!res.ok) throw new Error(`EODHD technical failed (${res.status})`);
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      },
      { ttlMs: 60 * 60_000 }, // 1 h
    );
  } catch {
    return [];
  }
}

// ── Dividend history ──────────────────────────────────────────────────────────

export interface EodDividend {
  date:              string; // ex-dividend date
  declarationDate:   string;
  recordDate:        string;
  paymentDate:       string;
  period:            string; // "Quarterly" | "Annual" | "Monthly" | etc.
  value:             number; // dividend per share (in stock's currency)
  unadjustedValue:   number;
  currency:          string;
}

export async function fetchEodDividends(
  symbol: string,
  from?: string,
): Promise<EodDividend[]> {
  try {
    return await fetchCached<EodDividend[]>(
      `eodhd:dividends:${symbol}:${from ?? ''}`,
      async () => {
        const params: Record<string, string> = { endpoint: 'dividends', symbol };
        if (from) params.from = from;
        const res = await fetch(
          `${EODHD_FN_BASE}?${new URLSearchParams(params)}`,
          { headers: EODHD_HEADERS },
        );
        if (!res.ok) throw new Error(`EODHD dividends failed (${res.status})`);
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      },
      { ttlMs: 24 * 60 * 60_000 }, // 24 h
    );
  } catch {
    return [];
  }
}

// ── Split history ─────────────────────────────────────────────────────────────

export interface EodSplit {
  date:  string;
  split: string; // e.g. "4/1" (4-for-1)
}

export async function fetchEodSplits(symbol: string): Promise<EodSplit[]> {
  try {
    return await fetchCached<EodSplit[]>(
      `eodhd:splits:${symbol}`,
      async () => {
        const res = await fetch(
          `${EODHD_FN_BASE}?${new URLSearchParams({ endpoint: 'splits', symbol })}`,
          { headers: EODHD_HEADERS },
        );
        if (!res.ok) throw new Error(`EODHD splits failed (${res.status})`);
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      },
      { ttlMs: 24 * 60 * 60_000 },
    );
  } catch {
    return [];
  }
}

// ── Economic events calendar ──────────────────────────────────────────────────

export interface EodEconomicEvent {
  type:       string;  // "GDP", "CPI", "Unemployment Rate", etc.
  country:    string;
  actual:     number | null;
  previous:   number | null;
  estimate:   number | null;
  change:     number | null;
  change_percentage: number | null;
  date:       string;
  comparison: string | null;
  currency:   string | null;
  unit:       string | null;
  importance: number; // 1-3 (low/medium/high)
}

export async function fetchEodEconomicEvents(
  country = 'US',
  from?: string,
  to?: string,
  limit = 50,
): Promise<EodEconomicEvent[]> {
  try {
    return await fetchCached<EodEconomicEvent[]>(
      `eodhd:economic-events:${country}:${from ?? ''}:${to ?? ''}`,
      async () => {
        const params: Record<string, string> = {
          endpoint: 'economic-events',
          country,
          limit: String(limit),
        };
        if (from) params.from = from;
        if (to)   params.to   = to;
        const res = await fetch(
          `${EODHD_FN_BASE}?${new URLSearchParams(params)}`,
          { headers: EODHD_HEADERS },
        );
        if (!res.ok) throw new Error(`EODHD economic-events failed (${res.status})`);
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      },
      { ttlMs: 60 * 60_000 }, // 1 h
    );
  } catch {
    return [];
  }
}

// ── Insider transactions ──────────────────────────────────────────────────────

export interface EodInsiderTransaction {
  code:            string;
  owner_type:      string; // "D" (direct) | "I" (indirect)
  transaction_type: string; // "P" (purchase) | "S" (sale) | "A" (award) etc.
  date:            string;
  owner_name:      string;
  transaction_date: string;
  shares_traded:   number;
  shares_owned:    number;
  transaction_value: number;
  security_name:   string;
  security_type:   string; // "Common Stock" | "Options"
}

export async function fetchEodInsiderTransactions(
  symbol: string,
  limit = 50,
): Promise<EodInsiderTransaction[]> {
  try {
    return await fetchCached<EodInsiderTransaction[]>(
      `eodhd:insider:${symbol}:${limit}`,
      async () => {
        const res = await fetch(
          `${EODHD_FN_BASE}?${new URLSearchParams({ endpoint: 'insider', symbol, limit: String(limit) })}`,
          { headers: EODHD_HEADERS },
        );
        if (!res.ok) throw new Error(`EODHD insider failed (${res.status})`);
        const data = await res.json();
        return Array.isArray(data) ? (data as { data: EodInsiderTransaction[] }).data ?? data : [];
      },
      { ttlMs: 24 * 60 * 60_000 },
    );
  } catch {
    return [];
  }
}

// ── Options chain ─────────────────────────────────────────────────────────────

export interface EodOptionContract {
  contractName:    string;
  contractSize:    string;
  currency:        string;
  type:            'Call' | 'Put';
  inTheMoney:      string; // "TRUE" | "FALSE"
  lastTradeDate:   string;
  expirationDate:  string;
  strike:          number;
  lastPrice:       number;
  bid:             number;
  ask:             number;
  change:          number;
  changePercent:   number;
  volume:          number;
  openInterest:    number;
  impliedVolatility: number;
  delta:           number | null;
  gamma:           number | null;
  theta:           number | null;
  vega:            number | null;
  rho:             number | null;
}

export interface EodOptionsChain {
  code:             string;
  exchange:         string;
  lastTradeDate:    string;
  lastTradePrice:   number;
  data: Array<{
    expirationDate: string;
    impliedVolatility: number;
    putVolume:      number;
    callVolume:     number;
    putCallVolumeRatio: number;
    putOpenInterest: number;
    callOpenInterest: number;
    putCallOpenInterestRatio: number;
    optionsCount:   number;
    options: {
      CALL: EodOptionContract[];
      PUT:  EodOptionContract[];
    };
  }>;
}

export async function fetchEodOptions(
  symbol: string,
  from?: string,
): Promise<EodOptionsChain | null> {
  try {
    return await fetchCached<EodOptionsChain>(
      `eodhd:options:${symbol}:${from ?? ''}`,
      async () => {
        const params: Record<string, string> = { endpoint: 'options', symbol };
        if (from) params.from = from;
        const res = await fetch(
          `${EODHD_FN_BASE}?${new URLSearchParams(params)}`,
          { headers: EODHD_HEADERS },
        );
        if (!res.ok) throw new Error(`EODHD options failed (${res.status})`);
        return res.json();
      },
      { ttlMs: 15 * 60_000 }, // 15 min — options data changes during market hours
    );
  } catch {
    return null;
  }
}

// ── Stock screener ────────────────────────────────────────────────────────────

export interface EodScreenerFilters {
  market_capitalization_more_than?:  number;
  market_capitalization_lower_than?: number;
  pe_ratio_more_than?:               number;
  pe_ratio_lower_than?:              number;
  dividend_yield_more_than?:         number;
  dividend_yield_lower_than?:        number;
  beta_more_than?:                   number;
  beta_lower_than?:                  number;
  earnings_share_more_than?:         number;
  earnings_share_lower_than?:        number;
  return_on_equity_ttm_more_than?:   number;
  return_on_equity_ttm_lower_than?:  number;
  avg_volume_more_than?:             number;
  avg_volume_lower_than?:            number;
  price_more_than?:                  number;
  price_lower_than?:                 number;
  sector?:                           string;
  industry?:                         string;
  country?:                          string;
  exchange?:                         string;
  limit?:                            number;
  offset?:                           number;
  sort?:                             string; // e.g. "market_capitalization_more_than.desc"
}

export interface EodScreenerResult {
  total:   number;
  page:    number;
  results: Array<{
    code:                    string;
    name:                    string;
    exchange:                string;
    sector:                  string;
    industry:                string;
    country:                 string;
    market_capitalization:   number;
    earnings_share:          number;
    dividend_yield:          number | null;
    book_value:              number;
    pe:                      number | null;
    beta:                    number;
    avg_volume:              number;
    close:                   number;
  }>;
}

export async function fetchEodScreener(
  filters: EodScreenerFilters,
): Promise<EodScreenerResult | null> {
  try {
    const params: Record<string, string> = { endpoint: 'screener' };
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined) params[k] = String(v);
    }
    const cacheKey = `eodhd:screener:${JSON.stringify(filters)}`;
    return await fetchCached<EodScreenerResult>(
      cacheKey,
      async () => {
        const res = await fetch(
          `${EODHD_FN_BASE}?${new URLSearchParams(params)}`,
          { headers: EODHD_HEADERS },
        );
        if (!res.ok) throw new Error(`EODHD screener failed (${res.status})`);
        return res.json();
      },
      { ttlMs: 5 * 60_000 }, // 5 min
    );
  } catch {
    return null;
  }
}
