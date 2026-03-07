import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Line, ComposedChart, Area,
} from 'recharts';
import type { DrawdownPoint } from '@/lib/performanceTypes';

interface DrawdownChartProps {
  data: DrawdownPoint[];
  benchmarkLabel: string;
  isLoading: boolean;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {entry.value.toFixed(2)}%
        </p>
      ))}
    </div>
  );
};

export function DrawdownChart({ data, benchmarkLabel, isLoading }: DrawdownChartProps) {
  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;

  const step = Math.max(1, Math.floor(data.length / 200));
  const thinned = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Drawdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={thinned} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--danger))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--danger))" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v.toFixed(0)}%`}
              width={44}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Area
              type="monotone"
              dataKey="portfolioDrawdownPct"
              name="Portfolio DD"
              stroke="hsl(var(--danger))"
              strokeWidth={1.5}
              fill="url(#ddGradient)"
            />
            <Line
              type="monotone"
              dataKey="benchmarkDrawdownPct"
              name={`${benchmarkLabel} DD`}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1}
              strokeDasharray="4 2"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
