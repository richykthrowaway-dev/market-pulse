import React from 'react';
import { Card } from '@/components/ui/card';
import { useMarketReturns } from '@/hooks/useMarketReturns';

// ── Shared bar component ────────────────────────────────────────────────────

interface BreadthBarProps {
  leftLabel: string;
  leftCount: number;
  leftPct: string;
  rightLabel: string;
  rightCount: number;
  rightPct: string;
  greenRatio: number; // 0..1
}

function BreadthBar({
  leftLabel,
  leftCount,
  leftPct,
  rightLabel,
  rightCount,
  rightPct,
  greenRatio,
}: BreadthBarProps) {
  return (
    <Card className="p-3">
      {/* Labels row */}
      <div className="flex items-baseline justify-between mb-1">
        <div>
          <span className="text-xs font-semibold text-success">{leftLabel}</span>
        </div>
        <div className="text-right">
          <span className="text-xs font-semibold text-danger">{rightLabel}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-bold text-success">
          {leftPct} ({leftCount.toLocaleString()})
        </span>
        <span className="text-sm font-bold text-danger">
          ({rightCount.toLocaleString()}) {rightPct}
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex h-2 rounded-full overflow-hidden">
        <div
          className="bg-success transition-all duration-500"
          style={{ width: `${(greenRatio * 100).toFixed(1)}%` }}
        />
        <div
          className="bg-danger transition-all duration-500"
          style={{ width: `${((1 - greenRatio) * 100).toFixed(1)}%` }}
        />
      </div>
    </Card>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function MarketBreadthCards() {
  // Single 1D call — shared via React Query with MarketOverviewCard (zero extra requests)
  const { data, isLoading } = useMarketReturns('1D');

  const { up, down } = data?.stats ?? { up: 0, down: 0 };
  const adTotal = up + down;

  // New highs/lows computed server-side via get_new_highs_lows() RPC
  const newHigh = data?.new_high ?? 0;
  const newLow  = data?.new_low  ?? 0;
  const hlTotal = newHigh + newLow || 1;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card className="p-3 h-20 animate-pulse" />
        <Card className="p-3 h-20 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Advancing / Declining */}
      <BreadthBar
        leftLabel="Advancing"
        leftCount={up}
        leftPct={adTotal > 0 ? `${((up / adTotal) * 100).toFixed(1)}%` : '—'}
        rightLabel="Declining"
        rightCount={down}
        rightPct={adTotal > 0 ? `${((down / adTotal) * 100).toFixed(1)}%` : '—'}
        greenRatio={adTotal > 0 ? up / adTotal : 0.5}
      />

      {/* New High / New Low */}
      <BreadthBar
        leftLabel="New High"
        leftCount={newHigh}
        leftPct={`${((newHigh / hlTotal) * 100).toFixed(1)}%`}
        rightLabel="New Low"
        rightCount={newLow}
        rightPct={`${((newLow / hlTotal) * 100).toFixed(1)}%`}
        greenRatio={newHigh / hlTotal}
      />
    </div>
  );
}
