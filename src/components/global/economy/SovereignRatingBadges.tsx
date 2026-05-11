import { Shield } from 'lucide-react';
import {
  getSovereignRating, isInvestmentGrade, RATING_RANK,
  type RatingEntry, type RatingOutlook,
} from '@/data/sovereignRatings';
import { cn } from '@/lib/utils';

/**
 * SovereignRatingBadges — three side-by-side credit-rating badges
 * (Moody's / S&P / Fitch) for the selected country.
 *
 * Color is driven by rating tier:
 *   AAA / Aaa            → emerald
 *   AA / Aa              → green
 *   A                    → cyan
 *   BBB / Baa            → blue (investment grade boundary)
 *   BB / Ba              → amber
 *   B                    → orange
 *   CCC / Caa and below  → red
 *
 * Outlook arrow:
 *   positive → ↑ green
 *   stable   → — gray
 *   negative → ↓ red
 *
 * If a country has no static entry, the whole card collapses to a single
 * "Not rated" message instead of three empty placeholders.
 */

interface Props {
  iso2: string;
}

function ratingColor(rating: string): string {
  const r = RATING_RANK[rating] ?? 0;
  if (r >= 22) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (r >= 19) return 'bg-green-500/15   text-green-400   border-green-500/30';
  if (r >= 16) return 'bg-cyan-500/15    text-cyan-400    border-cyan-500/30';
  if (r >= 13) return 'bg-blue-500/15    text-blue-400    border-blue-500/30';
  if (r >= 10) return 'bg-amber-500/15   text-amber-400   border-amber-500/30';
  if (r >= 7)  return 'bg-orange-500/15  text-orange-400  border-orange-500/30';
  if (r >= 1)  return 'bg-red-500/15     text-red-400     border-red-500/30';
  return 'bg-muted/30 text-muted-foreground border-border';
}

function OutlookArrow({ outlook }: { outlook?: RatingOutlook }) {
  if (!outlook) return null;
  if (outlook === 'positive') return <span title="Positive outlook" className="text-emerald-400">↑</span>;
  if (outlook === 'negative') return <span title="Negative outlook" className="text-red-400">↓</span>;
  return <span title="Stable outlook" className="text-muted-foreground/60">—</span>;
}

function Badge({ agency, entry }: { agency: string; entry: RatingEntry }) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center gap-0.5 rounded-md border px-2 py-2 transition-colors',
      ratingColor(entry.rating),
    )}>
      <span className="text-[9px] uppercase tracking-wide opacity-70">{agency}</span>
      <div className="flex items-center gap-1">
        <span className="text-sm font-bold tabular-nums">{entry.rating}</span>
        <OutlookArrow outlook={entry.outlook} />
      </div>
    </div>
  );
}

export function SovereignRatingBadges({ iso2 }: Props) {
  const rating = getSovereignRating(iso2);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90 mb-2">
        <Shield className="w-3.5 h-3.5 text-primary" />
        Sovereign Credit Rating
      </h3>

      {!rating ? (
        <p className="text-[11px] italic text-muted-foreground/70 py-2">
          No public rating on file for this sovereign.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            <Badge agency="Moody's" entry={rating.moody} />
            <Badge agency="S&P"     entry={rating.sp}    />
            <Badge agency="Fitch"   entry={rating.fitch} />
          </div>
          <div className="flex items-center justify-between mt-2 text-[9px] text-muted-foreground/60">
            <span>
              {isInvestmentGrade(rating.moody.rating) ||
               isInvestmentGrade(rating.sp.rating)    ||
               isInvestmentGrade(rating.fitch.rating)
                ? 'Investment grade'
                : 'Speculative grade'}
            </span>
            <span>Updated {rating.updated}</span>
          </div>
        </>
      )}
    </div>
  );
}
