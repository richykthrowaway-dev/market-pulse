import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOpenTrades } from '@/hooks/useOpenTrades';
import { useLiveQuotes } from '@/hooks/useLiveQuotes';
import { useLiveSpeed } from '@/hooks/useLiveSpeed';
import { useTradeJournal } from '@/hooks/useTradeJournal';
import { unrealizedPnl } from '@/lib/tradeMetrics';
import { aggregateRisk } from '@/lib/portfolioRisk';
import { pnlOn, realizedPnL } from '@/lib/journalWindows';
import { usMarketSession } from '@/lib/marketSession';

const money = (n: number) =>
  (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 });

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function readAccount(): number | undefined {
  try {
    const r = localStorage.getItem('tp-risk-v1');
    if (!r) return undefined;
    const p = JSON.parse(r);
    return typeof p?.account === 'number' ? p.account : undefined;
  } catch { return undefined; }
}

function Tile({ label, value, sub, tone, to }: {
  label: string; value: string; sub?: string;
  tone?: 'pos' | 'neg' | 'warn'; to?: string;
}) {
  const color = tone === 'pos' ? 'text-trading-buy' : tone === 'neg' ? 'text-trading-sell'
    : tone === 'warn' ? 'text-warning' : 'text-foreground';
  const inner = (
    <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-base font-semibold font-mono-num leading-tight ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
  return to ? <Link to={to} className="block hover:opacity-90 transition-opacity">{inner}</Link> : inner;
}

/** Compact pill for the navbar inline variant */
function Chip({ label, value, tone, to }: {
  label: string; value: string;
  tone?: 'pos' | 'neg'; to?: string;
}) {
  const color = tone === 'pos' ? 'text-trading-buy' : tone === 'neg' ? 'text-trading-sell' : 'text-foreground';
  const inner = (
    <div className="flex flex-col items-center px-2.5 leading-none">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-[11px] font-semibold font-mono-num mt-0.5 ${color}`}>{value}</span>
    </div>
  );
  return to
    ? <Link to={to} className="hover:opacity-80 transition-opacity">{inner}</Link>
    : inner;
}

interface YourSnapshotProps {
  /** 'grid' (default) = 4-tile card row; 'inline' = compact navbar chips */
  variant?: 'grid' | 'inline';
}

export function YourSnapshot({ variant = 'grid' }: YourSnapshotProps) {
  const { trades: open } = useOpenTrades();
  const { intervalMs } = useLiveSpeed();
  const openSymbols = useMemo(
    () => Array.from(new Set(open.map((t) => t.symbol).filter(Boolean))),
    [open],
  );
  const quotes = useLiveQuotes(openSymbols, intervalMs);
  const { trades: journal, stats, currentStreak } = useTradeJournal();

  const account = readAccount();
  const openPnl = useMemo(() => open.reduce((s, t) => {
    const q = quotes[t.symbol.trim().toUpperCase()];
    if (q?.price == null) return s;
    return s + unrealizedPnl(t.side, t.entryPrice, q.price, t.quantity).dollars;
  }, 0), [open, quotes]);
  const risk = useMemo(() => aggregateRisk(open, account), [open, account]);

  const today = isoDaysAgo(0);
  const todayPnl = useMemo(() => pnlOn(journal, today), [journal, today]);
  const weekPnl = useMemo(() => realizedPnL(journal, isoDaysAgo(7)), [journal]);

  const session = usMarketSession(new Date());
  const tone = (n: number) => (n > 0 ? 'pos' : n < 0 ? 'neg' : undefined) as 'pos' | 'neg' | undefined;
  const streakTxt = currentStreak.kind === 'none' ? '—'
    : `${currentStreak.kind === 'win' ? '🔥' : '🧊'} ${currentStreak.length}${currentStreak.kind === 'win' ? 'W' : 'L'}`;

  // ── Inline navbar variant ──────────────────────────────────────────────────
  if (variant === 'inline') {
    return (
      <div className="hidden lg:flex items-center divide-x divide-border/50 border border-border/40 rounded-md overflow-hidden bg-card/60">
        <Chip
          label="P&L"
          value={open.length ? money(openPnl) : '—'}
          tone={open.length ? tone(openPnl) : undefined}
          to="/trading"
        />
        <Chip
          label="Risk"
          value={open.length ? (risk.pct != null ? `${risk.pct.toFixed(1)}%` : '—') : '—'}
          to="/trading"
        />
        <Chip
          label="Today"
          value={journal.length ? money(todayPnl) : '—'}
          tone={journal.length ? tone(todayPnl) : undefined}
          to="/journal"
        />
        <Chip
          label="Week"
          value={journal.length ? money(weekPnl) : '—'}
          tone={journal.length ? tone(weekPnl) : undefined}
          to="/journal"
        />
        {/* Session pill */}
        <div className="px-2.5 flex items-center">
          <span className={`text-[9px] font-mono-num whitespace-nowrap ${
            session.open ? 'text-trading-buy' : 'text-muted-foreground'
          }`}>
            {session.open ? '🟢' : '🔴'} {session.label}
          </span>
        </div>
      </div>
    );
  }

  // ── Grid variant (default) ─────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your snapshot</p>
        <span className={`text-[11px] font-mono-num rounded-full border px-2 py-0.5 ${
          session.open ? 'border-trading-buy/40 text-trading-buy' : 'border-border/60 text-muted-foreground'
        }`}>
          {session.open ? '🟢 US open' : '🔴 US closed'} · {session.label}
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile
          label="Open P&L"
          value={open.length ? money(openPnl) : '—'}
          sub={open.length ? `${open.length} open position${open.length === 1 ? '' : 's'}` : 'No open positions'}
          tone={open.length ? tone(openPnl) : undefined}
          to="/trading"
        />
        <Tile
          label="Open risk"
          value={open.length ? money(risk.totalRisk) : '—'}
          sub={risk.pct != null ? `${risk.pct.toFixed(2)}% of account` : (open.length ? 'set account in plan' : '—')}
          to="/trading"
        />
        <Tile
          label="Today realized"
          value={journal.length ? money(todayPnl) : '—'}
          sub={journal.length ? `Win rate ${(stats.winRate * 100).toFixed(0)}%` : 'No trades logged'}
          tone={journal.length ? tone(todayPnl) : undefined}
          to="/journal"
        />
        <Tile
          label="This week"
          value={journal.length ? money(weekPnl) : '—'}
          sub={journal.length ? `Streak ${streakTxt}` : 'Log your first trade'}
          tone={journal.length ? tone(weekPnl) : undefined}
          to="/journal"
        />
      </div>
    </div>
  );
}
