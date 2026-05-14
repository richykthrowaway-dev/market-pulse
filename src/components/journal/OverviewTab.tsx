import { useMemo } from 'react';
import { JournalStats, TradeEntry, computePnL, computeR } from '@/hooks/useTradeJournal';
import { JournalSettings } from '@/hooks/useJournalSettings';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fmtDollar } from '@/components/calculators/calcUtils';
import { KillSwitchBanner } from './KillSwitchBanner';
import { GoalProgressCard } from './GoalProgressCard';
import { InsightCard } from './InsightCard';
import { OutlierLossList } from './OutlierLossList';
import {
  computeDayOfWeekInsight,
  computeAfterLossInsight,
  computeOutlierLosses,
} from './computeInsights';
import {
  TrendingUp, TrendingDown, Trophy, AlertTriangle,
  Lightbulb, ArrowUp, ArrowDown, Minus, CalendarDays,
  ChevronRight, LineChart as LineChartIcon, Scale,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ── Helpers ───────────────────────────────────────────────────────────────────

function sumPnLRange(trades: TradeEntry[], from: string, to?: string): number {
  return trades
    .filter(t => t.exitDate >= from && (to === undefined || t.exitDate < to))
    .reduce((s, t) => s + computePnL(t), 0);
}

function isoWeekStart(offsetWeeks = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + offsetWeeks * 7); // Sunday start
  return d.toISOString().slice(0, 10);
}

function fmtCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)    return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

// ── Top stat row: Today / Week / Month / W:L Ratio ───────────────────────────

function TopStatsRow({ trades, stats }: { trades: TradeEntry[]; stats: JournalStats }) {
  const today = new Date().toISOString().slice(0, 10);
  const weekStart      = isoWeekStart(0);
  const lastWeekStart  = isoWeekStart(-1);
  const monthStart     = today.slice(0, 8) + '01';

  const todayTrades = trades.filter(t => t.exitDate === today);
  const todayPnL    = todayTrades.reduce((s, t) => s + computePnL(t), 0);
  const todayWins   = todayTrades.filter(t => computePnL(t) > 0).length;
  const todayLosses = todayTrades.filter(t => computePnL(t) < 0).length;

  const thisWeekPnL = sumPnLRange(trades, weekStart);
  const lastWeekPnL = sumPnLRange(trades, lastWeekStart, weekStart);
  const weekDelta   = thisWeekPnL - lastWeekPnL;

  const monthPnL    = sumPnLRange(trades, monthStart);
  const monthCount  = trades.filter(t => t.exitDate >= monthStart).length;

  const winLossRatio = stats.avgLoss !== 0 ? Math.abs(stats.avgWin / stats.avgLoss) : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Today ─────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Today</span>
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        {todayTrades.length === 0 ? (
          <>
            <p className="text-2xl font-bold text-muted-foreground">—</p>
            <p className="text-xs text-muted-foreground mt-0.5">No trades logged</p>
          </>
        ) : (
          <>
            <p className={`text-2xl font-bold ${todayPnL >= 0 ? 'text-green-500' : 'text-destructive'}`}>
              {todayPnL >= 0 ? '+' : ''}{fmtCompact(todayPnL)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {todayTrades.length} trade{todayTrades.length !== 1 ? 's' : ''} · {todayWins}W / {todayLosses}L
            </p>
          </>
        )}
      </Card>

      {/* This week ─────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">This week</span>
          {weekDelta > 0
            ? <ArrowUp className="h-3.5 w-3.5 text-green-500" />
            : weekDelta < 0
            ? <ArrowDown className="h-3.5 w-3.5 text-destructive" />
            : <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
        <p className={`text-2xl font-bold ${thisWeekPnL >= 0 ? 'text-green-500' : thisWeekPnL < 0 ? 'text-destructive' : ''}`}>
          {thisWeekPnL > 0 ? '+' : ''}{thisWeekPnL === 0 ? '—' : fmtCompact(thisWeekPnL)}
        </p>
        {lastWeekPnL !== 0 ? (
          <p className={`text-xs mt-0.5 ${weekDelta >= 0 ? 'text-green-500' : 'text-destructive'}`}>
            {weekDelta >= 0 ? '↑' : '↓'} {fmtCompact(Math.abs(weekDelta))} vs last week
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">Last week: no trades</p>
        )}
      </Card>

      {/* This month ─────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">This month</span>
          {monthPnL >= 0
            ? <TrendingUp className="h-3.5 w-3.5 text-green-500" />
            : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
        </div>
        <p className={`text-2xl font-bold ${monthPnL >= 0 ? 'text-green-500' : 'text-destructive'}`}>
          {monthPnL > 0 ? '+' : ''}{monthPnL === 0 ? '—' : fmtCompact(monthPnL)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date().toLocaleString('default', { month: 'short' })} · {monthCount} trade{monthCount !== 1 ? 's' : ''}
        </p>
      </Card>

      {/* Avg W:L Ratio ──────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Avg W : L</span>
          <Scale className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <p className={`text-2xl font-bold ${winLossRatio >= 1.5 ? 'text-green-500' : winLossRatio >= 1 ? '' : 'text-amber-500'}`}>
          {winLossRatio > 0 ? `${winLossRatio.toFixed(2)} : 1` : '—'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
          {stats.avgWin > 0 ? `+${fmtCompact(stats.avgWin)}` : '—'} / {stats.avgLoss < 0 ? fmtCompact(stats.avgLoss) : '—'}
        </p>
      </Card>
    </div>
  );
}

// ── Mini equity curve ────────────────────────────────────────────────────────

function MiniEquityCurve({ trades }: { trades: TradeEntry[] }) {
  const data = useMemo(() => {
    if (trades.length === 0) return [];
    const sorted = [...trades].sort((a, b) => a.exitDate.localeCompare(b.exitDate));
    // Aggregate by exit date so the curve is daily, not per-trade
    const byDate = new Map<string, number>();
    for (const t of sorted) {
      byDate.set(t.exitDate, (byDate.get(t.exitDate) ?? 0) + computePnL(t));
    }
    let cum = 0;
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, pnl]) => {
        cum += pnl;
        return { date, cumPnL: cum };
      });
  }, [trades]);

  if (data.length === 0) {
    return (
      <Card className="p-5 h-full">
        <div className="flex items-center gap-2 mb-3">
          <LineChartIcon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Equity curve</h3>
        </div>
        <div className="flex items-center justify-center h-44 text-sm text-muted-foreground">
          Log a few trades to see your trajectory
        </div>
      </Card>
    );
  }

  const final = data[data.length - 1].cumPnL;
  const max   = Math.max(...data.map(d => d.cumPnL), 0);
  const min   = Math.min(...data.map(d => d.cumPnL), 0);
  const drawdown = max - final;
  const color = final >= 0 ? '#22c55e' : '#ef4444';

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <LineChartIcon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Equity curve</h3>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-muted-foreground">Total: </span>
            <span className={`font-semibold tabular-nums ${final >= 0 ? 'text-green-500' : 'text-destructive'}`}>
              {final >= 0 ? '+' : ''}{fmtDollar(final)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Peak: </span>
            <span className="font-semibold tabular-nums">{fmtDollar(max)}</span>
          </div>
          {drawdown > 0 && (
            <div>
              <span className="text-muted-foreground">Drawdown: </span>
              <span className="font-semibold text-destructive tabular-nums">-{fmtDollar(drawdown)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="overviewEqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={v => {
                const d = new Date(v + 'T00:00:00');
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
              minTickGap={28}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={v =>
                Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`
              }
              width={48}
              domain={[Math.min(min, 0), Math.max(max, 0)]}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(v: number) => [fmtDollar(v), 'Cumulative']}
            />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="cumPnL" stroke={color} fill="url(#overviewEqGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ── Last 10 trades strip + Recent trades list ─────────────────────────────────

function RecentActivityCard({
  trades,
  onEdit,
}: {
  trades: TradeEntry[];
  onEdit?: (id: string) => void;
}) {
  const last10 = trades.slice(0, 10);   // already sorted desc
  const recent = trades.slice(0, 5);

  if (trades.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Recent activity</h3>
        <p className="text-sm text-muted-foreground">
          No trades yet — log your first trade or import an IBKR statement.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      {/* Last 10 strip */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            Last {last10.length} trades
          </p>
          {last10.length > 0 && (
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {last10.filter(t => computePnL(t) > 0).length}W ·{' '}
              {last10.filter(t => computePnL(t) < 0).length}L
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {last10.map(t => {
            const pnl = computePnL(t);
            return (
              <div
                key={t.id}
                title={`${t.symbol}: ${pnl >= 0 ? '+' : ''}${fmtDollar(pnl)} on ${t.exitDate}`}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110 ${
                  pnl > 0
                    ? 'bg-green-500/20 border-green-500'
                    : pnl < 0
                    ? 'bg-destructive/20 border-destructive'
                    : 'bg-muted border-muted-foreground/30'
                }`}
              >
                <span className={`text-[9px] font-bold leading-none ${
                  pnl > 0 ? 'text-green-500' : pnl < 0 ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {pnl > 0 ? 'W' : pnl < 0 ? 'L' : '='}
                </span>
              </div>
            );
          })}
          {last10.length < 10 && (
            <span className="text-[10px] text-muted-foreground ml-1">
              {10 - last10.length} more
            </span>
          )}
        </div>
      </div>

      {/* Recent trades list */}
      <div className="border-t pt-3">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-2">
          Recent trades
        </p>
        <ul className="space-y-0.5">
          {recent.map(t => {
            const pnl = computePnL(t);
            const r = computeR(t);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onEdit?.(t.id)}
                  disabled={!onEdit}
                  className="w-full flex items-center justify-between text-sm rounded-md px-2 py-1.5 hover:bg-muted disabled:hover:bg-transparent transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium tabular-nums w-16 truncate text-left">{t.symbol}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] py-0 px-1.5 ${
                        t.side === 'long'
                          ? 'border-green-500/50 text-green-600'
                          : 'border-destructive/50 text-destructive'
                      }`}
                    >
                      {t.side}
                    </Badge>
                    {t.setup && (
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5 hidden md:inline-flex">
                        {t.setup}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground truncate">{t.exitDate}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r !== null && (
                      <span className={`text-xs tabular-nums ${r >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                        {r >= 0 ? '+' : ''}{r.toFixed(1)}R
                      </span>
                    )}
                    <span className={`font-semibold tabular-nums ${pnl >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                      {pnl >= 0 ? '+' : ''}{fmtDollar(pnl)}
                    </span>
                    {onEdit && (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

// ── Best / worst setup ────────────────────────────────────────────────────────

interface SetupStat {
  name: string;
  count: number;
  wins: number;
  pnl: number;
  winRate: number;
}

function BestWorstSetupCard({ stats }: { stats: SetupStat[] }) {
  const best = stats[0];
  const worst = stats[stats.length - 1];
  const showWorst = stats.length >= 2 && worst.pnl < 0 && worst.name !== best.name;

  return (
    <div className={`grid grid-cols-1 gap-3 ${showWorst ? 'sm:grid-cols-2' : ''}`}>
      <Card className="p-4 border-green-500/30">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Best setup</span>
        </div>
        <p className="font-semibold truncate">{best.name}</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          <span className="text-green-500 font-medium">{fmtDollar(best.pnl)}</span>
          {' · '}{(best.winRate * 100).toFixed(0)}% WR
          {' · '}{best.count} trade{best.count !== 1 ? 's' : ''}
        </p>
      </Card>

      {showWorst && (
        <Card className="p-4 border-destructive/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Worst setup</span>
          </div>
          <p className="font-semibold truncate">{worst.name}</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="text-destructive font-medium">{fmtDollar(worst.pnl)}</span>
            {' · '}{(worst.winRate * 100).toFixed(0)}% WR
            {' · '}{worst.count} trade{worst.count !== 1 ? 's' : ''}
          </p>
        </Card>
      )}
    </div>
  );
}

// ── Performance by side (long vs short) ──────────────────────────────────────

function PerformanceBySideCard({ trades }: { trades: TradeEntry[] }) {
  const breakdown = useMemo(() => {
    const buckets = { long: { count: 0, wins: 0, pnl: 0 }, short: { count: 0, wins: 0, pnl: 0 } };
    for (const t of trades) {
      const b = buckets[t.side];
      const pnl = computePnL(t);
      b.count += 1;
      b.pnl += pnl;
      if (pnl > 0) b.wins += 1;
    }
    return buckets;
  }, [trades]);

  if (breakdown.long.count === 0 && breakdown.short.count === 0) return null;

  const Row = ({ label, side }: { label: string; side: 'long' | 'short' }) => {
    const b = breakdown[side];
    if (b.count === 0) return null;
    const winRate = (b.wins / b.count) * 100;
    return (
      <div className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-1.5 h-4 rounded-sm ${side === 'long' ? 'bg-green-500' : 'bg-destructive'}`} />
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">({b.count})</span>
        </div>
        <div className="flex items-center gap-3 text-xs tabular-nums">
          <span className="text-muted-foreground">{winRate.toFixed(0)}% WR</span>
          <span className={`font-semibold ${b.pnl >= 0 ? 'text-green-500' : 'text-destructive'}`}>
            {b.pnl >= 0 ? '+' : ''}{fmtCompact(b.pnl)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold mb-2">By direction</h3>
      <div className="divide-y divide-border/50">
        <Row label="Long" side="long" />
        <Row label="Short" side="short" />
      </div>
    </Card>
  );
}

// ── Insights section with placeholder ────────────────────────────────────────

function InsightsSection({
  trades,
  dowInsight,
  afterLossInsight,
}: {
  trades: TradeEntry[];
  dowInsight: ReturnType<typeof computeDayOfWeekInsight>;
  afterLossInsight: ReturnType<typeof computeAfterLossInsight>;
}) {
  const hasInsights = dowInsight || afterLossInsight;

  if (hasInsights) {
    return (
      <div className="space-y-3">
        {dowInsight && <InsightCard insight={dowInsight} />}
        {afterLossInsight && <InsightCard insight={afterLossInsight} />}
      </div>
    );
  }

  // Show placeholder only when there's something to unlock soon
  if (trades.length < 5 || trades.length >= 40) return null;
  const needed = Math.max(0, 21 - trades.length);

  return (
    <div className="border border-dashed border-muted-foreground/30 rounded-lg p-4 flex items-start gap-3 opacity-60">
      <Lightbulb className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="text-sm text-muted-foreground">
        <p className="font-medium">Pattern insights unlock soon</p>
        <p className="text-xs mt-0.5">
          {needed > 0
            ? `Log ${needed} more trade${needed !== 1 ? 's' : ''} — we'll analyse your day-of-week and after-loss patterns.`
            : 'Keep trading — patterns will surface as your data grows.'}
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  stats: JournalStats;
  trades: TradeEntry[];
  settings: JournalSettings;
  openEditTrade?: (id: string) => void;
}

export function OverviewTab({ stats, trades, settings, openEditTrade }: Props) {
  const dowInsight       = useMemo(() => computeDayOfWeekInsight(trades), [trades]);
  const afterLossInsight = useMemo(() => computeAfterLossInsight(trades), [trades]);
  const outliers         = useMemo(() => computeOutlierLosses(trades), [trades]);

  const setupStats = useMemo((): SetupStat[] => {
    const map = new Map<string, { count: number; wins: number; pnl: number }>();
    for (const t of trades) {
      if (!t.setup) continue;
      const s = map.get(t.setup) ?? { count: 0, wins: 0, pnl: 0 };
      const pnl = computePnL(t);
      s.count += 1;
      s.pnl += pnl;
      if (pnl > 0) s.wins += 1;
      map.set(t.setup, s);
    }
    return [...map.entries()]
      .map(([name, s]) => ({ name, ...s, winRate: s.count > 0 ? s.wins / s.count : 0 }))
      .filter(s => s.count >= 3)
      .sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  return (
    <div className="space-y-4">
      {/* Banner — only when triggered */}
      <KillSwitchBanner trades={trades} settings={settings} />

      {/* Top stat row — 4 columns on desktop */}
      <TopStatsRow trades={trades} stats={stats} />

      {/* Dashboard grid: main (2/3) + sidebar (1/3) ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ─── MAIN COLUMN (2/3 on desktop) ───────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <MiniEquityCurve trades={trades} />
          <RecentActivityCard trades={trades} onEdit={openEditTrade} />
          {setupStats.length >= 1 && <BestWorstSetupCard stats={setupStats} />}
        </div>

        {/* ─── SIDEBAR (1/3 on desktop) ───────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">
          <GoalProgressCard trades={trades} settings={settings} />
          <PerformanceBySideCard trades={trades} />
          <InsightsSection
            trades={trades}
            dowInsight={dowInsight}
            afterLossInsight={afterLossInsight}
          />
          <OutlierLossList outliers={outliers} onClick={openEditTrade} />
        </div>
      </div>
    </div>
  );
}
