import { useEffect, useState } from "react";
import {
  type ExchangeInfo,
  CONTINENT_COLORS,
  isExchangeOpen,
  getTimezoneAbbr,
} from "@/data/exchangeData";
import { COUNTRY_META } from "@/data/countryMeta";
import { X, ExternalLink } from "lucide-react";

interface ExchangeDetailDialogProps {
  exchange: ExchangeInfo | null;
  onClose: () => void;
}

const DAY_ABBR = ["S", "M", "T", "W", "T", "F", "S"];

export default function ExchangeDetailDialog({ exchange, onClose }: ExchangeDetailDialogProps) {
  // Re-check open status every 30s
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!exchange) return;
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, [exchange]);

  if (!exchange) return null;

  const open = isExchangeOpen(exchange);
  const color = CONTINENT_COLORS[exchange.continent] ?? "#888";
  const countryName = COUNTRY_META[exchange.country]?.name ?? exchange.country;
  const tzAbbr = getTimezoneAbbr(exchange.timezone);

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-[280px] rounded-lg border border-border bg-card/95 backdrop-blur-md shadow-2xl shadow-black/50 animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      {/* Accent bar */}
      <div className="h-1 rounded-t-lg" style={{ backgroundColor: color }} />

      <div className="p-3 space-y-2">
        {/* Header row: name + code + close */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold truncate">{exchange.name}</h3>
              <span className="shrink-0 text-[9px] font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground font-semibold leading-none">
                {exchange.code}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {exchange.city}, {countryName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-0.5 rounded-sm hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full leading-none"
            style={{ backgroundColor: `${color}20`, color }}
          >
            <span className="h-1 w-1 rounded-full" style={{ backgroundColor: color }} />
            {exchange.continent}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${
              open
                ? "bg-emerald-500/15 text-emerald-500"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <span
              className={`h-1 w-1 rounded-full ${open ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`}
            />
            {open ? "Open" : "Closed"}
          </span>
        </div>

        {/* Compact info grid */}
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          {/* Hours */}
          <div className="p-1.5 rounded bg-muted/40">
            <p className="font-semibold text-[11px]">
              {exchange.openTime}–{exchange.closeTime}
            </p>
            <p className="text-muted-foreground">{tzAbbr}</p>
          </div>

          {/* Days */}
          <div className="p-1.5 rounded bg-muted/40">
            <div className="flex gap-px">
              {DAY_ABBR.map((label, i) => (
                <span
                  key={i}
                  className={`w-[18px] text-center py-px rounded-sm text-[8px] font-medium ${
                    exchange.tradingDays.includes(i)
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground/30"
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
            <p className="text-muted-foreground mt-0.5">Trading Days</p>
          </div>

          {/* Currency */}
          <div className="p-1.5 rounded bg-muted/40">
            <p className="font-semibold text-[11px]">{exchange.currency}</p>
            <p className="text-muted-foreground">Currency</p>
          </div>

          {/* Timezone */}
          <div className="p-1.5 rounded bg-muted/40">
            <p className="font-semibold text-[11px]">{tzAbbr}</p>
            <p className="text-muted-foreground truncate">{exchange.timezone}</p>
          </div>
        </div>

        {/* Website link */}
        <a
          href={exchange.website}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full py-1 rounded text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <ExternalLink className="h-2.5 w-2.5" />
          Visit Website
        </a>
      </div>
    </div>
  );
}
