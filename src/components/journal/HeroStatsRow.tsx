import { JournalStats } from '@/hooks/useTradeJournal';
import { fmtDollar } from '@/components/calculators/calcUtils';
import { TrendingUp, TrendingDown, Target, Activity, Zap, Flame } from 'lucide-react';

interface Tile {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'positive' | 'negative' | 'neutral';
}

interface Props {
  stats: JournalStats;
  currentStreak: { kind: 'win' | 'loss' | 'none'; length: number };
}

export function HeroStatsRow({ stats, currentStreak }: Props) {
  const streakLabel =
    currentStreak.kind === 'win' ? 'Win Streak' :
    currentStreak.kind === 'loss' ? 'Loss Streak' :
    'Streak';
  const streakValue = currentStreak.length > 0 ? `${currentStreak.length}` : '—';
  const streakIcon = currentStreak.kind === 'loss' ? Flame : TrendingUp;
  const streakTone: Tile['tone'] = currentStreak.kind === 'loss' ? 'negative' : currentStreak.kind === 'win' ? 'positive' : 'neutral';

  const tiles: Tile[] = [
    { label: 'Total P&L', value: fmtDollar(stats.totalPnL), icon: stats.totalPnL >= 0 ? TrendingUp : TrendingDown, tone: stats.totalPnL >= 0 ? 'positive' : 'negative' },
    { label: 'Win Rate', value: `${(stats.winRate * 100).toFixed(1)}%`, icon: Target, tone: 'neutral' },
    { label: 'Profit Factor', value: isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞', icon: Activity, tone: 'neutral' },
    { label: 'Expectancy / trade', value: fmtDollar(stats.expectancy), icon: TrendingUp, tone: stats.expectancy >= 0 ? 'positive' : 'negative' },
    { label: 'R-Expectancy', value: stats.rExpectancy !== null ? `${stats.rExpectancy >= 0 ? '+' : ''}${stats.rExpectancy.toFixed(2)}R` : '—', icon: Zap, tone: stats.rExpectancy === null ? 'neutral' : stats.rExpectancy >= 0 ? 'positive' : 'negative' },
    { label: streakLabel, value: streakValue, icon: streakIcon, tone: streakTone },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
      {tiles.map(t => (
        <div
          key={t.label}
          className={`bg-card rounded-lg p-4 border ${
            t.tone === 'positive' ? 'border-green-500/50' :
            t.tone === 'negative' ? 'border-destructive/50' :
            'border-border'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">{t.label}</span>
            <t.icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className={`text-lg font-semibold ${
            t.tone === 'positive' ? 'text-green-500' :
            t.tone === 'negative' ? 'text-destructive' :
            ''
          }`}>
            {t.value}
          </div>
        </div>
      ))}
    </div>
  );
}
