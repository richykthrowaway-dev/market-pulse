/**
 * Normalized Statement Types
 *
 * All brokerage adapters normalize their output into these types.
 * This enables format-agnostic consumption by the UI layer.
 *
 * @module types
 */

// ─── Normalized output types ────────────────────────────────────

export interface StatementMeta {
  broker: string;
  account: string;
  accountName: string;
  period: string;
  baseCurrency: string;
  generatedAt: string;
}

export interface NavSummary {
  startingValue: number;
  endingValue: number;
  markToMarket: number;
  dividends: number;
  interest: number;
  commissions: number;
  depositsWithdrawals: number;
  otherFees: number;
  /** Time-weighted rate of return (%) */
  twrr: number;
}

export interface OpenPosition {
  symbol: string;
  description: string;
  currency: string;
  quantity: number;
  costPrice: number;
  costBasis: number;
  closePrice: number;
  marketValue: number;
  unrealizedPL: number;
  assetCategory: string;
  /** Listing exchange code (e.g. 'V', 'TO', 'NYSE') — populated by enrichment sections */
  exchange?: string;
}

export interface TradeRecord {
  symbol: string;
  currency: string;
  dateTime: string;
  quantity: number;
  tradePrice: number;
  closePrice: number;
  proceeds: number;
  commission: number;
  costBasis: number;
  realizedPL: number;
  mtmPL: number;
  codes: string;
  assetCategory: string;
}

export interface PerformanceRow {
  symbol: string;
  description: string;
  assetCategory: string;
  realizedTotal: number;
  unrealizedTotal: number;
  total: number;
}

export interface CashEntry {
  currency: string;
  label: string;
  total: number;
}

export interface DividendRecord {
  symbol: string;
  currency: string;
  date: string;
  amount: number;
  type: 'dividend' | 'payment_in_lieu' | 'withholding_tax';
}

export interface ParsedStatement {
  meta: StatementMeta;
  nav: NavSummary;
  openPositions: OpenPosition[];
  trades: TradeRecord[];
  performance: PerformanceRow[];
  dividends: DividendRecord[];
  cash: CashEntry[];
  /** Detected format identifier */
  format: string;
  /** Parse timing metadata */
  timing: {
    parseMs: number;
    lineCount: number;
  };
  /** Any warnings/errors encountered during parsing */
  warnings: string[];
}

// ─── Adapter interface ──────────────────────────────────────────

/**
 * A StatementAdapter converts raw CSV text from a specific brokerage
 * format into the normalized ParsedStatement.
 *
 * Each adapter must:
 * 1. Declare a unique `id` and human-readable `name`
 * 2. Implement `detect()` to claim ownership of a given CSV
 * 3. Implement `parse()` to produce normalized output
 *
 * Adapters are registered with the AdapterRegistry and tried in
 * priority order (highest first) during auto-detection.
 */
export interface StatementAdapter {
  /** Unique adapter identifier (e.g. 'ibkr', 'schwab', 'fidelity') */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Priority for detection ordering (higher = tried first) */
  readonly priority: number;

  /**
   * Inspect the first N lines to determine if this adapter
   * can handle the file. Should be fast (< 1ms).
   * @param sampleLines First 10-20 lines of the file
   * @returns confidence 0-1 (0 = definitely not, 1 = certain)
   */
  detect(sampleLines: string[]): number;

  /**
   * Parse the full CSV text into a normalized statement.
   * @param lines Pre-split lines (via splitLines)
   * @returns Normalized parsed statement
   */
  parse(lines: string[]): Omit<ParsedStatement, 'timing'>;
}

// ─── Empty result factory ───────────────────────────────────────

export function emptyStatement(format: string): Omit<ParsedStatement, 'timing'> {
  return {
    meta: {
      broker: '', account: '', accountName: '',
      period: '', baseCurrency: 'USD', generatedAt: '',
    },
    nav: {
      startingValue: 0, endingValue: 0, markToMarket: 0,
      dividends: 0, interest: 0, commissions: 0,
      depositsWithdrawals: 0, otherFees: 0, twrr: 0,
    },
    openPositions: [],
    trades: [],
    performance: [],
    dividends: [],
    cash: [],
    format,
    warnings: [],
  };
}
