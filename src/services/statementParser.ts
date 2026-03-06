/**
 * Universal Brokerage Statement Parser
 * Handles IBKR Activity Statements and common CSV investment formats.
 *
 * IBKR CSVs are "section-oriented":
 *   Column 0 = section name
 *   Column 1 = row type: Header | Data | SubTotal | Total
 *   Remaining columns = section-specific fields
 *
 * The parser streams through lines once, routing each row to the
 * appropriate section handler.  No regex-heavy passes, no second reads.
 */

// ─── Shared helpers ──────────────────────────────────────────────

/** Parse a CSV line respecting quoted fields (handles commas inside quotes) */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function toNum(v: string | undefined): number {
  if (!v || v === '--' || v === '') return 0;
  // IBKR uses commas inside numbers sometimes (e.g. "1,450.56")
  return Number(v.replace(/,/g, '')) || 0;
}

// ─── Result types ────────────────────────────────────────────────

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
  twrr: number; // time-weighted rate of return %
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
  /** Listing exchange code (e.g. 'V', 'TO', 'NYSE') */
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

export interface ParsedStatement {
  meta: StatementMeta;
  nav: NavSummary;
  openPositions: OpenPosition[];
  trades: TradeRecord[];
  performance: PerformanceRow[];
  cash: CashEntry[];
  /** Format detected: 'ibkr' | 'generic' */
  format: 'ibkr' | 'generic';
}

// ─── IBKR Parser ─────────────────────────────────────────────────

function parseIBKR(lines: string[]): ParsedStatement {
  const meta: StatementMeta = {
    broker: '', account: '', accountName: '',
    period: '', baseCurrency: 'USD', generatedAt: '',
  };
  const nav: NavSummary = {
    startingValue: 0, endingValue: 0, markToMarket: 0,
    dividends: 0, interest: 0, commissions: 0,
    depositsWithdrawals: 0, otherFees: 0, twrr: 0,
  };
  const openPositions: OpenPosition[] = [];
  const trades: TradeRecord[] = [];
  const performance: PerformanceRow[] = [];
  const cash: CashEntry[] = [];

  // Header maps per section (populated from "Header" rows)
  const headers: Record<string, string[]> = {};

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw || raw.startsWith('\uFEFF') && raw.length < 3) continue;
    const cols = parseCsvLine(raw.replace(/^\uFEFF/, ''));
    const section = cols[0];
    const rowType = cols[1];

    if (rowType === 'Header') {
      headers[section] = cols.slice(2);
      continue;
    }
    if (rowType !== 'Data') continue; // skip Total, SubTotal, etc.

    switch (section) {
      case 'Statement': {
        const key = cols[2];
        const val = cols[3] ?? '';
        if (key === 'BrokerName') meta.broker = val;
        if (key === 'Period') meta.period = val;
        if (key === 'WhenGenerated') meta.generatedAt = val;
        break;
      }
      case 'Account Information': {
        const key = cols[2];
        const val = cols[3] ?? '';
        if (key === 'Name') meta.accountName = val;
        if (key === 'Account') meta.account = val;
        if (key === 'Base Currency') meta.baseCurrency = val;
        break;
      }
      case 'Net Asset Value': {
        // TWRR row has no header columns — it's just a percentage
        if (cols.length === 3 && cols[2]?.endsWith('%')) {
          nav.twrr = parseFloat(cols[2]);
        }
        break;
      }
      case 'Change in NAV': {
        const key = cols[2];
        const val = toNum(cols[3]);
        if (key === 'Starting Value') nav.startingValue = val;
        else if (key === 'Ending Value') nav.endingValue = val;
        else if (key === 'Mark-to-Market') nav.markToMarket = val;
        else if (key === 'Dividends') nav.dividends = val;
        else if (key === 'Interest') nav.interest = val;
        else if (key === 'Commissions') nav.commissions = val;
        else if (key === 'Deposits & Withdrawals') nav.depositsWithdrawals = val;
        else if (key === 'Other Fees') nav.otherFees = val;
        break;
      }
      case 'Open Positions': {
        // Header: DataDiscriminator,Asset Category,Currency,Symbol,Quantity,Mult,Cost Price,Cost Basis,Close Price,Value,Unrealized P/L,Code
        const disc = cols[2]; // Summary or Detail
        if (disc !== 'Summary') break;
        const assetCategory = cols[3];
        const currency = cols[4];
        const symbol = cols[5];
        const quantity = toNum(cols[6]);
        // cols[7] = Mult
        const costPrice = toNum(cols[8]);
        const costBasis = toNum(cols[9]);
        const closePrice = toNum(cols[10]);
        const marketValue = toNum(cols[11]);
        const unrealizedPL = toNum(cols[12]);
        openPositions.push({
          symbol, description: '', currency, quantity,
          costPrice, costBasis, closePrice, marketValue,
          unrealizedPL, assetCategory: assetCategory || 'Stocks',
        });
        break;
      }
      case 'Net Stock Position Summary': {
        // Enrich open positions with descriptions
        const symbol = cols[5];
        const desc = cols[6];
        const pos = openPositions.find(p => p.symbol === symbol);
        if (pos && desc) pos.description = desc;
        break;
      }
      case 'Trades': {
        // Header: DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code
        const disc = cols[2];
        if (disc !== 'Order') break;
        trades.push({
          assetCategory: cols[3] || 'Stocks',
          currency: cols[4],
          symbol: cols[5],
          dateTime: cols[6],
          quantity: toNum(cols[7]),
          tradePrice: toNum(cols[8]),
          closePrice: toNum(cols[9]),
          proceeds: toNum(cols[10]),
          commission: toNum(cols[11]),
          costBasis: toNum(cols[12]),
          realizedPL: toNum(cols[13]),
          mtmPL: toNum(cols[14]),
          codes: cols[15] ?? '',
        });
        break;
      }
      case 'Realized & Unrealized Performance Summary': {
        const assetCat = cols[2];
        const symbol = cols[3];
        if (!symbol || symbol === '') break; // skip totals
        // Header: Asset Category,Symbol,Cost Adj.,Realized S/T Profit,...,Realized Total,...,Unrealized Total,Total,Code
        const realizedTotal = toNum(cols[9]);
        const unrealizedTotal = toNum(cols[14]);
        const total = toNum(cols[15]);
        performance.push({
          symbol,
          description: '',
          assetCategory: assetCat || 'Stocks',
          realizedTotal,
          unrealizedTotal,
          total,
        });
        break;
      }
      case 'Cash Report': {
        const label = cols[2];
        const currency = cols[3];
        const totalVal = toNum(cols[4]);
        if (label && currency) {
          cash.push({ currency, label, total: totalVal });
        }
        break;
      }
      case 'Financial Instrument Information': {
        // Enrich open positions with descriptions
        const symbol = cols[3];
        const desc = cols[4];
        const pos = openPositions.find(p => p.symbol === symbol);
        if (pos && desc && !pos.description) pos.description = desc;
        // Also enrich performance rows
        const perf = performance.find(p => p.symbol === symbol);
        if (perf && desc && !perf.description) perf.description = desc;
        break;
      }
    }
  }

  return { meta, nav, openPositions, trades, performance, cash, format: 'ibkr' };
}

// ─── Generic CSV parser (fallback) ──────────────────────────────

function parseGenericCSV(lines: string[]): ParsedStatement {
  // Attempt to detect common column patterns:
  // symbol, quantity, price, cost, value, etc.
  const headerLine = lines.find(l => l && !l.startsWith('#'));
  if (!headerLine) {
    return emptyResult('generic');
  }

  const headerCols = parseCsvLine(headerLine).map(h => h.toLowerCase());

  // Find column indices by common names
  const idx = {
    symbol: findCol(headerCols, ['symbol', 'ticker', 'stock', 'security']),
    name: findCol(headerCols, ['name', 'description', 'security name']),
    qty: findCol(headerCols, ['quantity', 'shares', 'qty', 'units', 'amount']),
    price: findCol(headerCols, ['price', 'close', 'last', 'current price', 'market price']),
    cost: findCol(headerCols, ['cost', 'cost basis', 'avg cost', 'average cost', 'book cost']),
    value: findCol(headerCols, ['value', 'market value', 'mkt value']),
    currency: findCol(headerCols, ['currency', 'ccy']),
    pl: findCol(headerCols, ['p/l', 'pl', 'unrealized', 'gain/loss', 'gain', 'profit']),
  };

  if (idx.symbol === -1) return emptyResult('generic');

  const openPositions: OpenPosition[] = [];
  const headerIdx = lines.indexOf(headerLine);

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;
    const cols = parseCsvLine(line);
    const symbol = cols[idx.symbol];
    if (!symbol) continue;

    const quantity = idx.qty >= 0 ? toNum(cols[idx.qty]) : 0;
    const closePrice = idx.price >= 0 ? toNum(cols[idx.price]) : 0;
    const costBasis = idx.cost >= 0 ? toNum(cols[idx.cost]) : 0;
    const marketValue = idx.value >= 0 ? toNum(cols[idx.value]) : quantity * closePrice;
    const unrealizedPL = idx.pl >= 0 ? toNum(cols[idx.pl]) : marketValue - costBasis;

    openPositions.push({
      symbol,
      description: idx.name >= 0 ? cols[idx.name] || '' : '',
      currency: idx.currency >= 0 ? cols[idx.currency] || 'USD' : 'USD',
      quantity,
      costPrice: quantity ? costBasis / quantity : 0,
      costBasis,
      closePrice,
      marketValue,
      unrealizedPL,
      assetCategory: 'Stocks',
    });
  }

  const result = emptyResult('generic');
  result.openPositions = openPositions;
  return result;
}

function findCol(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const i = headers.findIndex(h => h.includes(c));
    if (i >= 0) return i;
  }
  return -1;
}

function emptyResult(format: 'ibkr' | 'generic'): ParsedStatement {
  return {
    meta: { broker: '', account: '', accountName: '', period: '', baseCurrency: 'USD', generatedAt: '' },
    nav: { startingValue: 0, endingValue: 0, markToMarket: 0, dividends: 0, interest: 0, commissions: 0, depositsWithdrawals: 0, otherFees: 0, twrr: 0 },
    openPositions: [],
    trades: [],
    performance: [],
    cash: [],
    format,
  };
}

// ─── Auto-detect & parse ────────────────────────────────────────

/** Detect format from first few lines */
function detectFormat(lines: string[]): 'ibkr' | 'generic' {
  const sample = lines.slice(0, 10).join('\n');
  if (sample.includes('Interactive Brokers') || sample.includes('Statement,Data,BrokerName')) {
    return 'ibkr';
  }
  // Check for section-oriented format (first column repeated as section name)
  if (sample.includes('Statement,Header') || sample.includes('Account Information,Header')) {
    return 'ibkr';
  }
  return 'generic';
}

/**
 * Main entry: parse a brokerage statement CSV string.
 * Auto-detects IBKR vs generic format.
 */
export function parseStatement(csvText: string): ParsedStatement {
  const lines = csvText.split(/\r?\n/);
  const format = detectFormat(lines);
  return format === 'ibkr' ? parseIBKR(lines) : parseGenericCSV(lines);
}

/**
 * Parse from a File object (for drag-and-drop / file input).
 * Returns a Promise that resolves to the parsed statement.
 */
export function parseStatementFile(file: File): Promise<ParsedStatement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        resolve(parseStatement(text));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
