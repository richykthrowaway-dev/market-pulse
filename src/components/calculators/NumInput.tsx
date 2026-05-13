// src/components/calculators/NumInput.tsx
import React, { useEffect, useState, useId } from 'react';
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
  label, value, onChange, min, max, step = 1, prefix, suffix, help,
}: NumInputProps) {
  const id = useId();
  const [raw, setRaw] = useState(String(value));

  // Sync when parent drives a value change externally
  useEffect(() => { setRaw(String(value)); }, [value]);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-muted-foreground text-sm pointer-events-none select-none z-10">
            {prefix}
          </span>
        )}
        <Input
          id={id}
          type="number"
          value={raw}
          min={min}
          max={max}
          step={step}
          onChange={e => {
            setRaw(e.target.value);
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) {
              const lo = min ?? -Infinity;
              const hi = max ?? Infinity;
              onChange(clamp(v, lo, hi));
            }
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
