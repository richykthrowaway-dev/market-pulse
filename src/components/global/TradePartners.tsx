import { ArrowUpRight, ArrowDownRight, Globe } from 'lucide-react';
import { useTradeBreakdown, type TradeProduct, type TradeDirection } from '@/hooks/useTradeBreakdown';
import { Flag } from '@/components/ui/Flag';
import { cn } from '@/lib/utils';

interface TradePartnersProps {
  iso2: string;
}

// ── Number formatting ────────────────────────────────────────────────

function formatUsdCompact(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9)  return `$${(value / 1e9).toFixed(0)}B`;
  if (value >= 1e6)  return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

// ── Sub-components ────────────────────────────────────────────────────

interface PartnerRowProps {
  partner: TradeProduct;
  /** Largest share in this list — used to scale all bars proportionally */
  maxShare: number;
}

function PartnerRow({ partner, maxShare }: PartnerRowProps) {
  // Scale bar to the LEADING partner's share so bars always span the
  // available width. If we used absolute % the bars would all look
  // tiny (top partner is rarely above 25%).
  const barWidth = maxShare > 0 ? (partner.share / maxShare) * 100 : 0;

  return (
    <div className="flex items-center gap-2 py-1 group" title={partner.name}>
      <Flag code={partner.code} size={20} className="shrink-0" />
      <span className="text-xs text-foreground/90 truncate w-24 shrink-0">
        {partner.name}
      </span>
      <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all"
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground shrink-0 w-12 text-right">
        {(partner.share * 100).toFixed(1)}%
      </span>
    </div>
  );
}

interface PartnersPanelProps {
  title: string;
  icon: React.ReactNode;
  iso2: string;
  direction: TradeDirection;
}

function PartnersPanel({ title, icon, iso2, direction }: PartnersPanelProps) {
  const { data, isLoading } = useTradeBreakdown(iso2, direction, 'partners');

  if (isLoading) {
    return (
      <div className="space-y-2">
        <PanelHeader title={title} icon={icon} />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 py-1 animate-pulse">
              <div className="h-4 w-5 rounded bg-muted/40 shrink-0" />
              <div className="h-3 w-20 bg-muted/40 rounded" />
              <div className="flex-1 h-1.5 bg-muted/30 rounded-full" />
              <div className="h-3 w-10 bg-muted/40 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.products.length === 0) {
    return (
      <div className="space-y-2">
        <PanelHeader title={title} icon={icon} />
        <p className="text-xs text-muted-foreground italic px-1">
          Partner data not reported for this country.
        </p>
      </div>
    );
  }

  const top = data.products.slice(0, 8);
  const maxShare = top[0]?.share ?? 1;

  return (
    <div className="space-y-2">
      <PanelHeader
        title={title}
        icon={icon}
        year={data.year}
        total={data.totalUsd ?? undefined}
      />
      <div className="space-y-0">
        {top.map((p) => (
          <PartnerRow key={p.code} partner={p} maxShare={maxShare} />
        ))}
      </div>
    </div>
  );
}

interface PanelHeaderProps {
  title: string;
  icon: React.ReactNode;
  year?: number | null;
  total?: number;
}

function PanelHeader({ title, icon, year, total }: PanelHeaderProps) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-1">
      <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
        <span className="w-3.5 h-3.5 shrink-0">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide truncate">
          {title}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0 tabular-nums">
        {total != null && total > 0 && <span>{formatUsdCompact(total)}</span>}
        {year != null && (
          <span className="px-1 rounded bg-muted/50 border border-border">{year}</span>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

/**
 * Side-by-side visualization of a country's top trading partners.
 *
 * Left panel: where this country's exports go (top 8 destinations).
 * Right panel: where this country's imports come from (top 8 sources).
 *
 * Each row shows the partner's flag, name, a relative-width bar, and
 * the partner's share of total trade in that direction. Bars are scaled
 * to the LEADING partner's share rather than absolute 0-100% so they
 * fill the available width — top partners are rarely above ~25%, which
 * would leave a 0-100% scale looking sparse.
 *
 * Sourced from UN Comtrade preview (proxied via the api-wits edge
 * function). Data is annual and lags 1-2 years; the `?level=partners`
 * mode applies the necessary motCode/customsCode/partner2Code dedup
 * filters server-side so the client receives clean, share-summed rows.
 */
export function TradePartners({ iso2 }: TradePartnersProps) {
  return (
    <div className="space-y-1 px-1">
      <div className="flex items-center gap-1.5 text-muted-foreground pb-1">
        <Globe className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Top Trading Partners · UN Comtrade
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-border bg-card p-3">
        <PartnersPanel
          title="Top Export Destinations"
          icon={<ArrowUpRight className={cn('w-3.5 h-3.5 text-emerald-500')} />}
          iso2={iso2}
          direction="exports"
        />
        <PartnersPanel
          title="Top Import Sources"
          icon={<ArrowDownRight className={cn('w-3.5 h-3.5 text-amber-500')} />}
          iso2={iso2}
          direction="imports"
        />
      </div>
    </div>
  );
}
