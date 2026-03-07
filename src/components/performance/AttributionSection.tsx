import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { AttributionRow, AttributionGrouping } from '@/lib/performanceTypes';

interface AttributionSectionProps {
  rows: AttributionRow[];
  grouping: AttributionGrouping;
  onGroupingChange: (g: AttributionGrouping) => void;
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.abs(value) / max * 100 : 0;
  const positive = value >= 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full', positive ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--danger))]')}
          style={{ width: `${pct.toFixed(1)}%` }}
        />
      </div>
      <span className={cn('text-xs font-medium w-14 text-right', positive ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]')}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}%
      </span>
    </div>
  );
}

export function AttributionSection({ rows, grouping, onGroupingChange }: AttributionSectionProps) {
  if (rows.length === 0) return null;

  const maxContrib = Math.max(...rows.map(r => Math.abs(r.contributionReturnPct)));

  return (
    <Card>
      <CardHeader className="pb-0 pt-4 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Attribution</CardTitle>
        <Tabs value={grouping} onValueChange={v => onGroupingChange(v as AttributionGrouping)}>
          <TabsList className="h-8">
            <TabsTrigger value="sector" className="text-xs px-3">By Sector</TabsTrigger>
            <TabsTrigger value="ticker" className="text-xs px-3">By Position</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Segment</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Weight</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Return</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-48">Contribution</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Active Contrib</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .sort((a, b) => Math.abs(b.contributionReturnPct) - Math.abs(a.contributionReturnPct))
                .map(row => (
                  <tr key={row.segmentName} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{row.segmentName}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{row.weightPct.toFixed(1)}%</td>
                    <td className="px-3 py-3 text-right">
                      <span className={row.segmentReturnPct >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]'}>
                        {row.segmentReturnPct >= 0 ? '+' : ''}{row.segmentReturnPct.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-3 py-3 w-48">
                      <MiniBar value={row.contributionReturnPct} max={maxContrib} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className={row.contributionActivePct >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]'}>
                        {row.contributionActivePct >= 0 ? '+' : ''}{row.contributionActivePct.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
