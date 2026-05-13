// src/components/calculators/CalculatorShell.tsx
import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CalculatorShellProps {
  title: string;
  description: string;
  inputs: ReactNode;
  results: ReactNode;
}

export function CalculatorShell({ title, description, inputs, results }: CalculatorShellProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Inputs */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">{inputs}</CardContent>
        </Card>
        {/* Results */}
        <div className="lg:col-span-2 space-y-4">{results}</div>
      </div>
    </div>
  );
}

/** Amber insight callout — matches existing fee calculator style */
export function Callout({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
      {icon && <span className="shrink-0 mt-0.5">{icon}</span>}
      <p className="text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
