// src/components/calculators/StatBox.tsx
import { cn } from '@/lib/utils';

interface StatBoxProps {
  label: string;
  value: string;
  sub?: string;
  className?: string;
  highlight?: 'positive' | 'negative' | 'warning';
}

export function StatBox({ label, value, sub, className, highlight }: StatBoxProps) {
  return (
    <div className={cn(
      'rounded-xl border bg-card px-4 py-3',
      highlight === 'positive' && 'border-green-500/40',
      highlight === 'negative' && 'border-destructive/40',
      highlight === 'warning'  && 'border-amber-500/40',
      className,
    )}>
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
