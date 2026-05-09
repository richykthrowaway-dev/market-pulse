import { useState, useMemo } from 'react';
import { FileText } from 'lucide-react';
import type { EodFundamentals } from '@/services/eodhdApi';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────

type StatementKind = 'income' | 'balance' | 'cashflow';
type Frequency     = 'quarterly' | 'yearly';

/** A single line-item definition: which key to pull, and its display label. */
interface LineItem {
  /** Field name in EODHD's flat statement object. */
  field:    string;
  label:    string;
  /** If true, render as %, otherwise as USD. (Default: USD) */
  isPercent?: boolean;
  /** Indent level for sub-totals. (Default: 0) */
  indent?:  number;
  /** Bold when this row is a primary subtotal (Gross Profit, Net Income, etc.) */
  bold?:    boolean;
}

// ── Line-item curation per statement ──────────────────────────────────
//
// Each statement has 30-50 raw fields in EODHD's response. We pick the
// 7-10 highest-signal items per statement so the table reads cleanly
// without overwhelming the viewer. Field names are EODHD's own
// camelCase from the financial-statement schema.

const INCOME_ITEMS: LineItem[] = [
  { field: 'totalRevenue',                    label: 'Total Revenue',         bold: true  },
  { field: 'costOfRevenue',                   label: 'Cost of Revenue',       indent: 1   },
  { field: 'grossProfit',                     label: 'Gross Profit',          bold: true  },
  { field: 'researchDevelopment',             label: 'R&D',                   indent: 1   },
  { field: 'sellingGeneralAdministrative',    label: 'SG&A',                  indent: 1   },
  { field: 'operatingIncome',                 label: 'Operating Income',      bold: true  },
  { field: 'ebitda',                          label: 'EBITDA'                              },
  { field: 'incomeBeforeTax',                 label: 'Income Before Tax'                   },
  { field: 'incomeTaxExpense',                label: 'Income Tax',            indent: 1   },
  { field: 'netIncome',                       label: 'Net Income',            bold: true  },
];

const BALANCE_ITEMS: LineItem[] = [
  { field: 'cash',                            label: 'Cash & Equivalents'                  },
  { field: 'shortTermInvestments',            label: 'Short-Term Investments'              },
  { field: 'totalCurrentAssets',              label: 'Total Current Assets', bold: true   },
  { field: 'propertyPlantEquipment',          label: 'PP&E (net)'                          },
  { field: 'totalAssets',                     label: 'Total Assets',         bold: true   },
  { field: 'totalCurrentLiabilities',         label: 'Current Liabilities',  bold: true   },
  { field: 'longTermDebt',                    label: 'Long-Term Debt'                      },
  { field: 'totalLiab',                       label: 'Total Liabilities',    bold: true   },
  { field: 'totalStockholderEquity',          label: 'Stockholder Equity',   bold: true   },
];

const CASHFLOW_ITEMS: LineItem[] = [
  { field: 'totalCashFromOperatingActivities',  label: 'Operating Cash Flow', bold: true  },
  { field: 'capitalExpenditures',               label: 'CapEx',               indent: 1  },
  // freeCashFlow is computed below; "synthetic" sentinel.
  { field: '__freeCashFlow',                    label: 'Free Cash Flow',      bold: true  },
  { field: 'totalCashflowsFromInvestingActivities', label: 'Investing Activities'         },
  { field: 'totalCashFromFinancingActivities',  label: 'Financing Activities'             },
  { field: 'dividendsPaid',                     label: 'Dividends Paid'                   },
  { field: 'netBorrowings',                     label: 'Net Borrowings'                   },
  { field: 'changeInCash',                      label: 'Change in Cash',      bold: true  },
];

const ITEMS_BY_STATEMENT: Record<StatementKind, LineItem[]> = {
  income:   INCOME_ITEMS,
  balance:  BALANCE_ITEMS,
  cashflow: CASHFLOW_ITEMS,
};

// ── Format helpers ────────────────────────────────────────────────────

/** Coerce EODHD's stringified numbers to JS numbers, returning null on
 *  empty / unparsable. Negative values come through as "-12345" already. */
function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return isFinite(n) ? n : null;
}

function fmtCompactUsd(v: number | null): string {
  if (v == null) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  if (abs >= 1e3)  return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/** "2024-09-30" → "Q3 '24" for quarterly, "FY 2024" for yearly. */
function formatPeriodLabel(dateStr: string, frequency: Frequency): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.slice(0, 7);
  const yr = d.getUTCFullYear();
  if (frequency === 'yearly') return `FY ${yr}`;
  const q = Math.ceil((d.getUTCMonth() + 1) / 3);
  return `Q${q} '${String(yr).slice(-2)}`;
}

// ── Component ─────────────────────────────────────────────────────────

interface FinancialStatementsProps {
  data: EodFundamentals;
}

/**
 * Income / Balance / Cash-Flow statements viewer with annual/quarterly
 * toggle. Reads from the EODHD fundamentals payload already loaded by
 * the lookup — zero extra credits.
 *
 * Renders the last 5 reporting periods (most recent first) for each
 * curated line item per statement. Long-tail line items (50+ raw
 * fields per statement) are intentionally hidden to keep the table
 * scannable; if a user wants a specific number not shown, it's still
 * in the underlying payload and could be surfaced via a future
 * "expand to full" toggle.
 */
export function FinancialStatements({ data }: FinancialStatementsProps) {
  const [stmt, setStmt]   = useState<StatementKind>('income');
  const [freq, setFreq]   = useState<Frequency>('quarterly');

  const periods = useMemo(() => {
    const fin = data.Financials;
    if (!fin) return [];
    const map = stmt === 'income'   ? fin.Income_Statement
              : stmt === 'balance'  ? fin.Balance_Sheet
              : fin.Cash_Flow;
    if (!map) return [];
    const records = (map[freq] ?? {}) as Record<string, Record<string, unknown>>;
    const dates = Object.keys(records).sort().reverse(); // newest first
    return dates.slice(0, 5).map((date) => ({
      date,
      label: formatPeriodLabel(date, freq),
      values: records[date],
    }));
  }, [data, stmt, freq]);

  const items = ITEMS_BY_STATEMENT[stmt];

  // If we don't have at least one period of data, the company doesn't
  // file via EODHD's coverage — hide the whole section rather than
  // show an empty table. (Common for ETFs, recent IPOs, foreign issuers.)
  if (periods.length === 0) return null;

  return (
    <div className="space-y-2 pt-3 border-t border-border">
      {/* Header + toggle bar */}
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wide">
            Financial Statements
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {/* Statement-kind tabs */}
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {([
              { k: 'income',   l: 'Income' },
              { k: 'balance',  l: 'Balance' },
              { k: 'cashflow', l: 'Cash Flow' },
            ] as const).map((t) => (
              <button
                key={t.k}
                onClick={() => setStmt(t.k)}
                className={cn(
                  'px-2 py-1 transition-colors',
                  stmt === t.k
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-muted text-muted-foreground',
                )}
              >
                {t.l}
              </button>
            ))}
          </div>
          {/* Annual / Quarterly toggle */}
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {([
              { k: 'quarterly', l: 'Q' },
              { k: 'yearly',    l: 'A' },
            ] as const).map((t) => (
              <button
                key={t.k}
                onClick={() => setFreq(t.k)}
                className={cn(
                  'px-2 py-1 transition-colors',
                  freq === t.k
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-muted text-muted-foreground',
                )}
              >
                {t.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table — sticky line-item column, scrollable period columns */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/30 text-left font-semibold uppercase tracking-wide text-[10px] text-muted-foreground px-3 py-2 border-r border-border whitespace-nowrap">
                Line Item
              </th>
              {periods.map((p) => (
                <th
                  key={p.date}
                  className="text-right font-mono font-semibold tabular-nums px-3 py-2 whitespace-nowrap"
                >
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              // Synthetic Free Cash Flow row: OCF − CapEx (CapEx is signed
              // negative in EODHD's payload, so subtraction works as add).
              const cellValues = periods.map((p) => {
                if (item.field === '__freeCashFlow') {
                  const ocf   = toNumber(p.values['totalCashFromOperatingActivities']);
                  const capex = toNumber(p.values['capitalExpenditures']);
                  if (ocf == null || capex == null) return null;
                  return ocf + capex; // capex is negative → subtraction
                }
                return toNumber(p.values[item.field]);
              });

              // Hide rows where every period is null — keeps the table
              // dense for companies that don't break out R&D, etc.
              if (cellValues.every((v) => v == null)) return null;

              return (
                <tr key={item.field} className="border-t border-border">
                  <td
                    className={cn(
                      'sticky left-0 z-10 bg-card px-3 py-1.5 border-r border-border whitespace-nowrap',
                      item.bold ? 'text-foreground font-semibold' : 'text-muted-foreground',
                    )}
                    style={item.indent ? { paddingLeft: `${0.75 + item.indent * 1}rem` } : undefined}
                  >
                    {item.label}
                  </td>
                  {cellValues.map((v, i) => (
                    <td
                      key={i}
                      className={cn(
                        'text-right font-mono tabular-nums px-3 py-1.5 whitespace-nowrap',
                        item.bold && 'font-semibold',
                        v != null && v < 0 && 'text-red-400',
                      )}
                    >
                      {fmtCompactUsd(v)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground italic px-1">
        Source: EODHD · {periods.length} most recent {freq === 'quarterly' ? 'quarters' : 'fiscal years'}
      </p>
    </div>
  );
}
