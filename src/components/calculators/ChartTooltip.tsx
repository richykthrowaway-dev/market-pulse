// src/components/calculators/ChartTooltip.tsx
import { fmtDollar } from './calcUtils';

interface TooltipPayload {
  dataKey: string;
  name: string;
  color: string;
  value: number | string | (number | string)[];
}

interface Props {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
  labelPrefix?: string;
  formatter?: (v: number) => string;
}

export function ChartTooltip({ active, payload, label, labelPrefix = 'Year', formatter = fmtDollar }: Props) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-lg text-sm">
      <p className="font-medium mb-1.5">{labelPrefix} {label}</p>
      {payload.map((p, i) => (
        <p key={`${p.dataKey}-${i}`} style={{ color: p.color }} className="tabular-nums text-xs">
          {p.name}: {typeof p.value === 'number' ? formatter(p.value) : String(p.value)}
        </p>
      ))}
    </div>
  );
}
