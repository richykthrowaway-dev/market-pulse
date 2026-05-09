/* app root */
import { lazy, Suspense } from "react";
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

// ── Lazy page chunks ──────────────────────────────────────────────────────────
// Each page is a separate async chunk. Vite splits them automatically when
// React.lazy() is used; the browser only downloads a page's JS the first
// time the user navigates to that route. This keeps the initial bundle
// (providers + router shell) small so the app is interactive faster.
//
// Notable win: /global pulls in Three.js (1.7 MB gz: 482 kB) and D3 —
// with lazy loading those chunks are deferred until the user actually
// visits the globe page.
const Index         = lazy(() => import("./pages/Index"));
const NotFound      = lazy(() => import("./pages/NotFound"));
const Stocks        = lazy(() => import("./pages/Stocks"));
const Markets       = lazy(() => import("./pages/Markets"));
const Currencies    = lazy(() => import("./pages/Currencies"));
const Global        = lazy(() => import("./pages/Global"));
const Portfolio     = lazy(() => import("./pages/Portfolio"));
const Performance   = lazy(() => import("./pages/Performance"));
const Analysis      = lazy(() => import("./pages/Analysis"));
const Settings      = lazy(() => import("./pages/Settings"));
const Screener      = lazy(() => import("./pages/Screener"));
const Trading       = lazy(() => import("./pages/Trading"));
const RiskAnalysis  = lazy(() => import("./pages/RiskAnalysis"));
const FeeCalculators = lazy(() => import("./pages/FeeCalculators"));
const Watchlists    = lazy(() => import("./pages/Watchlists"));
const TradeJournal  = lazy(() => import("./pages/TradeJournal"));

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
              <Suspense fallback={
                <div className="flex items-center justify-center h-screen w-screen bg-background">
                  <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              }>
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
              </Suspense>
            </BrowserRouter>
            </NavbarSlotProvider>
          </StatementProvider>
        </TradingViewProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
