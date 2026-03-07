import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from 'recharts';
import type { EquityPoint } from '@/lib/performanceTypes';

interface EquityCurveChartProps {
  data: EquityPoint[];
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
          {entry.name}: {entry.value.toFixed(2)}
        </p>
      ))}
    </div>
  );
};

export function EquityCurveChart({ data, benchmarkLabel, isLoading }: EquityCurveChartProps) {
  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;

  const step = Math.max(1, Math.floor(data.length / 200));
  const thinned = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Equity Curve (Normalized to 100)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={thinned} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
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
              tickFormatter={v => v.toFixed(0)}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={100} stroke="hsl(var(--border))" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="portfolio"
              name="Portfolio"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="benchmark"
              name={benchmarkLabel}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
