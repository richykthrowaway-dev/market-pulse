import { useMemo, memo } from "react";
import { EXCHANGES, CONTINENT_COLORS, type ExchangeInfo, isExchangeOpen, getLocalTimezoneAbbr, getExchangeDisplayData } from "@/data/exchangeData";
import { COUNTRY_META } from "@/data/countryMeta";
import { MapPin, Clock } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Flag } from "@/components/ui/Flag";

const CONTINENT_ORDER = ["Americas", "Europe", "Asia-Pacific", "Middle East & Africa"] as const;

interface CountryExchangesProps {
  iso2: string;
  onExchangeClick?: (exchange: ExchangeInfo) => void;
}

export default function CountryExchanges({ iso2, onExchangeClick }: CountryExchangesProps) {
  const countryName = COUNTRY_META[iso2]?.name ?? iso2;
  const countryExchanges = useMemo(() => EXCHANGES.filter((e) => e.country === iso2), [iso2]);

  // Group remaining exchanges by continent (excluding selected country's)
  const grouped = useMemo(() => {
    const map = new Map<string, ExchangeInfo[]>();
    for (const c of CONTINENT_ORDER) map.set(c, []);
    for (const ex of EXCHANGES) {
      if (ex.country === iso2) continue;
      map.get(ex.continent)?.push(ex);
    }
    return map;
  }, [iso2]);

  return (
    <div className="space-y-4 pt-3">
      {/* Selected country's exchanges */}
      {countryExchanges.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
            {countryName}
          </p>
          <div className="space-y-1.5">
            {countryExchanges.map((ex) => (
              <ExchangeRow key={ex.code} exchange={ex} highlight onClick={onExchangeClick} />
            ))}
          </div>
        </div>
      )}
      {countryExchanges.length === 0 && (
        <div className="py-3 px-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
          No major exchanges in {countryName}
        </div>
      )}

      {/* All exchanges by continent */}
      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          All Global Exchanges
        </p>
        {CONTINENT_ORDER.map((continent) => {
          const list = grouped.get(continent);
          if (!list || list.length === 0) return null;
          const color = CONTINENT_COLORS[continent];
          return (
            <div key={continent} className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <p className="text-[11px] font-medium text-muted-foreground">{continent}</p>
              </div>
              <div className="space-y-1">
                {list.map((ex) => (
                  <ExchangeRow key={ex.code} exchange={ex} onClick={onExchangeClick} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ExchangeRow = memo(function ExchangeRow({
  exchange,
  highlight,
  onClick,
}: {
  exchange: ExchangeInfo;
  highlight?: boolean;
  onClick?: (exchange: ExchangeInfo) => void;
}) {
  const open = isExchangeOpen(exchange);
  const localTzAbbr = getLocalTimezoneAbbr();

  // Pre-computed at module load — no Intl calls per render
  const { localOpen, localClose, exchTzAbbr } = getExchangeDisplayData(exchange.code);

  return (
    <button
      type="button"
      onClick={() => onClick?.(exchange)}
      className={`w-full flex items-start gap-3 p-2.5 rounded-lg transition-colors text-left cursor-pointer ${
        highlight
          ? "bg-primary/10 ring-1 ring-primary/20 hover:bg-primary/15"
          : "bg-muted/30 hover:bg-muted/50"
      }`}
    >
      {/* Country flag */}
      <Flag code={exchange.country} size={20} className="mt-0.5" />

      <div className="flex-1 min-w-0">
        {/* Row 1: Name + code + open/closed status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm truncate ${highlight ? "font-semibold" : "font-medium"}`}>
            {exchange.name}
          </span>
          <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {exchange.code}
          </span>
          <span
            className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${
              open
                ? "bg-emerald-500/15 text-emerald-500"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${open ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`}
            />
            {open ? "Open" : "Closed"}
          </span>
        </div>

        {/* Row 2: City · Hours (local time, tooltip for exchange time) · Currency */}
        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            {exchange.city}
          </span>
          <span className="opacity-30">·</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 cursor-help border-b border-dotted border-muted-foreground/40">
                <Clock className="h-3 w-3 shrink-0" />
                {localOpen}–{localClose} {localTzAbbr}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p className="font-medium">Exchange local time</p>
              <p>{exchange.openTime}–{exchange.closeTime} {exchTzAbbr} ({exchange.city})</p>
            </TooltipContent>
          </Tooltip>
          <span className="opacity-30">·</span>
          <span className="font-medium">{exchange.currency}</span>
        </div>
      </div>
    </button>
  );
});
