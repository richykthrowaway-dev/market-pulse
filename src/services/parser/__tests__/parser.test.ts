/**
 * Statement Parser Tests & Benchmarks
 *
 * Tests the tokenizer, IBKR adapter, generic adapter, and registry.
 * Includes inline IBKR sample data for deterministic testing.
 */

import { describe, it, expect } from 'vitest';
import {
  tokenizeLine,
  splitLines,
  toNumber,
  fastNum,
  parseStatement,
  registry,
  benchmark,
} from '../index';

// ─── Tokenizer tests ────────────────────────────────────────────

describe('tokenizeLine', () => {
  it('splits simple CSV fields', () => {
    expect(tokenizeLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields with commas', () => {
    expect(tokenizeLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });

  it('handles escaped quotes inside quoted fields', () => {
    expect(tokenizeLine('"say ""hello""",b')).toEqual(['say "hello"', 'b']);
  });

  it('trims whitespace around fields', () => {
    expect(tokenizeLine(' a , b , c ')).toEqual(['a', 'b', 'c']);
  });

  it('handles empty fields', () => {
    expect(tokenizeLine('a,,c,')).toEqual(['a', '', 'c', '']);
  });

  it('handles single field', () => {
    expect(tokenizeLine('hello')).toEqual(['hello']);
  });

  it('handles empty line', () => {
    expect(tokenizeLine('')).toEqual(['']);
  });

  it('handles IBKR address field with commas', () => {
    const line = 'Statement,Data,BrokerAddress,"1800 McGill College Avenue, Suite 2106, Montreal, Quebec"';
    const result = tokenizeLine(line);
    expect(result[0]).toBe('Statement');
    expect(result[1]).toBe('Data');
    expect(result[2]).toBe('BrokerAddress');
    expect(result[3]).toBe('1800 McGill College Avenue, Suite 2106, Montreal, Quebec');
  });
});

describe('splitLines', () => {
  it('splits \\n lines', () => {
    expect(splitLines('a\nb\nc')).toEqual(['a', 'b', 'c']);
  });

  it('splits \\r\\n lines', () => {
    expect(splitLines('a\r\nb\r\nc')).toEqual(['a', 'b', 'c']);
  });

  it('removes BOM', () => {
    expect(splitLines('\uFEFFa\nb')).toEqual(['a', 'b']);
  });

  it('skips empty lines', () => {
    expect(splitLines('a\n\nb\n\n')).toEqual(['a', 'b']);
  });
});

describe('toNumber / fastNum', () => {
  it('converts plain numbers', () => {
    expect(toNumber('123.45')).toBe(123.45);
  });

  it('handles commas in numbers', () => {
    expect(toNumber('1,450.56')).toBe(1450.56);
  });

  it('returns 0 for empty string', () => {
    expect(toNumber('')).toBe(0);
  });

  it('returns 0 for "--"', () => {
    expect(toNumber('--')).toBe(0);
  });

  it('returns fallback for non-numeric', () => {
    expect(toNumber('abc', -1)).toBe(-1);
  });

  it('handles negative numbers', () => {
    expect(toNumber('-2360.669')).toBeCloseTo(-2360.669);
  });

  it('caches repeated values', () => {
    fastNum('42.5');
    fastNum('42.5');
    expect(fastNum('42.5')).toBe(42.5);
  });
});

// ─── IBKR adapter tests ────────────────────────────────────────

const IBKR_SAMPLE = `\uFEFFStatement,Header,Field Name,Field Value
Statement,Data,BrokerName,Interactive Brokers Canada Inc.
Statement,Data,BrokerAddress,"1800 McGill College Avenue, Suite 2106, Montreal, Quebec, Canada  H3A 3J6"
Statement,Data,Title,Activity Statement
Statement,Data,Period,"April 1, 2025 - February 27, 2026"
Statement,Data,WhenGenerated,"2026-02-28, 19:57:16 EST"
Account Information,Header,Field Name,Field Value
Account Information,Data,Name,John Doe
Account Information,Data,Account,U1234567
Account Information,Data,Account Type,Individual
Account Information,Data,Base Currency,USD
Net Asset Value,Header,Asset Class,Prior Total,Current Long,Current Short,Current Total,Change
Net Asset Value,Data,Stock,16310.81,101217.78,0,101217.78,84906.97
Net Asset Value,Data,Total,22678.35,102342.88,-55788.97,46553.91,23875.56
Net Asset Value,Header,Time Weighted Rate of Return
Net Asset Value,Data,124.305215343%
Change in NAV,Header,Field Name,Field Value
Change in NAV,Data,Starting Value,22678.353964154
Change in NAV,Data,Mark-to-Market,31664.820506793
Change in NAV,Data,Deposits & Withdrawals,-3598.05
Change in NAV,Data,Dividends,584.5868433
Change in NAV,Data,Interest,-2008.1268359
Change in NAV,Data,Other Fees,-214.99
Change in NAV,Data,Commissions,-2360.669421148
Change in NAV,Data,Ending Value,46553.910591491
Open Positions,Header,DataDiscriminator,Asset Category,Currency,Symbol,Quantity,Mult,Cost Price,Cost Basis,Close Price,Value,Unrealized P/L,Code
Open Positions,Data,Summary,Stocks,USD,AAPL,100,1,150.50,15050,175.25,17525,2475,
Open Positions,Data,Summary,Stocks,USD,AMZN,50,1,180.00,9000,210.00,10500,1500,
Open Positions,Data,Summary,Stocks,CAD,XEQT,200,1,40.50,8100,42.04,8408,308,
Open Positions,Total,,Stocks,USD,,,,,32150,,36433,4283,
Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code
Trades,Data,Order,Stocks,USD,AAPL,"2025-06-15, 10:30:00",50,145.00,150.00,-7250,-3.50,7253.50,0,250,O
Trades,Data,Order,Stocks,USD,AAPL,"2025-06-16, 14:00:00",50,156.00,155.00,-7800,-3.50,7803.50,0,-50,O
Trades,SubTotal,,Stocks,USD,AAPL,,100,,,-15050,-7.00,15057.00,0,200,
Trades,Data,Order,Stocks,USD,AMZN,"2025-08-01, 09:30:00",50,180.00,185.00,-9000,-5.00,9005.00,0,250,O
Net Stock Position Summary,Header,Asset Category,Currency,Symbol,Description,Shares at IB,Shares Borrowed,Shares Lent,Net Shares
Net Stock Position Summary,Data,Stocks,USD,AAPL,APPLE INC,100,0,0,100
Net Stock Position Summary,Data,Stocks,USD,AMZN,AMAZON.COM INC,50,0,0,50
Net Stock Position Summary,Data,Stocks,CAD,XEQT,ISHARES CORE EQUITY ETF PORT,200,0,0,200
Realized & Unrealized Performance Summary,Header,Asset Category,Symbol,Cost Adj.,Realized S/T Profit,Realized S/T Loss,Realized L/T Profit,Realized L/T Loss,Realized Total,Unrealized S/T Profit,Unrealized S/T Loss,Unrealized L/T Profit,Unrealized L/T Loss,Unrealized Total,Total,Code
Realized & Unrealized Performance Summary,Data,Stocks,AAPL,0,500,-200,0,0,300,2475,0,0,0,2475,2775,
Realized & Unrealized Performance Summary,Data,Stocks,AMZN,0,0,0,0,0,0,1500,0,0,0,1500,1500,
Cash Report,Header,Currency Summary,Currency,Total,Month to Date,Year to Date,
Cash Report,Data,Starting Cash,Base Currency Summary,6367.975,,,
Cash Report,Data,Commissions,Base Currency Summary,-2360.669,,,
Cash Report,Data,Ending Cash,Base Currency Summary,-54571.080,,,
Financial Instrument Information,Header,Asset Category,Symbol,Description,Conid,Security ID,Listing Exch,Multiplier,Type,Code
Financial Instrument Information,Data,Stocks,AAPL,APPLE INC,265598,US0378331005,NASDAQ,1,COMMON,
Financial Instrument Information,Data,Stocks,AMZN,AMAZON.COM INC,3691937,US0231351067,NASDAQ,1,COMMON,
Financial Instrument Information,Data,Stocks,XEQT,ISHARES CORE EQUITY ETF PORT,456789,CA46434V1013,TSX,1,ETF,`;

describe('IBKR Adapter', () => {
  it('detects IBKR format with high confidence', () => {
    const lines = splitLines(IBKR_SAMPLE);
    const adapter = registry.detect(lines);
    expect(adapter?.id).toBe('ibkr');
  });

  it('parses statement metadata', () => {
    const result = parseStatement(IBKR_SAMPLE);
    expect(result.format).toBe('ibkr');
    expect(result.meta.broker).toBe('Interactive Brokers Canada Inc.');
    expect(result.meta.account).toBe('U1234567');
    expect(result.meta.accountName).toBe('John Doe');
    expect(result.meta.baseCurrency).toBe('USD');
    expect(result.meta.period).toBe('April 1, 2025 - February 27, 2026');
  });

  it('parses NAV summary', () => {
    const result = parseStatement(IBKR_SAMPLE);
    expect(result.nav.startingValue).toBeCloseTo(22678.35, 1);
    expect(result.nav.endingValue).toBeCloseTo(46553.91, 1);
    expect(result.nav.markToMarket).toBeCloseTo(31664.82, 1);
    expect(result.nav.commissions).toBeCloseTo(-2360.67, 1);
    expect(result.nav.twrr).toBeCloseTo(124.31, 0);
  });

  it('parses open positions', () => {
    const result = parseStatement(IBKR_SAMPLE);
    expect(result.openPositions).toHaveLength(3);

    const aapl = result.openPositions.find(p => p.symbol === 'AAPL');
    expect(aapl).toBeDefined();
    expect(aapl!.quantity).toBe(100);
    expect(aapl!.costBasis).toBe(15050);
    expect(aapl!.closePrice).toBe(175.25);
    expect(aapl!.marketValue).toBe(17525);
    expect(aapl!.unrealizedPL).toBe(2475);
    expect(aapl!.currency).toBe('USD');
    expect(aapl!.description).toBe('APPLE INC');

    const xeqt = result.openPositions.find(p => p.symbol === 'XEQT');
    expect(xeqt).toBeDefined();
    expect(xeqt!.currency).toBe('CAD');
    expect(xeqt!.quantity).toBe(200);
  });

  it('parses trades', () => {
    const result = parseStatement(IBKR_SAMPLE);
    expect(result.trades).toHaveLength(3);

    const firstTrade = result.trades[0];
    expect(firstTrade.symbol).toBe('AAPL');
    expect(firstTrade.quantity).toBe(50);
    expect(firstTrade.tradePrice).toBe(145);
    expect(firstTrade.commission).toBe(-3.5);
    expect(firstTrade.dateTime).toBe('2025-06-15, 10:30:00');
    expect(firstTrade.codes).toBe('O');
  });

  it('parses performance summary', () => {
    const result = parseStatement(IBKR_SAMPLE);
    expect(result.performance).toHaveLength(2);

    const aapl = result.performance.find(p => p.symbol === 'AAPL');
    expect(aapl!.realizedTotal).toBe(300);
    expect(aapl!.unrealizedTotal).toBe(2475);
    expect(aapl!.total).toBe(2775);
    expect(aapl!.description).toBe('APPLE INC');
  });

  it('parses cash report', () => {
    const result = parseStatement(IBKR_SAMPLE);
    expect(result.cash.length).toBeGreaterThan(0);
    const commissions = result.cash.find(c => c.label === 'Commissions');
    expect(commissions).toBeDefined();
    expect(commissions!.total).toBeCloseTo(-2360.669, 1);
  });

  it('includes timing metadata', () => {
    const result = parseStatement(IBKR_SAMPLE);
    expect(result.timing.parseMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.lineCount).toBeGreaterThan(0);
  });

  it('skips SubTotal and Total rows', () => {
    const result = parseStatement(IBKR_SAMPLE);
    // Trades should only have 3 Order rows, not the SubTotal
    expect(result.trades).toHaveLength(3);
  });
});

// ─── Generic adapter tests ──────────────────────────────────────

const GENERIC_SAMPLE = `Symbol,Name,Shares,Price,Cost Basis,Market Value,Unrealized P/L,Currency
AAPL,Apple Inc,100,175.25,15050,17525,2475,USD
MSFT,Microsoft Corp,50,420.50,18000,21025,3025,USD
GOOGL,Alphabet Inc,25,175.00,4000,4375,375,USD`;

describe('Generic Adapter', () => {
  it('detects generic CSV with low confidence', () => {
    const lines = splitLines(GENERIC_SAMPLE);
    const adapter = registry.detect(lines, 0.05);
    expect(adapter?.id).toBe('generic');
  });

  it('parses positions from standard column headers', () => {
    const result = parseStatement(GENERIC_SAMPLE, 'generic');
    expect(result.format).toBe('generic');
    expect(result.openPositions).toHaveLength(3);

    const msft = result.openPositions.find(p => p.symbol === 'MSFT');
    expect(msft).toBeDefined();
    expect(msft!.quantity).toBe(50);
    expect(msft!.closePrice).toBe(420.50);
    expect(msft!.marketValue).toBe(21025);
    expect(msft!.description).toBe('Microsoft Corp');
  });

  it('handles missing optional columns', () => {
    const csv = `Ticker,Qty,Price\nAAPL,100,175`;
    const result = parseStatement(csv, 'generic');
    expect(result.openPositions).toHaveLength(1);
    expect(result.openPositions[0].symbol).toBe('AAPL');
    expect(result.openPositions[0].quantity).toBe(100);
  });
});

// ─── Registry tests ─────────────────────────────────────────────

describe('Registry', () => {
  it('lists registered adapters', () => {
    const adapters = registry.getAdapters();
    expect(adapters.length).toBeGreaterThanOrEqual(2);
    expect(adapters[0].id).toBe('ibkr'); // Highest priority
  });

  it('gets adapter by id', () => {
    expect(registry.getAdapter('ibkr')?.name).toBe('Interactive Brokers');
    expect(registry.getAdapter('generic')?.name).toBe('Generic CSV');
    expect(registry.getAdapter('nonexistent')).toBeUndefined();
  });

  it('auto-detects IBKR over generic', () => {
    const result = parseStatement(IBKR_SAMPLE);
    expect(result.format).toBe('ibkr');
  });

  it('falls back to generic for unknown formats', () => {
    const result = parseStatement(GENERIC_SAMPLE);
    expect(result.format).toBe('generic');
  });

  it('forces a specific adapter', () => {
    // Force generic on IBKR data — should still parse something
    const result = parseStatement(IBKR_SAMPLE, 'generic');
    expect(result.format).toBe('generic');
  });

  it('throws on unknown forced adapter', () => {
    expect(() => parseStatement('a,b,c', 'nonexistent')).toThrow('Unknown adapter');
  });
});

// ─── Performance benchmark ──────────────────────────────────────

describe('Performance', () => {
  it('benchmarks IBKR parsing speed', () => {
    // Generate a large synthetic IBKR file (~5000 lines)
    const header = `Statement,Header,Field Name,Field Value
Statement,Data,BrokerName,Interactive Brokers
Account Information,Data,Account,U9999999
Account Information,Data,Base Currency,USD
Open Positions,Header,DataDiscriminator,Asset Category,Currency,Symbol,Quantity,Mult,Cost Price,Cost Basis,Close Price,Value,Unrealized P/L,Code`;

    const positions: string[] = [];
    for (let i = 0; i < 500; i++) {
      positions.push(`Open Positions,Data,Summary,Stocks,USD,SYM${i},${100 + i},1,${50 + i * 0.5},${(100 + i) * (50 + i * 0.5)},${55 + i * 0.5},${(100 + i) * (55 + i * 0.5)},${(100 + i) * 5},`);
    }

    const tradeHeader = `Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code`;
    const trades: string[] = [];
    for (let i = 0; i < 3000; i++) {
      trades.push(`Trades,Data,Order,Stocks,USD,SYM${i % 500},"2025-06-${String(1 + (i % 28)).padStart(2, '0')}, 10:00:00",${10 + (i % 90)},${50 + i * 0.1},${52 + i * 0.1},${-(10 + (i % 90)) * (50 + i * 0.1)},-3.50,${(10 + (i % 90)) * (50 + i * 0.1)},${(i % 2 === 0 ? 25 : -15)},${i % 3},O`);
    }

    const bigFile = [header, ...positions, tradeHeader, ...trades].join('\n');

    const bm = benchmark(bigFile, parseStatement);

    console.log(`\n📊 IBKR Parse Benchmark:`);
    console.log(`   Lines:     ${bm.lines.toLocaleString()}`);
    console.log(`   Size:      ${(bm.byteSize / 1024).toFixed(1)} KB`);
    console.log(`   Time:      ${bm.parseTimeMs} ms`);
    console.log(`   Speed:     ${bm.linesPerSecond.toLocaleString()} lines/sec`);
    console.log(`   Throughput: ${(bm.bytesPerSecond / 1024 / 1024).toFixed(1)} MB/sec\n`);

    // Performance assertions
    expect(bm.parseTimeMs).toBeLessThan(500); // Should be well under 500ms
    expect(bm.linesPerSecond).toBeGreaterThan(10000); // At least 10K lines/sec
  });

  it('tokenizeLine handles 10K iterations efficiently', () => {
    const line = 'Trades,Data,Order,Stocks,USD,AAPL,"2025-06-15, 10:30:00",50,145.00,150.00,-7250,-3.50,7253.50,0,250,O';
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      tokenizeLine(line);
    }
    const elapsed = performance.now() - start;
    console.log(`   tokenizeLine: ${(elapsed / 10000 * 1000).toFixed(1)} µs/line`);
    expect(elapsed).toBeLessThan(500); // 10K lines in under 500ms
  });
});
