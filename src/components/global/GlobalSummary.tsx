import { useState } from "react";
import { useIndices } from "@/hooks/useSupabaseData";
import { Flag } from "@/components/ui/Flag";
import { cn } from "@/lib/utils";
import { ArrowUpIcon, ArrowDownIcon, Globe } from "lucide-react";
import { COUNTRY_META, REGION_TO_ISO } from "@/data/countryMeta";

interface GlobalSummaryProps {
  onCountryClick: (iso2: string) => void;
}

const REGION_ORDER = [
  "United States",
  "Canada",
  "United Kingdom",
  "Germany",
  "France",
  "Japan",
  "Hong Kong",
  "Australia",
  "India",
  "Brazil",
  "South Korea",
  "China",
  "Europe",
];

const REGION_GROUPS = [
  { label: "Americas", codes: ["US", "CA", "MX", "BR", "AR", "CO", "CL", "PE", "VE", "EC", "BO", "PY", "UY", "GY", "SR", "GT", "CR", "PA", "HN", "SV", "NI", "BZ", "CU", "DO", "HT", "JM", "BS", "PR", "TT", "FK"] },
  { label: "Europe", codes: ["GB", "DE", "FR", "IT", "ES", "NL", "CH", "SE", "NO", "DK", "FI", "PL", "AT", "IE", "PT", "GR", "CZ", "HU", "RO", "SK", "BG", "RS", "UA", "RU", "BE", "HR", "SI", "LT", "LV", "EE", "IS", "LU", "AL", "BA", "BY", "CY", "MD", "ME", "MK", "XK", "AM", "AZ", "GE", "GL"] },
  { label: "Asia-Pacific", codes: ["JP", "CN", "KR", "HK", "TW", "IN", "SG", "ID", "TH", "MY", "PH", "PK", "AU", "NZ", "VN", "BD", "LK", "KZ", "MM", "MN", "KP", "AF", "NP", "BT", "TM", "UZ", "KG", "TJ", "BN", "KH", "LA", "TL", "FJ", "PG", "NC", "SB", "VU"] },
  { label: "Middle East & Africa", codes: ["IL", "AE", "SA", "QA", "KW", "BH", "OM", "JO", "TR", "IR", "IQ", "LB", "PS", "SY", "YE", "ZA", "EG", "NG", "KE", "MA", "GH", "TZ", "ET", "UG", "SN", "CI", "CM", "DZ", "TN", "BW", "ZW", "AO", "MZ", "RW", "NA", "BJ", "BF", "BI", "CV", "CF", "TD", "KM", "CG", "CD", "DJ", "GQ", "ER", "SZ", "GA", "GM", "GN", "GW", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "NE", "ST", "SC", "SL", "SO", "SS", "SD", "TG", "ZM", "EH"] },
];

// How many fallback country rows to show before "Show more"
const FALLBACK_PAGE_SIZE = 40;

export default function GlobalSummary({ onCountryClick }: GlobalSummaryProps) {
  const { data: indices = [], isLoading } = useIndices();
  const [fallbackLimit, setFallbackLimit] = useState(FALLBACK_PAGE_SIZE);

  const sorted = [...indices].sort((a, b) => {
    const ai = REGION_ORDER.indexOf(a.region);
    const bi = REGION_ORDER.indexOf(b.region);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <Globe className="h-5 w-5 text-primary" />
        <h2 className="font-semibold text-lg">World Markets</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-sm text-muted-foreground mb-4">
          Click a country on the globe to explore its market.
        </p>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : sorted.length > 0 ? (
          <div className="grid grid-cols-1 gap-2">
            {sorted.map((idx) => {
              const iso = REGION_TO_ISO[idx.region];
              const isPositive = idx.changePercent >= 0;
              return (
                <button
                  key={idx.symbol}
                  onClick={() => iso && onCountryClick(iso)}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left w-full"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Flag code={idx.region} size={28} className="shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{idx.name}</p>
                      <p className="text-xs text-muted-foreground">{idx.region}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="font-mono text-sm font-medium">
                      {idx.value.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p
                      className={cn(
                        "font-mono text-xs flex items-center justify-end gap-0.5",
                        isPositive ? "text-success" : "text-danger"
                      )}
                    >
                      {isPositive ? (
                        <ArrowUpIcon className="h-3 w-3" />
                      ) : (
                        <ArrowDownIcon className="h-3 w-3" />
                      )}
                      {isPositive ? "+" : ""}
                      {idx.changePercent.toFixed(2)}%
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          (() => {
            // Flatten all fallback items so we can paginate across groups
            const allItems = REGION_GROUPS.flatMap((group) =>
              group.codes
                .filter((code) => COUNTRY_META[code])
                .map((code) => ({ code, group: group.label }))
            );
            const visible = allItems.slice(0, fallbackLimit);
            const hasMore = fallbackLimit < allItems.length;

            // Re-group only the visible slice for labeled sections
            const visibleGroups: Record<string, string[]> = {};
            for (const { code, group } of visible) {
              (visibleGroups[group] ??= []).push(code);
            }

            return (
              <div className="space-y-4">
                {REGION_GROUPS.map((group) => {
                  const codes = visibleGroups[group.label];
                  if (!codes || codes.length === 0) return null;
                  return (
                    <div key={group.label}>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 px-1">
                        {group.label}
                      </h3>
                      <div className="grid grid-cols-1 gap-1">
                        {codes.map((code) => {
                          const meta = COUNTRY_META[code];
                          return (
                            <button
                              key={code}
                              onClick={() => onCountryClick(code)}
                              className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left w-full"
                            >
                              <Flag code={code} size={24} className="shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{meta.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {meta.indexName ?? (meta.exchanges.length > 0 ? meta.exchanges.join(", ") : "News")}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {hasMore && (
                  <button
                    onClick={() => setFallbackLimit((n) => n + FALLBACK_PAGE_SIZE)}
                    className="w-full py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    Show more countries ({allItems.length - fallbackLimit} remaining)
                  </button>
                )}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
