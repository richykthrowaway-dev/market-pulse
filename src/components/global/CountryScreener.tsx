import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ArrowUpDown } from "lucide-react";
import type { CountryStock } from "@/hooks/useCountryStocks";

interface CountryScreenerProps {
  stocks: CountryStock[];
  isLoading: boolean;
}

type SortKey = "symbol" | "name" | "price" | "change_percent" | "market_cap";
type SortDir = "asc" | "desc";

export default function CountryScreener({ stocks, isLoading }: CountryScreenerProps) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("change_percent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [sectorFilter, setSectorFilter] = useState<string>("all");

  const sectors = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach((s) => {
      if (s.sector) set.add(s.sector);
    });
    return Array.from(set).sort();
  }, [stocks]);

  const filtered = useMemo(() => {
    let result = sectorFilter === "all" ? stocks : stocks.filter((s) => s.sector === sectorFilter);
    result = [...result].sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });
    return result;
  }, [stocks, sectorFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const formatMarketCap = (cap: number | null) => {
    if (!cap) return "\u2014";
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
    if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`;
    return `$${cap.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-8 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sector Filter */}
      {sectors.length > 0 && (
        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="w-full px-3 py-1.5 text-sm rounded-md border border-border bg-background text-foreground"
        >
          <option value="all">All Sectors</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              {(
                [
                  ["symbol", "Symbol"],
                  ["name", "Name"],
                  ["price", "Price"],
                  ["change_percent", "Chg%"],
                  ["market_cap", "MCap"],
                ] as [SortKey, string][]
              ).map(([key, label]) => (
                <th
                  key={key}
                  className="py-2 px-2 text-left font-medium cursor-pointer hover:text-foreground transition-colors select-none"
                  onClick={() => toggleSort(key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr
                key={s.symbol}
                className="border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/stocks?symbol=${s.symbol}`)}
              >
                <td className="py-1.5 px-2 font-medium">{s.symbol}</td>
                <td className="py-1.5 px-2 truncate max-w-[140px]">{s.name}</td>
                <td className="py-1.5 px-2 font-mono">
                  {s.price > 0 ? `$${s.price.toFixed(2)}` : "\u2014"}
                </td>
                <td
                  className={cn(
                    "py-1.5 px-2 font-mono",
                    s.change_percent >= 0 ? "text-success" : "text-danger"
                  )}
                >
                  {s.change_percent >= 0 ? "+" : ""}
                  {s.change_percent.toFixed(2)}%
                </td>
                <td className="py-1.5 px-2 font-mono text-muted-foreground">
                  {formatMarketCap(s.market_cap)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-muted-foreground">
                  No stocks found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
