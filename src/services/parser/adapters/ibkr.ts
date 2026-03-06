/**
 * IBKR (Interactive Brokers) Statement Adapter
 *
 * Parses IBKR Activity Statement CSVs which use a section-oriented format:
 *   Column 0 = section name (e.g. "Open Positions", "Trades")
 *   Column 1 = row type: "Header" | "Data" | "SubTotal" | "Total"
 *   Remaining columns = section-specific fields
 *
 * Sections parsed:
 *   - Statement → broker meta
 *   - Account Information → account details
 *   - Net Asset Value → TWRR
 *   - Change in NAV → P&L breakdown
 *   - Open Positions → current holdings
 *   - Trades → individual executions
 *   - Realized & Unrealized Performance Summary → per-symbol P&L
 *   - Cash Report → cash flows
 *   - Dividends → dividend payments
 *   - Withholding Tax → tax withholdings
 *   - Net Stock Position Summary → enrichment (descriptions)
 *   - Financial Instrument Information → enrichment (descriptions)
 *
 * Performance: single-pass, O(n) with minimal allocations.
 *
 * @module adapters/ibkr
 */

import type { StatementAdapter, OpenPosition, TradeRecord, PerformanceRow, CashEntry, DividendRecord } from '../types';
import { emptyStatement } from '../types';
import { tokenizeLine, toNumber } from '../tokenizer';

// ─── Section handlers (inlined for zero-overhead dispatch) ──────

// Using a lookup table instead of switch for O(1) section dispatch
type SectionHandler = (cols: string[], ctx: ParseContext) => void;

interface ParseContext {
  meta: ReturnType<typeof emptyStatement>['meta'];
  nav: ReturnType<typeof emptyStatement>['nav'];
  openPositions: OpenPosition[];
  trades: TradeRecord[];
  performance: PerformanceRow[];
  dividends: DividendRecord[];
  cash: CashEntry[];
  warnings: string[];
  // Lookup maps for O(1) enrichment
  positionsBySymbol: Map<string, OpenPosition>;
  perfBySymbol: Map<string, PerformanceRow>;
}

const SECTION_HANDLERS: Record<string, SectionHandler> = {
  'Statement': (cols, ctx) => {
    const key = cols[2], val = cols[3] ?? '';
    if (key === 'BrokerName') ctx.meta.broker = val;
    else if (key === 'Period') ctx.meta.period = val;
    else if (key === 'WhenGenerated') ctx.meta.generatedAt = val;
  },

  'Account Information': (cols, ctx) => {
    const key = cols[2], val = cols[3] ?? '';
    if (key === 'Name') ctx.meta.accountName = val;
    else if (key === 'Account') ctx.meta.account = val;
    else if (key === 'Base Currency') ctx.meta.baseCurrency = val;
  },

  'Net Asset Value': (cols, ctx) => {
    // TWRR row: "Net Asset Value,Data,124.3%"
    if (cols.length === 3 && cols[2]?.endsWith('%')) {
      ctx.nav.twrr = parseFloat(cols[2]) || 0;
    }
  },

  'Change in NAV': (cols, ctx) => {
    const key = cols[2], val = toNumber(cols[3]);
    switch (key) {
      case 'Starting Value': ctx.nav.startingValue = val; break;
      case 'Ending Value': ctx.nav.endingValue = val; break;
      case 'Mark-to-Market': ctx.nav.markToMarket = val; break;
      case 'Dividends': ctx.nav.dividends = val; break;
      case 'Interest': ctx.nav.interest = val; break;
      case 'Commissions': ctx.nav.commissions = val; break;
      case 'Deposits & Withdrawals': ctx.nav.depositsWithdrawals = val; break;
      case 'Other Fees': ctx.nav.otherFees = val; break;
    }
  },

  'Open Positions': (cols, ctx) => {
    if (cols[2] !== 'Summary') return;
    const symbol = cols[5];
    if (!symbol) return;
    const pos: OpenPosition = {
      symbol,
      description: '',
      currency: cols[4] || 'USD',
      quantity: toNumber(cols[6]),
      costPrice: toNumber(cols[8]),
      costBasis: toNumber(cols[9]),
      closePrice: toNumber(cols[10]),
      marketValue: toNumber(cols[11]),
      unrealizedPL: toNumber(cols[12]),
      assetCategory: cols[3] || 'Stocks',
    };
    ctx.openPositions.push(pos);
    ctx.positionsBySymbol.set(symbol, pos);
  },

  'Trades': (cols, ctx) => {
    if (cols[2] !== 'Order') return;
    ctx.trades.push({
      assetCategory: cols[3] || 'Stocks',
      currency: cols[4] || 'USD',
      symbol: cols[5] || '',
      dateTime: cols[6] || '',
      quantity: toNumber(cols[7]),
      tradePrice: toNumber(cols[8]),
      closePrice: toNumber(cols[9]),
      proceeds: toNumber(cols[10]),
      commission: toNumber(cols[11]),
      costBasis: toNumber(cols[12]),
      realizedPL: toNumber(cols[13]),
      mtmPL: toNumber(cols[14]),
      codes: cols[15] ?? '',
    });
  },

  'Realized & Unrealized Performance Summary': (cols, ctx) => {
    const symbol = cols[3];
    if (!symbol) return;
    const row: PerformanceRow = {
      symbol,
      description: '',
      assetCategory: cols[2] || 'Stocks',
      realizedTotal: toNumber(cols[9]),
      unrealizedTotal: toNumber(cols[14]),
      total: toNumber(cols[15]),
    };
    ctx.performance.push(row);
    ctx.perfBySymbol.set(symbol, row);
  },

  'Cash Report': (cols, ctx) => {
    const label = cols[2], currency = cols[3];
    if (label && currency) {
      ctx.cash.push({ currency, label, total: toNumber(cols[4]) });
    }
  },

  'Dividends': (cols, ctx) => {
    // Header: Currency,Date,Description,Amount
    const currency = cols[2];
    const date = cols[3];
    const desc = cols[4] ?? '';
    const amount = toNumber(cols[5]);
    if (currency && date && amount) {
      // Extract symbol from description (e.g. "AAPL(US0378331005) Cash Dividend ...")
      const symbolMatch = desc.match(/^(\S+?)[\s(]/);
      ctx.dividends.push({
        symbol: symbolMatch?.[1] ?? desc.substring(0, 10),
        currency,
        date,
        amount,
        type: 'dividend',
      });
    }
  },

  'Withholding Tax': (cols, ctx) => {
    const currency = cols[2];
    const date = cols[3];
    const desc = cols[4] ?? '';
    const amount = toNumber(cols[5]);
    if (currency && date) {
      const symbolMatch = desc.match(/^(\S+?)[\s(]/);
      ctx.dividends.push({
        symbol: symbolMatch?.[1] ?? '',
        currency,
        date,
        amount,
        type: 'withholding_tax',
      });
    }
  },

  'Payment In Lieu Of Dividends': (cols, ctx) => {
    const currency = cols[2];
    const date = cols[3];
    const desc = cols[4] ?? '';
    const amount = toNumber(cols[5]);
    if (currency && date && amount) {
      const symbolMatch = desc.match(/^(\S+?)[\s(]/);
      ctx.dividends.push({
        symbol: symbolMatch?.[1] ?? '',
        currency,
        date,
        amount,
        type: 'payment_in_lieu',
      });
    }
  },

  // Enrichment sections — use Map lookups for O(1)
  'Net Stock Position Summary': (cols, ctx) => {
    const symbol = cols[5], desc = cols[6];
    if (!symbol || !desc) return;
    const pos = ctx.positionsBySymbol.get(symbol);
    if (pos) pos.description = desc;
  },

  'Financial Instrument Information': (cols, ctx) => {
    const symbol = cols[3], desc = cols[4];
    if (!symbol || !desc) return;
    const pos = ctx.positionsBySymbol.get(symbol);
    if (pos) {
      if (!pos.description) pos.description = desc;
      // cols[5] is typically the listing exchange in IBKR CSVs
      const listingExchange = cols[5]?.trim();
      if (listingExchange && !pos.exchange) pos.exchange = listingExchange;
    }
    const perf = ctx.perfBySymbol.get(symbol);
    if (perf && !perf.description) perf.description = desc;
  },
};

// ─── Adapter implementation ─────────────────────────────────────

export const ibkrAdapter: StatementAdapter = {
  id: 'ibkr',
  name: 'Interactive Brokers',
  priority: 100,

  detect(sampleLines: string[]): number {
    let score = 0;
    for (const line of sampleLines) {
      if (line.includes('Interactive Brokers')) return 1.0;
      if (line.startsWith('Statement,Data,BrokerName')) return 1.0;
      if (line.startsWith('Statement,Header')) score = Math.max(score, 0.8);
      if (line.startsWith('Account Information,Header')) score = Math.max(score, 0.7);
      if (line.startsWith('Account Information,Data')) score = Math.max(score, 0.6);
    }
    return score;
  },

  parse(lines: string[]) {
    const base = emptyStatement('ibkr');
    const ctx: ParseContext = {
      meta: base.meta,
      nav: base.nav,
      openPositions: base.openPositions,
      trades: base.trades,
      performance: base.performance,
      dividends: base.dividends,
      cash: base.cash,
      warnings: base.warnings,
      positionsBySymbol: new Map(),
      perfBySymbol: new Map(),
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Fast pre-check: find first comma to extract section name
      const firstComma = line.indexOf(',');
      if (firstComma <= 0) continue;

      const section = line.substring(0, firstComma);

      // Fast skip: check if we have a handler before tokenizing
      const handler = SECTION_HANDLERS[section];
      if (!handler) continue;

      // Tokenize only if we have a handler
      const cols = tokenizeLine(line);

      // Skip Header/Total/SubTotal rows
      const rowType = cols[1];
      if (rowType !== 'Data') continue;

      handler(cols, ctx);
    }

    return {
      meta: ctx.meta,
      nav: ctx.nav,
      openPositions: ctx.openPositions,
      trades: ctx.trades,
      performance: ctx.performance,
      dividends: ctx.dividends,
      cash: ctx.cash,
      format: 'ibkr',
      warnings: ctx.warnings,
    };
  },
};
