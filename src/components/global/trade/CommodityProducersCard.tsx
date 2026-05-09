import { useMemo, useState } from 'react';
import { Factory } from 'lucide-react';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  COMMODITIES, CATEGORY_LABELS, CATEGORY_ORDER,
  getCommodity, type CommodityCategory,
} from '@/data/tradeInfrastructure/commodities';
import { COUNTRY_META } from '@/data/countryMeta';
import { getFlagUrl } from '@/lib/flags';

/**
 * CommodityProducersCard — quick "who makes this?" lookup.
 *
 * Renders a category-grouped Select of 12 commodities and, beneath it,
 * the top-8 producing countries for the selection ranked by global
 * production share.  Each row shows: flag · country name · share % ·
 * a horizontal bar scaled to the largest share in the commodity.
 *
 * All data is static (see ../../data/tradeInfrastructure/commodities.ts)
 * so the card costs nothing at runtime — no fetch, no hook subscriptions,
 * no map-state coupling.  Country names + flags resolve through the
 * existing COUNTRY_META + getFlagUrl helpers so the visual style stays
 * consistent with the rest of the app's country presentation.
 */

const DEFAULT_COMMODITY_ID = 'crude-oil';

/** Pre-group commodities by category once for the dropdown render. */
const GROUPED: Record<CommodityCategory, typeof COMMODITIES> = (() => {
  const out = { energy: [] as any, metals: [] as any, agriculture: [] as any } as Record<
    CommodityCategory,
    typeof COMMODITIES
  >;
  for (const c of COMMODITIES) (out[c.category] as any).push(c);
  return out;
})();

export function CommodityProducersCard() {
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_COMMODITY_ID);

  const commodity = useMemo(() => getCommodity(selectedId), [selectedId]);

  // Largest share is the bar's reference width — keeps top bar full instead
  // of pegged at ~12 % when the leader's share is small.
  const maxShare = useMemo(
    () => commodity ? Math.max(...commodity.producers.map((p) => p.share)) : 1,
    [commodity],
  );

  if (!commodity) return null;

  return (
    <div className="border-t border-border bg-purple-500/5">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <Factory className="w-4 h-4 text-purple-500 shrink-0" />
        <span className="text-xs font-medium">Top Producers</span>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
          By country
        </span>
      </div>

      {/* ── Commodity dropdown ───────────────────────────────────────── */}
      <div className="px-4 pb-2">
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_ORDER.map((cat) => (
              <SelectGroup key={cat}>
                <SelectLabel className="text-[10px] uppercase tracking-wide">
                  {CATEGORY_LABELS[cat]}
                </SelectLabel>
                {GROUPED[cat].map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Producer ranked list ─────────────────────────────────────── */}
      <ul className="px-4 pb-2 space-y-1">
        {commodity.producers.map((p) => {
          const meta     = COUNTRY_META[p.iso2];
          const name     = meta?.name ?? p.iso2;
          const flagUrl  = getFlagUrl(p.iso2, 24);
          const barWidth = `${(p.share / maxShare) * 100}%`;

          return (
            <li key={p.iso2} className="flex items-center gap-2 text-xs">
              {/* Flag */}
              {flagUrl ? (
                <img
                  src={flagUrl}
                  alt=""
                  width={18}
                  height={12}
                  loading="lazy"
                  className="shrink-0 rounded-[2px] ring-1 ring-border/50"
                />
              ) : (
                <span className="w-[18px] h-[12px] inline-block bg-muted rounded-[2px] shrink-0" />
              )}

              {/* Name */}
              <span className="truncate min-w-0 flex-1" title={name}>
                {name}
              </span>

              {/* Share % */}
              <span className="text-muted-foreground tabular-nums shrink-0 w-10 text-right">
                {p.share.toFixed(1)}%
              </span>

              {/* Bar */}
              <span className="w-16 h-1.5 bg-purple-500/10 rounded-full overflow-hidden shrink-0">
                <span
                  className="block h-full bg-purple-500/70 rounded-full"
                  style={{ width: barWidth }}
                />
              </span>
            </li>
          );
        })}
      </ul>

      {/* ── Footer attribution ───────────────────────────────────────── */}
      <p className="px-4 pb-3 text-[10px] text-muted-foreground/70">
        {commodity.source} · {commodity.year} · share of global production ({commodity.unit})
      </p>
    </div>
  );
}
