/**
 * Generic CSV Statement Adapter (Fallback)
 *
 * Handles any CSV with a header row containing recognizable column names
 * like "symbol", "quantity", "price", "cost", etc.
 *
 * Detection: lowest priority, matches any CSV-like file.
 * Parsing: auto-maps columns via fuzzy header matching.
 *
 * @module adapters/generic
 */

import type { StatementAdapter, OpenPosition } from '../types';
import { emptyStatement } from '../types';
import { tokenizeLine, toNumber, buildColumnMap } from '../tokenizer';

/** Column name candidates for fuzzy matching */
const COLUMN_MAPPINGS: Record<string, string[]> = {
  symbol: ['symbol', 'ticker', 'stock', 'security', 'instrument'],
  name: ['name', 'description', 'security name', 'company'],
  quantity: ['quantity', 'shares', 'qty', 'units', 'amount', 'position'],
  price: ['price', 'close', 'last', 'current price', 'market price', 'last price'],
  cost: ['cost', 'cost basis', 'avg cost', 'average cost', 'book cost', 'cost price', 'purchase price'],
  value: ['value', 'market value', 'mkt value', 'current value', 'total value'],
  currency: ['currency', 'ccy', 'cur'],
  pl: ['p/l', 'pl', 'unrealized', 'gain/loss', 'gain', 'profit', 'unrealized p/l'],
  date: ['date', 'purchase date', 'trade date', 'settlement date'],
  type: ['type', 'transaction', 'action', 'side', 'buy/sell'],
  exchange: ['exchange', 'market', 'listing'],
};

export const genericAdapter: StatementAdapter = {
  id: 'generic',
  name: 'Generic CSV',
  priority: 0, // Always tried last

  detect(sampleLines: string[]): number {
    // Accept any non-empty file with comma-separated values
    for (const line of sampleLines) {
      if (line && line.includes(',') && !line.startsWith('#')) {
        return 0.1; // Very low confidence — only used as fallback
      }
    }
    return 0;
  },

  parse(lines: string[]) {
    const result = emptyStatement('generic');

    // Find the first non-empty, non-comment line as header
    let headerIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i];
      if (line && !line.startsWith('#') && line.includes(',')) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx < 0) {
      result.warnings.push('No header row found');
      return result;
    }

    const headerCols = tokenizeLine(lines[headerIdx]);
    const colMap = buildColumnMap(headerCols, COLUMN_MAPPINGS);

    if (colMap.symbol < 0) {
      result.warnings.push('No symbol/ticker column found in header');
      return result;
    }

    // Parse data rows
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.trim() === '') continue;

      const cols = tokenizeLine(line);
      const symbol = cols[colMap.symbol];
      if (!symbol) continue;

      const quantity = colMap.quantity >= 0 ? toNumber(cols[colMap.quantity]) : 0;
      const closePrice = colMap.price >= 0 ? toNumber(cols[colMap.price]) : 0;
      const costBasis = colMap.cost >= 0 ? toNumber(cols[colMap.cost]) : 0;
      const marketValue = colMap.value >= 0 ? toNumber(cols[colMap.value]) : quantity * closePrice;
      const unrealizedPL = colMap.pl >= 0 ? toNumber(cols[colMap.pl]) : marketValue - costBasis;

      const pos: OpenPosition = {
        symbol,
        description: colMap.name >= 0 ? cols[colMap.name] || '' : '',
        currency: colMap.currency >= 0 ? cols[colMap.currency] || 'USD' : 'USD',
        quantity,
        costPrice: quantity ? costBasis / quantity : 0,
        costBasis,
        closePrice,
        marketValue,
        unrealizedPL,
        assetCategory: 'Stocks',
      };
      result.openPositions.push(pos);
    }

    if (result.openPositions.length > 0) {
      result.meta.broker = 'Unknown';
    }

    return result;
  },
};
