import { TradingViewScreener } from "@/components/tradingview/TradingViewScreener";
import { TradingViewStockMarket } from "@/components/tradingview/TradingViewStockMarket";
import { TradingViewHeatmap } from "@/components/tradingview/TradingViewHeatmap";
import { ISO2_TO_TV_MARKET, ISO2_TO_TV_EXCHANGE, ISO2_TO_TV_HEATMAP } from "@/data/tradingViewMarkets";

interface CountryScreenerProps {
  iso2: string;
}

export default function CountryScreener({ iso2 }: CountryScreenerProps) {
  const tvMarket = ISO2_TO_TV_MARKET[iso2];
  const tvExchange = ISO2_TO_TV_EXCHANGE[iso2];
  const tvHeatmap = ISO2_TO_TV_HEATMAP[iso2];

  const hasScreener = !!tvMarket;
  const hasHotlists = !!tvExchange;
  const hasHeatmap = !!tvHeatmap;

  if (!hasScreener && !hasHotlists && !hasHeatmap) {
    return (
      <div className="py-6 text-center text-muted-foreground text-sm">
        Screener not available for this country.
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
    </div>
  );
}
