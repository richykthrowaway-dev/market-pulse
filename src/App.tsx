/* app root */
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { TradingViewProvider } from "@/components/tradingview";
import { StatementProvider } from "@/contexts/StatementContext";
import { NavbarSlotProvider } from "@/contexts/NavbarSlotContext";
import { queryClientDefaults } from "@/config/queryDefaults";
import { initBatchQuoteService } from "@/services/batchQuoteService";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Stocks from "./pages/Stocks";
import Markets from "./pages/Markets";
import Currencies from "./pages/Currencies";
import Global from "./pages/Global";
import Portfolio from "./pages/Portfolio";
import Performance from "./pages/Performance";
import Analysis from "./pages/Analysis";
import Settings from "./pages/Settings";
import Screener from "./pages/Screener";
import Trading from "./pages/Trading";
import RiskAnalysis from "./pages/RiskAnalysis";
import FeeCalculators from "./pages/FeeCalculators";
import Watchlists from "./pages/Watchlists";
import TradeJournal from "./pages/TradeJournal";

const queryClient = new QueryClient({
  defaultOptions: queryClientDefaults,
});

// Register QueryClient with batch quote service for cache population
initBatchQuoteService(queryClient);

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TradingViewProvider>
          <StatementProvider>
            <NavbarSlotProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/stocks" element={<Stocks />} />
                <Route path="/watchlists" element={<Watchlists />} />
                <Route path="/markets" element={<Markets />} />
                <Route path="/currencies" element={<Currencies />} />
                <Route path="/global" element={<Global />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/performance" element={<Performance />} />
                <Route path="/risk-analysis" element={<RiskAnalysis />} />
                <Route path="/analysis" element={<Analysis />} />
                <Route path="/screener" element={<Screener />} />
                <Route path="/trading" element={<Trading />} />
                <Route path="/fee-calculators" element={<FeeCalculators />} />
                <Route path="/journal" element={<TradeJournal />} />
                <Route path="/settings" element={<Settings />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            </NavbarSlotProvider>
          </StatementProvider>
        </TradingViewProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
