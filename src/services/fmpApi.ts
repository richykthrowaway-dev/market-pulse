/**
 * fmpApi.ts — Financial Modeling Prep (FMP) data service
 *
 * Free tier: 250 req/day, US stocks, 5-year history.
 * All queries must use staleTime ≥ 24 h to stay within quota.
 *
 * Fallback priority in the dashboard:
 *   Primary    → Finnhub / EODHD (existing sources)
 *   Fallback 1 → FMP  (this file)   ← generous: 250 req/day
 *   Fallback 2 → Alpha Vantage      ← last resort: 25 req/day
 *
 * Key endpoints used:
 *   /profile/{symbol}          – market cap, beta, sector, dividend yield, 52W, logo
 *   /key-metrics-ttm/{symbol}  – P/E TTM, EPS TTM, P/B, FCF yield, dividend yield
 *   /historical/earning_calendar/{symbol} – quarterly earnings (actual + estimate)
 *   /historical-price-full/{symbol}       – daily OHLCV bars (5 years free)
 *   /quote/{symbol}            – latest price + change%
 *   /analyst-stock-recommendations/{symbol} – analyst consensus
 */

const FMP_BASE = 'https://financialmodelingprep.com/api/v3';
const FMP_KEY  = import.meta.env.VITE_FMP_KEY as string;

// ── Generic fetch ────────────────────────────────────────────────────────────

async function fmpFetch<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!FMP_KEY) {
    console.warn('fmpApi: VITE_FMP_KEY not set');
    return null;
  }

  const url = new URL(`${FMP_BASE}${path}`);
  url.searchParams.set('apikey', FMP_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = await res.json();

    // FMP returns { "Error Message": "..." } for invalid keys or missing data
    if (data && typeof data === 'object' && !Array.isArray(data) && data['Error Message']) {
      console.warn('fmpApi error:', data['Error Message']);
      return null;
    }

    return data as T;
  } catch (err) {
    console.error('fmpApi fetch error:', err);
    return null;
  }
}

// ── Profile ──────────────────────────────────────────────────────────────────
// Single call — replaces Finnhub profile + partially replaces AV overview.

export interface FMPProfile {
  symbol:              string;
  price:               number;
  beta:                number;
  volAvg:              number;    // 10-day average volume
  mktCap:              number;    // raw USD
  lastDiv:             number;    // last annual dividend per share
  range:               string;    // "52WeekLow - 52WeekHigh"
  changes:             number;    // price change today
  companyName:         string;
  currency:            string;
  exchange:            string;
  exchangeShortName:   string;
  industry:            string;
  website:             string;
  description:         string;
  sector:              string;
  country:             string;
  image:               string;    // logo URL
  ipoDate:             string;
  isin:                string;
  dcfDiff:             number;
  dcf:                 number;    // DCF valuation
}

export async function fetchFMPProfile(symbol: string): Promise<FMPProfile | null> {
  const data = await fmpFetch<FMPProfile[]>(`/profile/${symbol}`);
  return data?.[0] ?? null;
}

// Derive 52W high/low from the "lo - hi" range string FMP returns
export function parseFMPRange(range: string): { low: number; high: number } | null {
  const parts = range?.split(' - ');
  if (parts?.length !== 2) return null;
  const low  = parseFloat(parts[0]);
  const high = parseFloat(parts[1]);
  if (!isFinite(low) || !isFinite(high)) return null;
  return { low, high };
}

// ── Key Metrics TTM ──────────────────────────────────────────────────────────
// Trailing-twelve-month valuation ratios — the most useful single endpoint
// for the Fundamentals panel.

export interface FMPKeyMetricsTTM {
  symbol?:                    string;
  revenuePerShareTTM:         number;
  netIncomePerShareTTM:       number;  // EPS TTM
  operatingCashFlowPerShareTTM: number;
  freeCashFlowPerShareTTM:    number;
  cashPerShareTTM:            number;
  bookValuePerShareTTM:       number;
  tangibleBookValuePerShareTTM: number;
  shareholdersEquityPerShareTTM: number;
  interestDebtPerShareTTM:    number;
  marketCapTTM:               number;
  enterpriseValueTTM:         number;
  peRatioTTM:                 number;
  priceToSalesRatioTTM:       number;
  pocfratioTTM:               number;
  pfcfRatioTTM:               number;
  pbRatioTTM:                 number;
  ptbRatioTTM:                number;
  evToSalesTTM:               number;
  enterpriseValueOverEBITDATTM: number;
  evToOperatingCashFlowTTM:   number;
  evToFreeCashFlowTTM:        number;
  earningsYieldTTM:           number;
  freeCashFlowYieldTTM:       number;
  debtToEquityTTM:            number;
  debtToAssetsTTM:            number;
  netDebtToEBITDATTM:         number;
  currentRatioTTM:            number;
  interestCoverageTTM:        number;
  incomeQualityTTM:           number;
  dividendYieldTTM:           number;
  dividendYieldPercentageTTM: number;
  payoutRatioTTM:             number;
  salesGeneralAndAdministrativeToRevenueTTM: number;
  researchAndDevelopementToRevenueTTM: number;
  intangiblesToTotalAssetsTTM: number;
  capexToOperatingCashFlowTTM: number;
  capexToRevenueTTM:          number;
  capexToDepreciationTTM:     number;
  stockBasedCompensationToRevenueTTM: number;
  grahamNetNetTTM:            number;
  workingCapitalTTM:          number;
  tangibleAssetValueTTM:      number;
  netCurrentAssetValueTTM:    number;
  investedCapitalTTM:         number;
  averageReceivablesTTM:      number;
  averagePayablesTTM:         number;
  averageInventoryTTM:        number;
  daysSalesOutstandingTTM:    number;
  daysPayablesOutstandingTTM: number;
  daysOfInventoryOnHandTTM:   number;
  receivablesTurnoverTTM:     number;
  payablesTurnoverTTM:        number;
  inventoryTurnoverTTM:       number;
  roeTTM:                     number;
  capexPerShareTTM:           number;
  dividendPerShareTTM:        number;
  debtToMarketCapTTM:         number;
}

export async function fetchFMPKeyMetrics(symbol: string): Promise<FMPKeyMetricsTTM | null> {
  const data = await fmpFetch<FMPKeyMetricsTTM[]>(`/key-metrics-ttm/${symbol}`);
  return data?.[0] ?? null;
}

// ── Earnings ─────────────────────────────────────────────────────────────────

export interface FMPEarning {
  date:              string; // report date
  symbol:            string;
  eps:               number | null;    // actual
  epsEstimated:      number | null;
  revenue:           number | null;    // actual revenue
  revenueEstimated:  number | null;
  updatedFromDate:   string;
  fiscalDateEnding:  string;
}

export async function fetchFMPEarnings(symbol: string): Promise<FMPEarning[] | null> {
  const data = await fmpFetch<FMPEarning[]>(`/historical/earning_calendar/${symbol}`);
  if (!data?.length) return null;
  return data;
}

// ── Quote ─────────────────────────────────────────────────────────────────────

export interface FMPQuote {
  symbol:             string;
  name:               string;
  price:              number;
  changesPercentage:  number;
  change:             number;
  dayLow:             number;
  dayHigh:            number;
  yearHigh:           number;
  yearLow:            number;
  marketCap:          number;
  priceAvg50:         number;
  priceAvg200:        number;
  exchange:           string;
  volume:             number;
  avgVolume:          number;
  open:               number;
  previousClose:      number;
  eps:                number;
  pe:                 number;
  earningsAnnouncement: string;
  sharesOutstanding:  number;
  timestamp:          number;
}

export async function fetchFMPQuote(symbol: string): Promise<FMPQuote | null> {
  const data = await fmpFetch<FMPQuote[]>(`/quote/${symbol}`);
  return data?.[0] ?? null;
}

// ── Historical OHLCV ─────────────────────────────────────────────────────────

export interface FMPBar {
  date:             string; // "2025-01-15"
  open:             number;
  high:             number;
  low:              number;
  close:            number;
  adjClose:         number;
  volume:           number;
  unadjustedVolume: number;
  change:           number;
  changePercent:    number;
  vwap:             number;
}

export async function fetchFMPBars(
  symbol: string,
  from?: string,  // "YYYY-MM-DD"
  to?: string,
): Promise<FMPBar[] | null> {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to)   params.to   = to;

  const data = await fmpFetch<{ historical: FMPBar[] }>(
    `/historical-price-full/${symbol}`,
    params,
  );
  if (!data?.historical?.length) return null;
  // FMP returns newest-first; reverse so callers get oldest→newest
  return [...data.historical].reverse();
}

// ── Analyst Recommendations ──────────────────────────────────────────────────

export interface FMPAnalystRec {
  symbol:      string;
  date:        string;
  analystName: string;
  analystCompany: string;
  rating:      string; // "Buy", "Hold", "Sell", "Strong Buy", "Strong Sell", "Overweight", etc.
  priceTarget: number;
  action:      string; // "init", "up", "down", "main", "reit"
}

export async function fetchFMPAnalystRecs(symbol: string): Promise<FMPAnalystRec[] | null> {
  const data = await fmpFetch<FMPAnalystRec[]>(`/analyst-stock-recommendations/${symbol}`);
  if (!data?.length) return null;
  return data;
}

// ── Consensus helper (mirrors Finnhub counts for the existing bar chart) ─────

export interface FMPConsensus {
  strongBuy:  number;
  buy:        number;
  hold:       number;
  sell:       number;
  strongSell: number;
  period:     string;
}

const BUY_RATINGS  = new Set(['Buy', 'Strong Buy', 'Overweight', 'Outperform', 'Accumulate', 'Add']);
const SELL_RATINGS = new Set(['Sell', 'Strong Sell', 'Underweight', 'Underperform', 'Reduce']);
const HOLD_RATINGS = new Set(['Hold', 'Neutral', 'Equal Weight', 'Equal-Weight', 'Market Perform', 'In-Line']);

export function fmpRecsToConsensus(recs: FMPAnalystRec[]): FMPConsensus | null {
  if (!recs.length) return null;
  // Use the most recent 90 days of ratings
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const recent = recs.filter(r => new Date(r.date) >= cutoff);
  const pool   = recent.length > 0 ? recent : recs.slice(0, 20);

  let strongBuy = 0, buy = 0, hold = 0, sell = 0, strongSell = 0;
  for (const r of pool) {
    const rating = r.rating?.trim() ?? '';
    if (rating === 'Strong Buy')  strongBuy++;
    else if (BUY_RATINGS.has(rating))  buy++;
    else if (rating === 'Strong Sell') strongSell++;
    else if (SELL_RATINGS.has(rating)) sell++;
    else if (HOLD_RATINGS.has(rating)) hold++;
    else hold++; // default unknown to hold
  }

  return {
    strongBuy, buy, hold, sell, strongSell,
    period: pool[0]?.date ?? '',
  };
}
