import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { CorrelationEntry } from '@/lib/performanceTypes';

interface CorrelationMatrixProps {
  entries: CorrelationEntry[];
  symbols: string[];
}

function corrToColor(corr: number): string {
  if (corr >= 0.8) return 'bg-red-500/80 text-white';
  if (corr >= 0.6) return 'bg-red-400/60 text-foreground';
  if (corr >= 0.4) return 'bg-red-300/50 text-foreground';
  if (corr >= 0.2) return 'bg-red-200/40 text-foreground';
  if (corr >= -0.2) return 'bg-muted text-foreground';
  if (corr >= -0.4) return 'bg-blue-200/40 text-foreground';
  if (corr >= -0.6) return 'bg-blue-300/50 text-foreground';
  if (corr >= -0.8) return 'bg-blue-400/60 text-foreground';
  return 'bg-blue-500/80 text-white';
}

export function CorrelationMatrix({ entries, symbols }: CorrelationMatrixProps) {
  if (symbols.length < 2 || entries.length === 0) return null;

  const corrMap: Record<string, number> = {};
  for (const e of entries) {
    corrMap[`${e.assetA}|${e.assetB}`] = e.correlation;
    corrMap[`${e.assetB}|${e.assetA}`] = e.correlation;
  }

  const getCorr = (a: string, b: string): number | null => {
    if (a === b) return 1;
    return corrMap[`${a}|${b}`] ?? null;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Correlation Matrix</CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="w-16" />
                  {symbols.map(sym => (
                    <th key={sym} className="px-1 py-1 text-center font-medium text-muted-foreground w-16">
                      {sym}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {symbols.map(rowSym => (
                  <tr key={rowSym}>
                    <td className="pr-2 py-1 text-right font-medium text-muted-foreground whitespace-nowrap">
                      {rowSym}
                    </td>
                    {symbols.map(colSym => {
                      const corr = getCorr(rowSym, colSym);
                      return (
                        <td key={colSym} className="p-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  'w-14 h-10 flex items-center justify-center rounded font-mono font-medium cursor-default transition-opacity hover:opacity-80',
                                  corrToColor(corr ?? 0),
                                )}
                              >
                                {corr !== null ? corr.toFixed(2) : '—'}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                Correlation between <strong>{rowSym}</strong> and <strong>{colSym}</strong>:{' '}
                                {corr !== null ? corr.toFixed(2) : 'N/A'}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
