import { TradeEntry } from '@/hooks/useTradeJournal';
import { Card } from '@/components/ui/card';
import {
  computeEdgeMetrics,
  qualityForProfitFactor, qualityForSharpe, qualityForSortino,
  qualityForSQN, qualityForRecovery, qualityForKelly,
  type Quality,
} from './computeAdvancedStats';
import { Activity, Zap, Shield, Target, TrendingUp, Calculator, Info } from 'lucide-react';

const QUALITY_TEXT: Record<Quality, string> = {
  poor:       'text-destructive',
  ok:         'text-amber-500',
  good:       'text-green-500',
  excellent:  'text-emerald-400',
  neutral:    '',
};

const QUALITY_BORDER: Record<Quality, string> = {
  poor:       'border-destructive/40',
  ok:         'border-amber-500/40',
  good:       'border-green-500/40',
  excellent:  'border-emerald-400/50',
  neutral:    'border-border',
};

interface TileProps {
  label: string;
  value: string;
  sub?: string;
  quality: Quality;
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
}

function Tile({ label, value, sub, quality, icon: Icon, tooltip }: TileProps) {
  return (
    <Card className={`p-3 border ${QUALITY_BORDER[quality]}`} title={tooltip}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">
            {label}
          </span>
        </div>
        <Info className="h-3 w-3 text-muted-foreground/40 shrink-0 cursor-help" />
      </div>
      <p className={`text-xl font-bold tabular-nums ${QUALITY_TEXT[quality]}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </Card>
  );
}

export function EdgeQualityRow({ trades }: { trades: TradeEntry[] }) {
  const m = computeEdgeMetrics(trades);

  if (trades.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-1">Edge Quality</h3>
        <p className="text-sm text-muted-foreground">
          Log a few trades to compute risk-adjusted performance metrics.
        </p>
      </Card>
    );
  }

  const sqnInterpretation = m.sqn === null
    ? '—'
    : m.sqn < 1.6 ? 'Poor' : m.sqn < 2.0 ? 'Below avg' : m.sqn < 2.5 ? 'Average'
      : m.sqn < 3.0 ? 'Good' : m.sqn < 5.0 ? 'Excellent' : 'Holy grail';

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold">Edge Quality Metrics</h3>
        <span className="text-[10px] text-muted-foreground">
          Hover any tile for the formula and what counts as &quot;good&quot;.
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Tile
          label="Profit Factor"
          value={isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : '∞'}
          sub={m.profitFactor >= 1.5 ? 'Profitable system' : m.profitFactor >= 1 ? 'Marginal' : 'Losing'}
          quality={qualityForProfitFactor(m.profitFactor)}
          icon={Activity}
          tooltip="Profit Factor = Gross Wins ÷ Gross Losses. >1.0 = profitable, >1.5 = solid, >2.5 = excellent."
        />

        <Tile
          label="Sharpe"
          value={m.sharpe.toFixed(2)}
          sub="per trade"
          quality={qualityForSharpe(m.sharpe)}
          icon={TrendingUp}
          tooltip="Sharpe (per trade) = mean(P&L) ÷ stdDev(P&L). Higher = more consistent edge. >0.10 = ok, >0.25 = good."
        />

        <Tile
          label="Sortino"
          value={m.sortino.toFixed(2)}
          sub="downside only"
          quality={qualityForSortino(m.sortino)}
          icon={Shield}
          tooltip="Sortino = mean(P&L) ÷ stdDev(only losing trades). Like Sharpe but only penalises losses. >0.15 = ok, >0.35 = good."
        />

        <Tile
          label="SQN"
          value={m.sqn === null ? '—' : m.sqn.toFixed(2)}
          sub={m.sqn === null ? 'Need ≥5 trades with stops' : sqnInterpretation}
          quality={qualityForSQN(m.sqn)}
          icon={Zap}
          tooltip="System Quality Number (Van Tharp) = √N × mean(R) ÷ stdDev(R). 1.6–2.5 = average, 2.5–3.0 = good, 3.0+ = excellent."
        />

        <Tile
          label="Recovery"
          value={isFinite(m.recoveryFactor) ? m.recoveryFactor.toFixed(2) : '∞'}
          sub={m.maxDrawdown > 0 ? `Max DD: $${m.maxDrawdown.toFixed(0)}` : 'No drawdown'}
          quality={qualityForRecovery(m.recoveryFactor)}
          icon={Target}
          tooltip="Recovery Factor = Net P&L ÷ Max Drawdown. >1 = recovered from worst trough, >3 = great, >5 = excellent."
        />

        <Tile
          label="Kelly %"
          value={`${m.kellyPct >= 0 ? '' : '−'}${Math.abs(m.kellyPct).toFixed(1)}%`}
          sub={
            m.kellyPct < 0     ? 'No edge — stop trading'
            : m.kellyPct < 5   ? 'Small edge'
            : m.kellyPct < 15  ? 'Moderate edge'
            : 'Strong edge'
          }
          quality={qualityForKelly(m.kellyPct)}
          icon={Calculator}
          tooltip="Kelly Criterion = W − (1−W)/R, where R = avgWin÷avgLoss. The mathematically optimal % of capital to risk per trade. Most pros use ¼ or ½ Kelly for safety."
        />
      </div>
    </div>
  );
}
