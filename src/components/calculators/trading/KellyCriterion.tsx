// src/components/calculators/trading/KellyCriterion.tsx
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { fmtDollar } from '../calcUtils';
import { cn } from '@/lib/utils';

type KellyFraction = 'full' | 'half' | 'quarter';
const FRACTION_VALUE: Record<KellyFraction, number> = {
  full: 1,
  half: 0.5,
  quarter: 0.25,
};
const FRACTION_LABEL: Record<KellyFraction, string> = {
  full: 'Full',
  half: 'Half',
  quarter: 'Quarter',
};

function fullKellyPct(wr: number, ratio: number) {
  if (ratio <= 0) return 0;
  return (wr / 100 - (1 - wr / 100) / ratio) * 100;
}

export function KellyCriterion() {
  const [winRate, setWinRate] = useState(55);
  const [avgWin, setAvgWin] = useState(200);
  const [avgLoss, setAvgLoss] = useState(150);
  const [accountSize, setAccountSize] = useState(25_000);
  const [fraction, setFraction] = useState<KellyFraction>('half');

  const r = useMemo(() => {
    const ratio = avgLoss > 0 ? avgWin / avgLoss : 0;
    const full = fullKellyPct(winRate, ratio);
    const fractional = full * FRACTION_VALUE[fraction];
    const dollarRisk = accountSize * fractional / 100;
    const tradesToBust50 = full > 0
      ? 2 / Math.pow(full / 100, 2)
      : Infinity;
    return { ratio, full, fractional, dollarRisk, tradesToBust50 };
  }, [winRate, avgWin, avgLoss, accountSize, fraction]);

  const wrBuckets = [40, 50, 55, 60, 70];
  const rrBuckets = [1, 1.5, 2, 3];

  const currentWRBucket = wrBuckets.reduce(
    (best, b) => Math.abs(b - winRate) < Math.abs(best - winRate) ? b : best,
    wrBuckets[0],
  );
  const currentRRBucket = rrBuckets.reduce(
    (best, b) => Math.abs(b - r.ratio) < Math.abs(best - r.ratio) ? b : best,
    rrBuckets[0],
  );

  let calloutNode: React.ReactNode = null;
  if (r.full < 0) {
    calloutNode = (
      <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <div className="text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Negative Kelly.</strong> The math says don't bet —
          stop trading this strategy or change it. Your win rate and R:R combination is a loser.
        </div>
      </div>
    );
  } else if (r.full < 5) {
    calloutNode = (
      <Callout icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
        Small edge ({r.full.toFixed(1)}% full Kelly). Be conservative — variance will dominate
        results in the short run.
      </Callout>
    );
  } else if (r.full > 25) {
    calloutNode = (
      <Callout icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
        Full Kelly is <strong className="text-foreground">{r.full.toFixed(1)}%</strong> —
        mathematically optimal but practically reckless. Most pros use ¼ or ½ Kelly to survive
        variance and avoid catastrophic drawdowns.
      </Callout>
    );
  } else {
    calloutNode = (
      <Callout icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
        Full Kelly suggests risking{' '}
        <strong className="text-foreground">{r.full.toFixed(1)}%</strong> per trade. Using{' '}
        <strong className="text-foreground">{FRACTION_LABEL[fraction]} Kelly</strong> gives you{' '}
        <strong className="text-foreground">{r.fractional.toFixed(1)}%</strong> —
        {fmtDollar(r.dollarRisk)} per trade on a {fmtDollar(accountSize)} account.
      </Callout>
    );
  }

  return (
    <CalculatorShell
      title="Kelly Criterion"
      description="The mathematically-optimal fraction of capital to risk per trade."
      inputs={
        <>
          <NumInput
            label="Win Rate"
            value={winRate}
            onChange={setWinRate}
            min={0}
            max={100}
            step={1}
            suffix="%"
          />
          <NumInput
            label="Average Winner"
            value={avgWin}
            onChange={setAvgWin}
            min={0}
            step={10}
            prefix="$"
          />
          <NumInput
            label="Average Loser"
            value={avgLoss}
            onChange={setAvgLoss}
            min={0}
            step={10}
            prefix="$"
          />
          <NumInput
            label="Account Size"
            value={accountSize}
            onChange={setAccountSize}
            min={0}
            step={1000}
            prefix="$"
          />
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Kelly Fraction</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['full', 'half', 'quarter'] as KellyFraction[]).map(opt => (
                <Button
                  key={opt}
                  type="button"
                  variant={fraction === opt ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFraction(opt)}
                  className={cn('w-full', fraction === opt && 'font-semibold')}
                >
                  {FRACTION_LABEL[opt]}
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Most pros use Half or Quarter to survive variance.
            </p>
          </div>
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox
              label="Full Kelly"
              value={`${r.full.toFixed(1)}%`}
              sub="Of account per trade"
              highlight={r.full < 0 ? 'negative' : r.full > 0 ? 'positive' : undefined}
            />
            <StatBox
              label={`${FRACTION_LABEL[fraction]} Kelly`}
              value={`${r.fractional.toFixed(2)}%`}
              sub="Recommended risk"
              highlight={r.fractional > 0 ? 'positive' : 'negative'}
            />
            <StatBox
              label="Dollar Risk / Trade"
              value={fmtDollar(r.dollarRisk)}
              sub={`On ${fmtDollar(accountSize)}`}
            />
            <StatBox
              label="Trades to Bust 50%"
              value={
                !isFinite(r.tradesToBust50) || r.full <= 0
                  ? '—'
                  : fraction !== 'full'
                    ? 'Very unlikely'
                    : Math.round(r.tradesToBust50).toLocaleString()
              }
              sub="Rough approximation"
              highlight={fraction === 'full' && r.full > 25 ? 'warning' : undefined}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Sensitivity — Full Kelly % by Win Rate × R:R
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs uppercase">
                      <th className="text-left py-2 font-medium">Win Rate \ R:R</th>
                      {rrBuckets.map(rr => (
                        <th key={rr} className="text-right py-2 font-medium px-2">
                          {rr.toFixed(1)}x
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wrBuckets.map(wr => (
                      <tr key={wr} className="border-b last:border-b-0">
                        <td className="py-1.5 font-medium">{wr}%</td>
                        {rrBuckets.map(rr => {
                          const v = fullKellyPct(wr, rr);
                          const isCurrent = wr === currentWRBucket && rr === currentRRBucket;
                          return (
                            <td
                              key={rr}
                              className={cn(
                                'py-1.5 text-right px-2',
                                v < 0 && 'text-destructive',
                                v > 25 && 'text-amber-500',
                                isCurrent && 'bg-amber-500/10 font-semibold rounded',
                              )}
                            >
                              {v.toFixed(1)}%
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {calloutNode}
        </>
      }
    />
  );
}
