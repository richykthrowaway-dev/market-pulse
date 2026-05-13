// src/components/calculators/trading/RiskReward.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { fmtDollar, clamp } from '../calcUtils';

export function RiskReward() {
  const [entry, setEntry] = useState(100);
  const [target, setTarget] = useState(120);
  const [stopLoss, setStopLoss] = useState(95);
  const [shares, setShares] = useState(100);

  const r = useMemo(() => {
    const gainPerShare = target - entry;
    const lossPerShare = entry - stopLoss;
    const rrRatio = lossPerShare > 0 ? gainPerShare / lossPerShare : 0;
    const breakEvenWinRate = rrRatio > 0 ? (1 / (1 + rrRatio)) * 100 : 0;
    const potentialGain = shares * gainPerShare;
    const potentialLoss = shares * lossPerShare;
    const expectedValue = potentialGain * 0.5 - potentialLoss * 0.5;

    const span = target - stopLoss;
    const lossPct = span > 0 ? clamp((lossPerShare / span) * 100, 0, 100) : 0;
    const gainPct = 100 - lossPct;

    return {
      gainPerShare,
      lossPerShare,
      rrRatio,
      breakEvenWinRate,
      potentialGain,
      potentialLoss,
      expectedValue,
      lossPct,
      gainPct,
      valid: span > 0 && lossPerShare > 0 && gainPerShare > 0,
    };
  }, [entry, target, stopLoss, shares]);

  const rrLabel = r.rrRatio > 0 ? `${r.rrRatio.toFixed(1)} : 1` : '—';
  const breakEvenLabel = r.rrRatio > 0 ? `${r.breakEvenWinRate.toFixed(1)}%` : '—';

  return (
    <CalculatorShell
      title="Risk / Reward"
      description="Evaluate the asymmetry of a trade before you take it."
      inputs={
        <>
          <NumInput
            label="Entry Price"
            value={entry}
            onChange={setEntry}
            min={0}
            step={1}
            prefix="$"
          />
          <NumInput
            label="Target Price"
            value={target}
            onChange={setTarget}
            min={0}
            step={1}
            prefix="$"
          />
          <NumInput
            label="Stop-Loss Price"
            value={stopLoss}
            onChange={setStopLoss}
            min={0}
            step={1}
            prefix="$"
          />
          <NumInput
            label="Position Size"
            value={shares}
            onChange={setShares}
            min={1}
            step={1}
            suffix="shares"
          />
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatBox
              label="R/R Ratio"
              value={rrLabel}
              sub="Reward vs risk"
              highlight={r.rrRatio > 2 ? 'positive' : undefined}
            />
            <StatBox
              label="Potential Gain"
              value={r.gainPerShare > 0 ? fmtDollar(r.potentialGain) : '—'}
              sub="If target hit"
              highlight="positive"
            />
            <StatBox
              label="Potential Loss"
              value={r.lossPerShare > 0 ? `-${fmtDollar(r.potentialLoss)}` : '—'}
              sub="If stop hit"
              highlight="negative"
            />
            <StatBox
              label="Break-even Win Rate"
              value={breakEvenLabel}
              sub="To not lose money"
            />
            <StatBox
              label="Expected Value"
              value={r.valid ? fmtDollar(r.expectedValue) : '—'}
              sub="At 50% win rate"
              highlight={r.expectedValue > 0 ? 'positive' : 'negative'}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Price Zones</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-6">
              {r.valid ? (
                <>
                  <div className="relative h-16 rounded-md overflow-hidden border border-border">
                    <div
                      className="absolute inset-y-0 bg-destructive/30"
                      style={{ left: 0, width: `${r.lossPct}%` }}
                    />
                    <div
                      className="absolute inset-y-0 bg-success/30"
                      style={{ left: `${r.lossPct}%`, width: `${r.gainPct}%` }}
                    />
                    <div
                      className="absolute inset-y-0 w-0.5 bg-foreground"
                      style={{ left: `${r.lossPct}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-2 text-[11px] font-medium pointer-events-none">
                      <span className="text-destructive-foreground/90 bg-background/60 px-1.5 py-0.5 rounded">
                        Loss zone
                      </span>
                      <span className="text-foreground/90 bg-background/60 px-1.5 py-0.5 rounded">
                        Gain zone
                      </span>
                    </div>
                  </div>
                  <div className="relative mt-2 h-5 text-[11px] text-muted-foreground tabular-nums">
                    <span className="absolute left-0 -translate-x-0">
                      Stop {fmtDollar(stopLoss)}
                    </span>
                    <span
                      className="absolute -translate-x-1/2 font-semibold text-foreground"
                      style={{ left: `${r.lossPct}%` }}
                    >
                      Entry {fmtDollar(entry)}
                    </span>
                    <span className="absolute right-0">
                      Target {fmtDollar(target)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Set stop-loss below entry and target above entry to view zones.
                </p>
              )}
            </CardContent>
          </Card>

          {r.valid && (
            <Callout icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
              You need to win{' '}
              <strong className="text-foreground">{r.breakEvenWinRate.toFixed(1)}%</strong> of these
              trades just to break even — your R/R of{' '}
              <strong className="text-foreground">{r.rrRatio.toFixed(1)}:1</strong> requires a{' '}
              <strong className="text-foreground">{r.breakEvenWinRate.toFixed(1)}%</strong> win
              rate.
            </Callout>
          )}
        </>
      }
    />
  );
}
