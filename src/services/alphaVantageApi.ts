/**
 * alphaVantageApi.ts
 *
 * Alpha Vantage fallback service — used when primary sources (Finnhub, EODHD)
 * return null or fail. Free tier = 25 requests/day, so:
 *   - NEVER call this speculatively
 *   - React Query staleTime must be 24 h wherever this is used
 *   - Each exported function is called ONLY when upstream returns null/empty
 *
 * Useful endpoints on the free plan:
 *   OVERVIEW         — market cap, P/E, EPS, beta, dividend yield, 52W range
 *   GLOBAL_QUOTE     — last price + change%
 *   EARNINGS         — quarterly actual / estimate EPS (up to 10 quarters)
 *   TIME_SERIES_DAILY_ADJUSTED — OHLCV daily bars (up to 20 years)
 */

const AV_BASE = 'https://www.alphavantage.co/query';
const AV_KEY  = import.meta.env.VITE_ALPHA_VANTAGE_KEY as string;

// ── Generic fetch helper ─────────────────────────────────────────────────────

async function avFetch<T>(params: Record<string, string>): Promise<T | null> {
  if (!AV_KEY) {
    console.warn('alphaVantageApi: VITE_ALPHA_VANTAGE_KEY not set');
    return null;
  }

  const url = new URL(AV_BASE);
  url.searchParams.set('apikey', AV_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = await res.json();

    // AV signals rate-limit with: { "Note": "Thank you..." } or { "Information": "..." }
    if (data?.Note || data?.Information) {
      console.warn('alphaVantageApi: rate-limit hit →', data.Note ?? data.Information);
      return null;
    }

    return data as T;
  } catch (err) {
    console.error('alphaVantageApi fetch error:', err);
    return null;
  }
}

// ── OVERVIEW ─────────────────────────────────────────────────────────────────
// Returns company fundamentals. One call gives us almost everything the
// Fundamentals Panel needs as a fallback.

export interface AVOverview {
  Symbol:               string;
  Name:                 string;
  Description:          string;
  Exchange:             string;
  Currency:             string;
  Sector:               string;
  Industry:             string;
  MarketCapitalization: string; // string integer (USD)
  PERatio:              string; // "None" when unavailable
  EPS:                  string; // TTM EPS
  Beta:                 string;
  DividendYield:        string; // e.g. "0.0058"
  DividendPerShare:     string;
  '52WeekHigh':         string;
  '52WeekLow':          string;
  ForwardPE:            string;
  PriceToBookRatio:     string;
  ProfitMargin:         string;
  AnalystTargetPrice:   string;
  RevenuePerShareTTM:   string;
  ReturnOnEquityTTM:    string;
  QuarterlyEarningsGrowthYOY: string;
  QuarterlyRevenueGrowthYOY:  string;
}

/**
 * Fetch the OVERVIEW for a US-listed stock.
 * Returns null on rate-limit, network error, or unknown ticker.
 */
export async function fetchAVOverview(symbol: string): Promise<AVOverview | null> {
  const data = await avFetch<AVOverview>({ function: 'OVERVIEW', symbol });
  // AV returns an empty object `{}` for unknown tickers
  if (!data || !data.Symbol) return null;
  return data;
}

// ── GLOBAL_QUOTE ─────────────────────────────────────────────────────────────

export interface AVQuote {
  symbol:           string;
  open:             string;
  high:             string;
  low:              string;
  price:            string;
  volume:           string;
  latestTradingDay: string;
  previousClose:    string;
  change:           string;
  changePercent:    string; // e.g. "1.2345%"
}

export async function fetchAVQuote(symbol: string): Promise<AVQuote | null> {
  const data = await avFetch<{ 'Global Quote': Record<string, string> }>({
    function: 'GLOBAL_QUOTE',
    symbol,
  });
  const raw = data?.['Global Quote'];
  if (!raw || !raw['01. symbol']) return null;
  return {
    symbol:           raw['01. symbol'],
    open:             raw['02. open'],
    high:             raw['03. high'],
    low:              raw['04. low'],
    price:            raw['05. price'],
    volume:           raw['06. volume'],
    latestTradingDay: raw['07. latest trading day'],
    previousClose:    raw['08. previous close'],
    change:           raw['09. change'],
    changePercent:    raw['10. change percent'],
  };
}

// ── EARNINGS ─────────────────────────────────────────────────────────────────

export interface AVQuarterlyEarning {
  fiscalDateEnding:    string; // "2025-09-28"
  reportedDate:        string;
  reportedEPS:         string; // actual
  estimatedEPS:        string;
  surprise:            string;
  surprisePercentage:  string; // e.g. "4.7231"
}

export async function fetchAVEarnings(symbol: string): Promise<AVQuarterlyEarning[] | null> {
  const data = await avFetch<{ quarterlyEarnings: AVQuarterlyEarning[] }>({
    function: 'EARNINGS',
    symbol,
  });
  if (!data?.quarterlyEarnings?.length) return null;
  return data.quarterlyEarnings;
}

// ── TIME_SERIES_DAILY_ADJUSTED ───────────────────────────────────────────────
// Returns up to 20 years of daily OHLCV bars.
// outputsize: "compact" = last 100 days, "full" = up to 20 years (slower).

export interface AVDailyBar {
  date:           string; // "2025-01-15"
  open:           number;
  high:           number;
  low:            number;
  close:          number;
  adjustedClose:  number;
  volume:         number;
}

export async function fetchAVDailyBars(
  symbol: string,
  outputsize: 'compact' | 'full' = 'compact',
): Promise<AVDailyBar[] | null> {
  const data = await avFetch<Record<string, unknown>>({
    function:   'TIME_SERIES_DAILY_ADJUSTED',
    symbol,
    outputsize,
  });
  const series = data?.['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined;
  if (!series) return null;

  return Object.entries(series)
    .map(([date, v]) => ({
      date,
      open:          parseFloat(v['1. open']),
      high:          parseFloat(v['2. high']),
      low:           parseFloat(v['3. low']),
      close:         parseFloat(v['4. close']),
      adjustedClose: parseFloat(v['5. adjusted close']),
      volume:        parseInt(v['6. volume'], 10),
    }))
    .sort((a, b) => a.date.localeCompare(b.date)); // oldest → newest
}

// ── Convenience: parse numeric strings safely ────────────────────────────────

/** Parse an AV numeric string. Returns null for "None", "N/A", or non-numeric. */
export function avNum(s: string | undefined | null): number | null {
  if (!s || s === 'None' || s === 'N/A' || s === '-') return null;
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}
