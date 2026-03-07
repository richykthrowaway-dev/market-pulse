import { useState, useEffect, useMemo } from "react";
import { useIndices, useNews } from "@/hooks/useSupabaseData";
import { COUNTRY_META } from "@/data/countryMeta";
import { Flag } from "@/components/ui/Flag";
import { cn } from "@/lib/utils";
import { ArrowUpIcon, ArrowDownIcon, ChevronLeft, ChevronRight } from "lucide-react";
import type { CountryStock } from "@/hooks/useCountryStocks";

interface CountrySummaryProps {
  iso2: string;
  stocks: CountryStock[];
  isLoading: boolean;
}

const NEWS_PER_PAGE = 9;

export default function CountrySummary({ iso2, stocks, isLoading }: CountrySummaryProps) {
  const meta = COUNTRY_META[iso2];
  const { data: indices = [] } = useIndices();
  const [newsPage, setNewsPage] = useState(0);

  // Reset page when country changes
  useEffect(() => { setNewsPage(0); }, [iso2]);

  // Find this country's index by matching region
  const countryIndex = useMemo(
    () => meta ? indices.find((idx) => idx.region === meta.region) : undefined,
    [meta, indices]
  );

  // Top movers — memoized to avoid filter/sort on every render
  const gainers = useMemo(
    () => stocks.filter((s) => s.change_percent > 0).slice(0, 5),
    [stocks]
  );
  const losers = useMemo(
    () => [...stocks]
      .filter((s) => s.change_percent < 0)
      .sort((a, b) => a.change_percent - b.change_percent)
      .slice(0, 5),
    [stocks]
  );

  // Fetch news: GNews (country) + MarketAux (country) + Finnhub (tickers)
  const tickers = meta?.newsTickers ?? [];
  const { data: news = [] } = useNews(tickers.length > 0 ? tickers : undefined, iso2);

  if (!meta) return <div className="p-4 text-muted-foreground">No data available for this country.</div>;

  return (
    <div className="space-y-6">
      {/* Country Header */}
      <div className="flex items-center gap-3">
        <Flag code={meta.name} size={48} />
        <div>
          <h2 className="text-xl font-bold">{meta.name}</h2>
          {meta.indexName && <p className="text-sm text-muted-foreground">{meta.indexName}</p>}
        </div>
      </div>

      {/* Index Card */}
      {countryIndex && (
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">{countryIndex.name}</p>
              <p className="text-2xl font-bold font-mono">
                {countryIndex.value.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className={cn("text-right", countryIndex.changePercent >= 0 ? "text-success" : "text-danger")}>
              <p className="text-lg font-bold font-mono flex items-center justify-end gap-1">
                {countryIndex.changePercent >= 0 ? (
                  <ArrowUpIcon className="h-4 w-4" />
                ) : (
                  <ArrowDownIcon className="h-4 w-4" />
                )}
                {countryIndex.changePercent >= 0 ? "+" : ""}
                {countryIndex.changePercent.toFixed(2)}%
              </p>
              <p className="text-sm font-mono">
                {countryIndex.change >= 0 ? "+" : ""}
                {countryIndex.change.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Movers */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {gainers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Top Gainers
              </h3>
              <div className="space-y-1">
                {gainers.map((s) => (
                  <div
                    key={s.symbol}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-sm">{s.symbol}</span>
                      <span className="text-xs text-muted-foreground ml-2 truncate">{s.name}</span>
                    </div>
                    <span className="text-success text-sm font-mono shrink-0">
                      +{s.change_percent.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {losers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Top Losers
              </h3>
              <div className="space-y-1">
                {losers.map((s) => (
                  <div
                    key={s.symbol}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-sm">{s.symbol}</span>
                      <span className="text-xs text-muted-foreground ml-2 truncate">{s.name}</span>
                    </div>
                    <span className="text-danger text-sm font-mono shrink-0">
                      {s.change_percent.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stocks.length === 0 && (
            <p className="text-sm text-muted-foreground">No stock data available for {meta.name}.</p>
          )}
        </>
      )}

      {/* News Headlines (paginated) */}
      {news.length > 0 && (() => {
        const totalPages = Math.ceil(news.length / NEWS_PER_PAGE);
        const page = Math.min(newsPage, totalPages - 1);
        const pageNews = news.slice(page * NEWS_PER_PAGE, (page + 1) * NEWS_PER_PAGE);
        return (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Recent News
              </h3>
              <div className="flex items-center gap-2">
                {totalPages > 1 && (
                  <>
                    <button
                      onClick={() => setNewsPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="p-1 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {page + 1}/{totalPages}
                    </span>
                    <button
                      onClick={() => setNewsPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page === totalPages - 1}
                      className="p-1 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                <span className="text-xs text-muted-foreground">{news.length} articles</span>
              </div>
            </div>
            <div className="space-y-2">
              {pageNews.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block py-1.5 px-2 rounded hover:bg-muted/50 transition-colors group"
                >
                  <p className="text-sm leading-snug group-hover:text-primary transition-colors">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.source} &middot; {item.publishedAt.toLocaleDateString()}
                  </p>
                </a>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
