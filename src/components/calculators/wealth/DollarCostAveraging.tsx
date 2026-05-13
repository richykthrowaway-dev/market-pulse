// src/components/calculators/wealth/DollarCostAveraging.tsx
import { useState, useMemo, useEffect } from 'react';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useStatement } from '@/contexts/StatementContext';
import type { OpenPosition } from '@/services/parser/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { fmtDollar, fmtCompact, yFmt } from '../calcUtils';

const BACKEND = import.meta.env.DEV ? 'http://localhost:4400' : '/_/backend';
type Freq = 'weekly' | 'monthly' | 'quarterly';
const FREQ_DAYS: Record<Freq, number> = { weekly: 7, monthly: 30, quarterly: 91 };

interface PriceBar { date: string; close: number; }

function compute(amount: number, freq: Freq, startDate: string, endDate: string, prices: PriceBar[]) {
  let totalInvested = 0, totalShares = 0;
  const series: { date: string; invested: number; value: number }[] = [];
  let nextBuy = new Date(startDate);
  const end = new Date(endDate);

  let lastPrice = 0;
  for (const bar of prices) {
    const d = new Date(bar.date);
    if (d < new Date(startDate) || d > end) continue;
    lastPrice = bar.close; // track last bar within simulation range
    if (d >= nextBuy) {
      totalShares += amount / bar.close;
      totalInvested += amount;
      nextBuy = new Date(d.getTime() + FREQ_DAYS[freq] * 86_400_000);
    }
    series.push({ date: bar.date, invested: Math.round(totalInvested), value: Math.round(totalShares * bar.close) });
  }
  const currentValue = totalShares * lastPrice;
  const avgCost = totalShares > 0 ? totalInvested / totalShares : 0;
  const returnPct = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;
  return { series, totalInvested, currentValue, totalShares, avgCost, lastPrice, returnPct };
}

export function DollarCostAveraging() {
  const { data: holdings = [] } = usePortfolio();
  const { parsedStatement } = useStatement();

  interface PortfolioHolding { ticker: string; }
  const tickers = useMemo(() => {
    const csv = (parsedStatement?.openPositions as OpenPosition[] | undefined)
      ?.filter(p => p.assetCategory === 'STK' && p.quantity > 0)
      .map(p => p.symbol) ?? [];
    const db = (holdings as PortfolioHolding[]).map(h => h.ticker).filter(Boolean);
    return [...new Set([...csv, ...db])];
  }, [holdings, parsedStatement]);

  const [ticker,    setTicker]    = useState('AAPL');
  const [amount,    setAmount]    = useState(500);
  const [freq,      setFreq]      = useState<Freq>('monthly');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 5);
    return d.toISOString().slice(0, 10);
  });
  const [endDate,  setEndDate]  = useState(() => new Date().toISOString().slice(0, 10));
  const [prices,   setPrices]   = useState<PriceBar[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [fetchErr, setFetchErr] = useState('');

  async function fetchPrices(sym: string) {
    if (!sym.trim()) return;
    setLoading(true);
    setFetchErr('');
    try {
      const res = await fetch(`${BACKEND}/api/prices?symbol=${encodeURIComponent(sym.trim())}&days=1825`);
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      const bars: PriceBar[] = (json.data ?? []).map((b: any) => ({
        date: b.report_date as string,
        close: b.close as number,
      }));
      if (bars.length === 0) throw new Error('No price data found for this symbol.');
      setPrices(bars);
    } catch (e: any) {
      setFetchErr(e.message ?? 'Failed to load prices');
      setPrices([]);
    } finally {
      setLoading(false);
    }
  }

  // Load default ticker on mount
  useEffect(() => { fetchPrices(ticker); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const r = useMemo(() => {
    if (prices.length === 0) return null;
    return compute(amount, freq, startDate, endDate, prices);
  }, [prices, amount, freq, startDate, endDate]);

  const positive = (r?.returnPct ?? 0) >= 0;

  return (
    <CalculatorShell
      title="Dollar-Cost Averaging"
      description="Model the result of investing a fixed amount at regular intervals into a single asset."
      inputs={<>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Ticker Symbol</Label>
          <div className="flex gap-2">
            <Input
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') fetchPrices(ticker); }}
              placeholder="AAPL"
              className="flex-1"
            />
            <button
              onClick={() => fetchPrices(ticker)}
              className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Load
            </button>
          </div>
          {tickers.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {tickers.slice(0, 8).map(t => (
                <Badge
                  key={t}
                  variant="outline"
                  className="cursor-pointer text-xs hover:bg-primary/10"
                  onClick={() => { setTicker(t); fetchPrices(t); }}
                >
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <NumInput label="Periodic Investment" value={amount} onChange={setAmount} min={1} step={100} prefix="$" />

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Frequency</Label>
          <div className="flex rounded-md border border-border overflow-hidden">
            {(['weekly', 'monthly', 'quarterly'] as Freq[]).map(f => (
              <button
                key={f}
                onClick={() => setFreq(f)}
                className={`flex-1 py-1.5 text-xs font-medium transition-colors capitalize ${
                  freq === f
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Start Date</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">End Date</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      </>}
      results={<>
        {loading && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-16">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading price data for {ticker}…
          </div>
        )}
        {!loading && fetchErr && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {fetchErr}
          </div>
        )}
        {!loading && !fetchErr && r && r.series.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatBox label="Total Invested"  value={fmtCompact(r.totalInvested)} />
              <StatBox label="Current Value"   value={fmtCompact(r.currentValue)} highlight={positive ? 'positive' : 'negative'} />
              <StatBox label="Total Shares"    value={r.totalShares.toLocaleString('en-US', { maximumFractionDigits: 4 })} />
              <StatBox label="Avg Cost / Share" value={`$${r.avgCost.toFixed(2)}`} sub={`vs $${r.lastPrice.toFixed(2)} now`} />
              <StatBox label="Total Return"    value={`${r.returnPct >= 0 ? '+' : ''}${r.returnPct.toFixed(1)}%`} highlight={positive ? 'positive' : 'negative'} />
            </div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">DCA: Invested vs Portfolio Value — {ticker}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={r.series} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <defs>
                      <linearGradient id="dcaGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="dcaGrey" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(0, 7)} interval="preserveStartEnd" />
                    <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                    <RechartsTooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="rounded-lg border bg-popover px-3 py-2 shadow-lg text-sm">
                            <p className="font-medium mb-1.5">{label}</p>
                            {payload.map((p, i) => (
                              <p key={`${String(p.dataKey)}-${i}`} style={{ color: p.color }} className="text-xs tabular-nums">
                                {p.name}: {fmtDollar(p.value as number)}
                              </p>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="invested" name="Total Invested"  stroke="#94a3b8" fill="url(#dcaGrey)"  strokeWidth={1.5} dot={false} />
                    <Area type="monotone" dataKey="value"    name="Portfolio Value" stroke="#22c55e" fill="url(#dcaGreen)" fillOpacity={0} strokeWidth={2}   dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Callout icon={positive ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-destructive" />}>
              Your average cost of{' '}
              <strong className="text-foreground">${r.avgCost.toFixed(2)}</strong> vs current price of{' '}
              <strong className="text-foreground">${r.lastPrice.toFixed(2)}</strong> ={' '}
              <strong className={positive ? 'text-green-500' : 'text-destructive'}>
                {r.returnPct >= 0 ? '+' : ''}{r.returnPct.toFixed(1)}%
              </strong>{' '}
              gain per share.
            </Callout>
          </>
        )}
        {!loading && !fetchErr && (!r || r.series.length === 0) && prices.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-6 text-sm text-center text-muted-foreground">
            No purchases would have occurred in the selected date range. Try extending the start date.
          </div>
        )}
      </>}
    />
  );
}
