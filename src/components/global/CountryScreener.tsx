import { TradingViewScreener } from "@/components/tradingview/TradingViewScreener";
import { TradingViewStockMarket } from "@/components/tradingview/TradingViewStockMarket";
import { TradingViewHeatmap } from "@/components/tradingview/TradingViewHeatmap";
import { ISO2_TO_TV_MARKET, ISO2_TO_TV_EXCHANGE, ISO2_TO_TV_HEATMAP } from "@/data/tradingViewMarkets";
import { useEodhdExchangeStocks } from "@/hooks/useEodhdExchangeStocks";
import { Loader2, TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CountryScreenerProps {
  iso2: string;
}

function formatMarketCap(value: number | null): string {
  if (value == null) return "—";
  if (value >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${Math.round(value / 1_000_000)}M`;
  return `$${value.toLocaleString()}`;
}

function stripExchangeSuffix(code: string): string {
  const dotIndex = code.lastIndexOf(".");
  return dotIndex !== -1 ? code.slice(0, dotIndex) : code;
}

function EodhdTopStocks({ iso2 }: { iso2: string }) {
  const { data, isLoading, isError } = useEodhdExchangeStocks(iso2, 15);

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <BarChart2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Top Stocks by Market Cap</span>
        <span className="text-xs text-muted-foreground ml-1">· EODHD</span>
      </div>

      {isLoading && (
        <div className="px-4 py-6 flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading...</span>
        </div>
      )}

      {(isError || (!isLoading && (!data || data.length === 0))) && (
        <div className="px-4 py-6 text-center text-muted-foreground text-sm">
          No data available
        </div>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/20 text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium w-8">#</th>
                <th className="px-3 py-2 text-left font-medium">Ticker</th>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-right font-medium">Market Cap</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="px-3 py-2 text-right font-medium">Change %</th>
              </tr>
            </thead>
            <tbody>
              {data.map((stock, index) => {
                const isPositive = stock.change != null && stock.change >= 0;
                const isNegative = stock.change != null && stock.change < 0;

                return (
                  <tr
                    key={stock.code}
                    className={cn(
                      "border-b last:border-b-0 hover:bg-muted/50 transition-colors",
                      index % 2 === 0 ? "bg-background" : "bg-muted/10"
                    )}
                  >
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{index + 1}</td>
                    <td className="px-3 py-2 font-medium tabular-nums">
                      {stripExchangeSuffix(stock.code)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[180px] truncate">
                      {stock.name || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMarketCap(stock.marketCap)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {stock.price != null ? `$${stock.price.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {stock.change != null ? (
                        <span
                          className={cn(
                            "inline-flex items-center justify-end gap-0.5",
                            isPositive && "text-green-600 dark:text-green-400",
                            isNegative && "text-red-600 dark:text-red-400",
                            !isPositive && !isNegative && "text-muted-foreground"
                          )}
                        >
                          {isPositive && <TrendingUp className="h-3 w-3" />}
                          {isNegative && <TrendingDown className="h-3 w-3" />}
                          {isPositive ? "+" : ""}{stock.change.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function CountryScreener({ iso2 }: CountryScreenerProps) {
  const tvMarket = ISO2_TO_TV_MARKET[iso2];
  const tvExchange = ISO2_TO_TV_EXCHANGE[iso2];
  const tvHeatmap = ISO2_TO_TV_HEATMAP[iso2];

  const hasScreener = !!tvMarket;
  const hasHotlists = !!tvExchange;
  const hasHeatmap = !!tvHeatmap;

  // When TradingView has no coverage, show only the EODHD table
  if (!hasScreener && !hasHotlists && !hasHeatmap) {
    return (
      <div className="space-y-4">
        <EodhdTopStocks iso2={iso2} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Primary: full TradingView Screener widget (sortable table) */}
      {hasScreener && (
        <TradingViewScreener
          market={tvMarket}
          defaultScreen="most_capitalized"
          defaultColumn="overview"
          showToolbar
          height={500}
          className="rounded-lg overflow-hidden"
        />
      )}

      {/* Fallback: Stock Market (hotlists) widget — top movers */}
      {!hasScreener && hasHotlists && (
        <TradingViewStockMarket
          exchange={tvExchange}
          showChart
          showSymbolLogo
          height={500}
          className="rounded-lg overflow-hidden"
        />
      )}

      {/* Heatmap: visual market overview by sector */}
      {hasHeatmap && (
        <TradingViewHeatmap
          dataSource={tvHeatmap}
          grouping="sector"
          blockSize="market_cap_basic"
          blockColor="change"
          height={500}
          className="rounded-lg overflow-hidden"
        />
      )}

      {/* EODHD Top Stocks by Market Cap — always shown below TradingView widgets */}
      <EodhdTopStocks iso2={iso2} />
    </div>
  );
}
