import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { PeriodPerformance, TableMode } from '@/lib/performanceTypes';

interface PerformanceTableProps {
  rows: PeriodPerformance[];
  mode: TableMode;
  onModeChange: (mode: TableMode) => void;
  isLoading: boolean;
}

type SortKey = keyof PeriodPerformance;

function ColoredCell({ value, suffix = '%' }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const positive = value >= 0;
  return (
    <span className={positive ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]'}>
      {value >= 0 ? '+' : ''}{value.toFixed(2)}{suffix}
    </span>
  );
}

const PERIOD_ORDER = ['1M', '3M', 'YTD', '1Y', '3Y', '5Y', 'Since Inception'];

export function PerformanceTable({ rows, mode, onModeChange, isLoading }: PerformanceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('periodLabel');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = [...rows].sort((a, b) => {
    if (sortKey === 'periodLabel') {
      const ai = PERIOD_ORDER.indexOf(a.periodLabel);
      const bi = PERIOD_ORDER.indexOf(b.periodLabel);
      return sortAsc ? ai - bi : bi - ai;
    }
    const av = a[sortKey] ?? -Infinity;
    const bv = b[sortKey] ?? -Infinity;
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortAsc
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const Th = ({ label, col, className }: { label: string; col: SortKey; className?: string }) => (
    <th
      className={cn('px-3 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors', className)}
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center">{label}<SortIcon col={col} /></span>
    </th>
  );

  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;

  return (
    <Card>
      <CardHeader className="pb-0 pt-4 px-4">
        <Tabs value={mode} onValueChange={v => onModeChange(v as TableMode)}>
          <TabsList>
            <TabsTrigger value="returns">Returns</TabsTrigger>
            <TabsTrigger value="risk">Risk</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <Th label="Period" col="periodLabel" className="pl-4" />
                {mode === 'returns' ? (
                  <>
                    <Th label="Portfolio" col="portfolioReturnPct" />
                    <Th label="Benchmark" col="benchmarkReturnPct" />
                    <Th label="Active" col="activeReturnPct" />
                    <Th label="Annualized" col="annualizedReturnPct" />
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Beat?</th>
                  </>
                ) : (
                  <>
                    <Th label="Volatility" col="volatilityPct" />
                    <Th label="Sharpe" col="sharpe" />
                    <Th label="Sortino" col="sortino" />
                    <Th label="Max DD" col="maxDrawdownPct" />
                    <Th label="Beta" col="beta" />
                    <Th label="Tracking Err" col="trackingErrorPct" />
                    <Th label="Info Ratio" col="informationRatio" />
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => (
                <tr key={row.periodLabel} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-3 pl-4 font-medium">{row.periodLabel}</td>
                  {mode === 'returns' ? (
                    <>
                      <td className="px-3 py-3"><ColoredCell value={row.portfolioReturnPct} /></td>
                      <td className="px-3 py-3"><ColoredCell value={row.benchmarkReturnPct} /></td>
                      <td className="px-3 py-3"><ColoredCell value={row.activeReturnPct} /></td>
                      <td className="px-3 py-3">
                        {row.annualizedReturnPct !== null
                          ? <ColoredCell value={row.annualizedReturnPct} />
                          : <span className="text-muted-foreground text-xs">{'< 1Y'}</span>
                        }
                      </td>
                      <td className="px-3 py-3">
                        {row.activeReturnPct >= 0
                          ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
                          : <XCircle className="h-4 w-4 text-[hsl(var(--danger))]" />
                        }
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3">{row.volatilityPct.toFixed(2)}%</td>
                      <td className="px-3 py-3"><ColoredCell value={row.sharpe} suffix="" /></td>
                      <td className="px-3 py-3"><ColoredCell value={row.sortino} suffix="" /></td>
                      <td className="px-3 py-3"><ColoredCell value={row.maxDrawdownPct} /></td>
                      <td className="px-3 py-3 text-muted-foreground">{row.beta.toFixed(3)}</td>
                      <td className="px-3 py-3">{row.trackingErrorPct.toFixed(2)}%</td>
                      <td className="px-3 py-3"><ColoredCell value={row.informationRatio} suffix="" /></td>
                    </>
                  )}
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={mode === 'risk' ? 8 : 6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Not enough data to compute performance periods.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
