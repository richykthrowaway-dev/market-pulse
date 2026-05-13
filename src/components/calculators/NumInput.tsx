// src/components/calculators/NumInput.tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clamp } from './calcUtils';

interface NumInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  help?: string;
}

export function NumInput({
  label, value, onChange, min = 0, max, step = 1, prefix, suffix, help,
}: NumInputProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-muted-foreground text-sm pointer-events-none select-none z-10">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(clamp(v, min, max ?? Infinity));
          }}
          className={`w-full ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-12' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3 text-muted-foreground text-sm pointer-events-none select-none whitespace-nowrap">
            {suffix}
          </span>
        )}
      </div>
      {help && <p className="text-[11px] text-muted-foreground">{help}</p>}
    </div>
  );
}
