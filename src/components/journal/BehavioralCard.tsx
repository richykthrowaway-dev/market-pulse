import { TradeEntry } from '@/hooks/useTradeJournal';
import { Card } from '@/components/ui/card';
import { fmtDollar } from '@/components/calculators/calcUtils';
import { computeBehavioral } from './computeAdvancedStats';
import {
  ShieldCheck, ShieldX, Flame, TrendingUp, TrendingDown, Brain,
} from 'lucide-react';

export function BehavioralCard({ trades }: { trades: TradeEntry[] }) {
  const b = computeBehavioral(trades);

  if (trades.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-1">Behavioural & Compliance</h3>
        <p className="text-sm text-muted-foreground">No trades yet.</p>
      </Card>
    );
  }

  const playbookComplianceRate =
    b.totalTagged > 0 ? (b.inPlaybook.count / b.totalTagged) * 100 : null;

  // Cost-of-off-script — how much money flowed to off-script trades
  const offScriptIsLosing = b.offScript.count > 0 && b.offScript.pnl < 0;
  const tiltIsLosing      = b.tilt.count >= 3 && b.tilt.pnl < 0;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Behavioural & Compliance</h3>
      </div>

      <div className="space-y-4">
        {/* ── Playbook compliance ─────────────────────────────────────── */}
        <div>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-2">
            Playbook compliance
            {playbookComplianceRate !== null && (
              <span className="ml-2 text-foreground">
                {playbookComplianceRate.toFixed(0)}% in-playbook
              </span>
            )}
          </p>
          {b.totalTagged === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Tag trades with the &quot;in playbook&quot; toggle to track compliance.
            </p>
          ) : (
            <div className="space-y-1.5">
              {/* In-playbook row */}
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                  <span>In playbook</span>
                  <span className="text-xs text-muted-foreground">({b.inPlaybook.count})</span>
                </span>
                <div className="flex items-center gap-3 text-xs tabular-nums">
                  <span className="text-muted-foreground">{(b.inPlaybook.winRate * 100).toFixed(0)}% WR</span>
                  <span className={`font-semibold ${b.inPlaybook.pnl >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                    {b.inPlaybook.pnl >= 0 ? '+' : ''}{fmtDollar(b.inPlaybook.pnl)}
                  </span>
                </div>
              </div>

              {/* Off-script row */}
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <ShieldX className={`h-3.5 w-3.5 ${offScriptIsLosing ? 'text-destructive' : 'text-muted-foreground'}`} />
                  <span>Off-script</span>
                  <span className="text-xs text-muted-foreground">({b.offScript.count})</span>
                </span>
                <div className="flex items-center gap-3 text-xs tabular-nums">
                  <span className="text-muted-foreground">
                    {b.offScript.count > 0 ? `${(b.offScript.winRate * 100).toFixed(0)}% WR` : '—'}
                  </span>
                  <span className={`font-semibold ${b.offScript.pnl >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                    {b.offScript.count > 0
                      ? `${b.offScript.pnl >= 0 ? '+' : ''}${fmtDollar(b.offScript.pnl)}`
                      : '—'}
                  </span>
                </div>
              </div>

              {/* Off-script callout when negative */}
              {offScriptIsLosing && (
                <p className="text-[11px] text-destructive/80 mt-1 pl-5">
                  Off-script trades cost you {fmtDollar(-b.offScript.pnl)} — stick to the plan.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Tilt ────────────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-2">
            Tilt P&amp;L (after 2+ consecutive losses)
          </p>
          {b.tilt.count === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No tilt situations yet — no streaks of 2+ losses recorded.
            </p>
          ) : (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Flame className={`h-3.5 w-3.5 ${tiltIsLosing ? 'text-destructive' : 'text-muted-foreground'}`} />
                <span>After tilt trigger</span>
                <span className="text-xs text-muted-foreground">({b.tilt.count})</span>
              </span>
              <div className="flex items-center gap-3 text-xs tabular-nums">
                <span className="text-muted-foreground">{(b.tilt.winRate * 100).toFixed(0)}% WR</span>
                <span className={`font-semibold ${b.tilt.pnl >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                  {b.tilt.pnl >= 0 ? '+' : ''}{fmtDollar(b.tilt.pnl)}
                </span>
              </div>
            </div>
          )}
          {tiltIsLosing && (
            <p className="text-[11px] text-destructive/80 mt-1 pl-5">
              Consider a mandatory cool-down after 2 losses — these trades are bleeding you.
            </p>
          )}
        </div>

        {/* ── Streaks ─────────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-2">
            Career streaks
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-muted/30 px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                <span className="text-xs">Max win streak</span>
              </div>
              <span className="text-lg font-bold text-green-500 tabular-nums">{b.maxWinStreak}</span>
            </div>
            <div className="rounded-md bg-muted/30 px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs">Max loss streak</span>
              </div>
              <span className="text-lg font-bold text-destructive tabular-nums">{b.maxLossStreak}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
