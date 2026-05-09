import { useMemo } from 'react';
import { Briefcase } from 'lucide-react';
import type { EodFundamentals } from '@/services/eodhdApi';

/**
 * Officers / Executives Card — surfaces the company's named executives
 * from `data.General.Officers`. 0 extra EODHD credits.
 *
 * Why expose this:
 *   • The CEO / CFO names are the search query you'd want to fire next
 *     to dig into management track record, prior companies, etc.
 *   • Year-born gives a rough age signal (succession risk for a
 *     founder-led company with a 70-something CEO).
 *   • A leadership table in one place is something Yahoo Finance has
 *     and most boutique fundamentals tools omit.
 */

interface Props { data: EodFundamentals }

function approxAge(yearBorn: string | number | undefined): number | null {
  if (yearBorn == null) return null;
  const yb = typeof yearBorn === 'string' ? parseInt(yearBorn, 10) : yearBorn;
  if (!isFinite(yb) || yb < 1900 || yb > new Date().getFullYear()) return null;
  return new Date().getFullYear() - yb;
}

/**
 * Score officer importance — CEO/Founder/Chairman/CFO/COO/President
 * float to the top, board-only directors and unspecified roles drop to
 * the bottom. Returns lower = more important.
 */
function rolePriority(title: string | undefined): number {
  const t = (title ?? '').toLowerCase();
  if (t.includes('founder')        || t.includes('co-founder'))   return 0;
  if (t.includes('chief executive') || /\bceo\b/.test(t))         return 1;
  if (t.includes('chairman')        || t.includes('chairperson')) return 2;
  if (t.includes('president'))                                    return 3;
  if (t.includes('chief operating') || /\bcoo\b/.test(t))         return 4;
  if (t.includes('chief financial') || /\bcfo\b/.test(t))         return 5;
  if (t.includes('chief technology') || /\bcto\b/.test(t))        return 6;
  if (t.includes('chief'))                                        return 7;
  if (t.includes('president'))                                    return 8;
  if (t.includes('vice president')  || /\bvp\b/.test(t))          return 9;
  if (t.includes('director'))                                     return 10;
  return 11;
}

export function OfficersCard({ data }: Props) {
  const officers = useMemo(() => {
    if (!data.General.Officers) return [];
    return Object.values(data.General.Officers)
      .filter((o) => o?.Name)
      .sort((a, b) => rolePriority(a.Title) - rolePriority(b.Title))
      .slice(0, 8);
  }, [data]);

  if (officers.length === 0) return null;

  return (
    <div className="space-y-2 pt-3 border-t border-border">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Briefcase className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Leadership · top {officers.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {officers.map((o, i) => {
          const age = approxAge(o.YearBorn);
          return (
            <div
              key={`${o.Name}-${i}`}
              className="flex items-baseline justify-between gap-2 py-0.5 border-b border-border/30 last:border-0"
            >
              <div className="min-w-0">
                <p className="font-medium truncate" title={o.Name}>{o.Name}</p>
                <p className="text-[10px] text-muted-foreground truncate" title={o.Title}>{o.Title}</p>
              </div>
              {age != null && (
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  ~{age}y
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
