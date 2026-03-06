/**
 * Statement Parser — Public API
 *
 * Usage:
 *   import { parseStatement, parseStatementFile, registry } from '@/services/parser';
 *
 *   // Parse from string
 *   const result = parseStatement(csvText);
 *
 *   // Parse from File (drag-drop / input)
 *   const result = await parseStatementFile(file);
 *
 *   // Force a specific adapter
 *   const result = parseStatement(csvText, 'ibkr');
 *
 *   // Register a custom adapter
 *   registry.register(myCustomAdapter);
 *
 * Architecture:
 *   ┌─────────────┐     ┌──────────────┐     ┌───────────────┐
 *   │  CSV Text    │────▶│  Tokenizer   │────▶│   Registry    │
 *   │  or File     │     │  splitLines  │     │   detect()    │
 *   └─────────────┘     │  tokenize    │     │   ↓           │
 *                        └──────────────┘     │  Adapter      │
 *                                              │   parse()    │
 *                                              └───────┬──────┘
 *                                                      ▼
 *                                              ┌───────────────┐
 *                                              │  Normalized   │
 *                                              │  Statement    │
 *                                              └───────────────┘
 *
 * Adding a new brokerage:
 *   1. Create src/services/parser/adapters/mybrokerage.ts
 *   2. Implement StatementAdapter interface
 *   3. Register in this file's init block
 *
 * @module parser
 */

// Re-export types
export type {
  StatementMeta,
  NavSummary,
  OpenPosition,
  TradeRecord,
  PerformanceRow,
  CashEntry,
  DividendRecord,
  ParsedStatement,
  StatementAdapter,
} from './types';

export { emptyStatement } from './types';
export { tokenizeLine, splitLines, toNumber, fastNum, benchmark } from './tokenizer';
export type { BenchmarkResult } from './tokenizer';
export { registry } from './registry';

// ─── Register built-in adapters ─────────────────────────────────

import { registry } from './registry';
import { ibkrAdapter } from './adapters/ibkr';
import { genericAdapter } from './adapters/generic';

registry.register(ibkrAdapter);
registry.register(genericAdapter);

// ─── Convenience API ────────────────────────────────────────────

import type { ParsedStatement } from './types';

/**
 * Parse a CSV statement string with auto-detection.
 * @param csvText Raw CSV content
 * @param forceAdapter Optional adapter id to skip auto-detection
 */
export function parseStatement(csvText: string, forceAdapter?: string): ParsedStatement {
  return registry.parse(csvText, forceAdapter);
}

/**
 * Parse a File object (from file input or drag-and-drop).
 * @param file The File to parse
 * @param forceAdapter Optional adapter id
 * @returns Promise resolving to parsed statement
 */
export function parseStatementFile(file: File, forceAdapter?: string): Promise<ParsedStatement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseStatement(reader.result as string, forceAdapter));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
