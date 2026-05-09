import { useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight, Package } from 'lucide-react';
import { useTradeBreakdown, type TradeProduct, type TradeDirection } from '@/hooks/useTradeBreakdown';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  WITS_SECTION_DISPLAY,
  WITS_SECTION_CHAPTERS,
} from '@/lib/hsChapters';
import { headingName } from '@/lib/hsHeadings';
import { cn } from '@/lib/utils';

interface TradeBreakdownProps {
  iso2: string;
}

// ── Stable per-product color ──────────────────────────────────────────
// Hash so the same code always gets the same color across countries.
const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
  '#f97316', '#a855f7', '#14b8a6', '#dc2626',
  '#0ea5e9', '#22c55e', '#eab308', '#d946ef',
];

function colorFor(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) {
    h = ((h << 5) - h + code.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// ── Number formatting ────────────────────────────────────────────────

function formatUsdCompact(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9)  return `$${(value / 1e9).toFixed(0)}B`;
  if (value >= 1e6)  return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

/**
 * Friendlier section display name. Falls back to a paraphrase of the
 * raw WITS code (`27-27_Fuels` → `Fuels`) when the section isn't in
 * our explicit display map.
 */
function displaySectionName(code: string): string {
  return WITS_SECTION_DISPLAY[code] ?? code.replace(/^[\d-]+_/, '').replace(/([A-Z])/g, ' $1').trim();
}

// ── Sub-components ────────────────────────────────────────────────────

interface SectionDrillDownProps {
  section: TradeProduct;
  chapters: TradeProduct[];   // already filtered to this section's chapters
  direction: TradeDirection;
}

/**
 * The HoverCard content shown when the user hovers over a section
 * segment or its legend row. Lists the top HS 2-digit chapters within
 * that section, with their share OF THE SECTION (renormalised so the
 * top chapters sum to ~100% within the popover, not against world total).
 */
function SectionDrillDown({ section, chapters, direction }: SectionDrillDownProps) {
  const fullName = displaySectionName(section.code);

  if (chapters.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2 pb-1 border-b border-border">
          <span className="font-semibold text-sm">{fullName}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {(section.share * 100).toFixed(1)}% of {direction}
          </span>
        </div>
        <p className="text-xs text-muted-foreground italic">
          Subcategory data not available for this section.
        </p>
      </div>
    );
  }

  // Top 6 chapters within the section
  const top = chapters.slice(0, 6);
  const sectionTotal = chapters.reduce((s, c) => s + c.valueUsd, 0);

  // No min/max width on this wrapper — the parent HoverCardContent now
  // sets an explicit `w-80` (320px), so we just fill it. Previous version
  // had `min-w-[260px]` which exceeded the default `w-64` card width and
  // pushed the percentage column past the right edge.
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 pb-1 border-b border-border">
        <span className="font-semibold text-sm">{fullName}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {(section.share * 100).toFixed(1)}% of {direction}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground -mt-1">
        ${(sectionTotal / 1e9).toFixed(1)}B total · top {top.length} of {chapters.length} products
      </p>
      <div className="space-y-1">
        {top.map((c) => {
          const shareWithinSection = sectionTotal > 0 ? c.valueUsd / sectionTotal : 0;
          const padded = c.code.padStart(4, '0');
          const fullName = headingName(c.code);
          return (
            <div key={c.code} className="flex items-center gap-2 text-xs">
              <span className="font-mono text-[10px] text-muted-foreground w-9 shrink-0">
                {padded}
              </span>
              <span
                className="flex-1 min-w-0 truncate text-foreground/90"
                title={fullName}
              >
                {fullName}
              </span>
              <span className="tabular-nums text-muted-foreground shrink-0 w-12 text-right">
                {(shareWithinSection * 100).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface BreakdownPanelProps {
  title: string;
  icon: React.ReactNode;
  iso2: string;
  direction: TradeDirection;
}

function BreakdownPanel({ title, icon, iso2, direction }: BreakdownPanelProps) {
  // Section-level data drives the headline bar.
  const { data: sectionData, isLoading: sectionLoading } =
    useTradeBreakdown(iso2, direction, 'section');
  // Chapter-level data populates the hover drill-downs. Loaded in parallel
  // so it's already cached by the time the user hovers — no UI lag.
  const { data: chapterData } =
    useTradeBreakdown(iso2, direction, 'chapter');

  // Group HS 4-digit headings by WITS section. Match by chapter prefix:
  // an HS heading like "8542" belongs to chapter "85", which is in the
  // 84-85_MachElec section. WITS_SECTION_CHAPTERS maps section→chapters,
  // so we filter headings by extracting their first 2 digits.
  const chaptersBySection = useMemo(() => {
    const map = new Map<string, TradeProduct[]>();
    if (!chapterData?.products) return map;
    for (const [sectionCode, chapterCodes] of Object.entries(WITS_SECTION_CHAPTERS)) {
      const chapterSet = new Set(chapterCodes);
      const list = chapterData.products.filter((p) => {
        const padded = p.code.padStart(4, '0');
        const chapter = padded.slice(0, 2);
        return p.valueUsd > 0 && chapterSet.has(chapter);
      });
      list.sort((a, b) => b.valueUsd - a.valueUsd);
      map.set(sectionCode, list);
    }
    return map;
  }, [chapterData]);

  // Group long tail (rank 6+) into a single "Other" bucket so the visible
  // bar segments stay readable. The labeled list shows top 5 + "Other".
  const { topProducts, otherShare, otherValue } = useMemo(() => {
    const products = sectionData?.products ?? [];
    const TOP_N = 5;
    const top = products.slice(0, TOP_N);
    const rest = products.slice(TOP_N);
    const otherShare = rest.reduce((s, r) => s + r.share, 0);
    const otherValue = rest.reduce((s, r) => s + r.valueUsd, 0);
    return { topProducts: top, otherShare, otherValue };
  }, [sectionData]);

  if (sectionLoading) {
    return (
      <div className="space-y-2">
        <PanelHeader title={title} icon={icon} />
        <div className="h-4 bg-muted/40 rounded animate-pulse" />
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3 bg-muted/30 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!sectionData || sectionData.products.length === 0) {
    return (
      <div className="space-y-2">
        <PanelHeader title={title} icon={icon} />
        <p className="text-xs text-muted-foreground italic px-1">
          Not reported to WITS for this country.
        </p>
      </div>
    );
  }

  const total = sectionData.totalUsd ?? 0;
  const year = sectionData.year;

  return (
    <div className="space-y-2">
      <PanelHeader title={title} icon={icon} year={year} total={total} />

      {/* Stacked bar — each segment is a HoverCard trigger that shows
          the chapter breakdown for that section. */}
      <div
        className="flex h-4 w-full overflow-hidden rounded-md bg-muted/30"
        role="img"
        aria-label={`${title} composition for ${iso2}`}
      >
        {topProducts.map((p) => (
          <HoverCard key={p.code} openDelay={150} closeDelay={50}>
            <HoverCardTrigger asChild>
              <div
                style={{
                  width: `${p.share * 100}%`,
                  backgroundColor: colorFor(p.code),
                }}
                className="cursor-help transition-opacity hover:opacity-80"
                aria-label={`${displaySectionName(p.code)}: ${(p.share * 100).toFixed(1)}%`}
              />
            </HoverCardTrigger>
            <HoverCardContent side="top" align="center" className="w-80 p-3">
              <SectionDrillDown
                section={p}
                chapters={chaptersBySection.get(p.code) ?? []}
                direction={direction}
              />
            </HoverCardContent>
          </HoverCard>
        ))}
        {otherShare > 0.001 && (
          <div
            style={{ width: `${otherShare * 100}%` }}
            className="bg-muted-foreground/40"
            title={`Other: ${(otherShare * 100).toFixed(1)}% (${formatUsdCompact(otherValue)})`}
          />
        )}
      </div>

      {/* Two-column legend — also HoverCard-enabled so users can hover
          the legend row instead of trying to hit a thin bar segment. */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {topProducts.map((p) => (
          <HoverCard key={p.code} openDelay={150} closeDelay={50}>
            <HoverCardTrigger asChild>
              <div className="flex items-center gap-1.5 min-w-0 cursor-help rounded px-1 -mx-1 hover:bg-muted/40 transition-colors">
                <span
                  className="inline-block w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: colorFor(p.code) }}
                />
                <span className="truncate text-foreground/90">
                  {displaySectionName(p.code)}
                </span>
                <span className="ml-auto tabular-nums text-muted-foreground shrink-0">
                  {(p.share * 100).toFixed(1)}%
                </span>
              </div>
            </HoverCardTrigger>
            <HoverCardContent side="top" align="start" className="w-80 p-3">
              <SectionDrillDown
                section={p}
                chapters={chaptersBySection.get(p.code) ?? []}
                direction={direction}
              />
            </HoverCardContent>
          </HoverCard>
        ))}
        {otherShare > 0.001 && (
          <div className="flex items-center gap-1.5 min-w-0 px-1 -mx-1">
            <span
              className="inline-block w-2 h-2 rounded-sm shrink-0 bg-muted-foreground/40"
            />
            <span className="truncate text-muted-foreground">Other</span>
            <span className="ml-auto tabular-nums text-muted-foreground shrink-0">
              {(otherShare * 100).toFixed(1)}%
            </span>
          </div>
        )}
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
 * Side-by-side product-composition visualization for a country's
 * exports and imports.
 *
 * Each side shows a stacked horizontal bar with the top 5 HS Section
 * categories (sourced from World Bank WITS) plus an "Other" bucket
 * for the long tail. Hovering over a section reveals a popover with
 * the top HS 2-digit chapters within that section (sourced from UN
 * Comtrade preview), so the user can see e.g. that "Machinery &
 * Electronics" breaks down into "Industrial machinery (HS 84): 53%,
 * Electrical equipment (HS 85): 47%" of that section's value.
 */
export function TradeBreakdown({ iso2 }: TradeBreakdownProps) {
  return (
    <div className="space-y-1 px-1">
      <div className="flex items-center gap-1.5 text-muted-foreground pb-1">
        <Package className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Trade Composition · World Bank WITS &amp; UN Comtrade
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-border bg-card p-3">
        <BreakdownPanel
          title="Top Exports"
          icon={<ArrowUpRight className={cn('w-3.5 h-3.5 text-emerald-500')} />}
          iso2={iso2}
          direction="exports"
        />
        <BreakdownPanel
          title="Top Imports"
          icon={<ArrowDownRight className={cn('w-3.5 h-3.5 text-amber-500')} />}
          iso2={iso2}
          direction="imports"
        />
      </div>
    </div>
  );
}
