
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useStatement } from '@/contexts/StatementContext';
import { useBeta } from '@/hooks/useBeta';
import { use52Week } from '@/hooks/use52Week';
import { MarketPositionWidget } from '@/components/risk/MarketPositionWidget';
import { StressTestSection } from '@/components/risk/StressTestSection';
import { RebalancingWidget } from '@/components/risk/RebalancingWidget';
import { batchLookupSymbols, type SymbolMeta as LookupSymbolMeta } from '@/services/symbolLookupService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SectorBadge, SectorDot, type GicsDetail } from '@/components/ui/SectorBadge';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ShieldAlert, Activity, Scale, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getGicsSectorColor, normalizeSector } from '@/lib/gicsColors';
import type { OpenPosition } from '@/services/parser';

/* Beta bar now uses GICS sector colors from holdings */

/* ─── helpers ─── */
function fmtCurrency(v: number) {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPct(v: number) {
  return v.toFixed(1) + '%';
}

/* sector betas removed — now calculated from real market data */

function getBetaLabel(beta: number) {
  if (beta < 0.8) return { label: 'Low Risk', variant: 'default' as const };
  if (beta < 1.2) return { label: 'Moderate', variant: 'secondary' as const };
  return { label: 'High Risk', variant: 'destructive' as const };
}

/* categories moved to MarketPositionWidget */

/* ─── Normalize ─── */
interface NormalizedHolding {
  ticker: string;
  name: string;
  sector: string;
  country: string;
  shares: number;
  costBasis: number;
  marketValue: number;
  unrealizedPL: number;
  closePrice: number;
  currency: string;
  gicsDetail?: GicsDetail;
}

function normalizeFromParsed(
  positions: OpenPosition[],
  sectorMap: Record<string, { gicsSector?: string; gicsIndustryGroup?: string; gicsIndustry?: string; gicsSubIndustry?: string; sector?: string; country?: string }>,
): NormalizedHolding[] {
  return positions
    .filter(p => p.quantity > 0 && p.assetCategory === 'Stocks')
    .map(p => {
      const sym = sectorMap[p.symbol.toUpperCase()] || {};
      return {
        ticker: p.symbol,
        name: p.description,
        sector: normalizeSector(sym.gicsSector || sym.sector || 'Other'),
        country: sym.country || (p.currency === 'USD' ? 'US' : p.currency === 'CAD' ? 'CA' : p.currency),
        shares: p.quantity,
        costBasis: p.costPrice,
        marketValue: p.marketValue,
        unrealizedPL: p.unrealizedPL,
        closePrice: p.closePrice,
        currency: p.currency,
        gicsDetail: {
          sector: sym.gicsSector || sym.sector || undefined,
          industryGroup: sym.gicsIndustryGroup || undefined,
          industry: sym.gicsIndustry || undefined,
          subIndustry: sym.gicsSubIndustry || undefined,
        },
      };
    });
}

function normalizeFromPortfolio(holdings: any[]): NormalizedHolding[] {
  return holdings.map((h: any) => ({
    ticker: h.localTicker || h.canonicalTicker || '?',
    name: h.symbolName || '',
    sector: normalizeSector(h.gicsSector || h.sector || 'Other'),
    country: h.country || (h.currency === 'USD' ? 'US' : h.currency === 'CAD' ? 'CA' : h.currency || 'US'),
    shares: h.shares,
    costBasis: h.avg_cost_basis,
    marketValue: h.shares * h.avg_cost_basis,
    unrealizedPL: 0,
    closePrice: h.avg_cost_basis,
    currency: h.currency || 'USD',
  }));
}

/* ════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════ */
const RiskAnalysis = () => {
  const { data: dbHoldings = [], isLoading: isDbLoading } = usePortfolio();
  const { parsedStatement } = useStatement();

  /* ── Fetch GICS sectors for parsed statement tickers (exchange-aware) ── */
  const parsedItems = useMemo(() => {
    if (!parsedStatement) return [];
    const seen = new Set<string>();
    return parsedStatement.openPositions
      .filter(p => p.quantity > 0 && p.assetCategory === 'Stocks')
      .filter(p => {
        const key = p.symbol.toUpperCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(p => ({ ticker: p.symbol.toUpperCase(), exchange: p.exchange || undefined }));
  }, [parsedStatement]);

  const parsedTickers = useMemo(() => parsedItems.map(i => i.ticker), [parsedItems]);

  const { data: sectorMap = {} } = useQuery({
    queryKey: ['gics-sectors', parsedTickers, parsedItems.map(i => i.exchange).join(',')],
    queryFn: async () => {
      if (parsedItems.length === 0) return {};
      const symbolMeta = await batchLookupSymbols(parsedItems);
      const map: Record<string, { gicsSector?: string; gicsIndustryGroup?: string; gicsIndustry?: string; gicsSubIndustry?: string; sector?: string; country?: string }> = {};
      for (const [ticker, meta] of Object.entries(symbolMeta)) {
        map[ticker] = {
          gicsSector: meta.sector !== 'Other' ? meta.sector : undefined,
          gicsIndustryGroup: meta.gicsIndustryGroup,
          gicsIndustry: meta.gicsIndustry,
          gicsSubIndustry: meta.subIndustry || undefined,
          country: meta.country !== 'Unknown' ? meta.country : undefined,
        };
      }
      return map;
    },
    enabled: parsedItems.length > 0,
    staleTime: 5 * 60_000,
  });

  /* ── Merge sources: parsed statement takes priority ── */
  const holdings: NormalizedHolding[] = useMemo(() => {
    if (parsedStatement && parsedStatement.openPositions.length > 0) {
      return normalizeFromParsed(parsedStatement.openPositions, sectorMap);
    }
    return normalizeFromPortfolio(dbHoldings);
  }, [parsedStatement, dbHoldings, sectorMap]);


  const isLoading = isDbLoading && !parsedStatement;

  /* ── derived data ── */
  const totalValue = useMemo(
    () => holdings.reduce((s, h) => s + h.marketValue, 0),
    [holdings],
  );

  const sectorData = useMemo(() => {
    const map: Record<string, number> = {};
    holdings.forEach(h => {
      const sector = h.sector || 'Other';
      map[sector] = (map[sector] || 0) + h.marketValue;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, pct: totalValue ? (value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  /* ── beta from real market data ── */
  const { tickers, weights } = useMemo(() => {
    if (!totalValue || !holdings.length) return { tickers: [] as string[], weights: [] as number[] };
    const t = holdings.map(h => h.ticker);
    const w = holdings.map(h => h.marketValue / totalValue);
    return { tickers: t, weights: w };
  }, [holdings, totalValue]);

  const { data: betaResult, isLoading: isBetaLoading } = useBeta(tickers, weights, tickers.length > 0);

  const betaData = useMemo(() => {
    const betas = betaResult?.betas ?? {};
    const portfolioBeta = betaResult?.portfolioBeta ?? 0;
    const segments = holdings.map(h => {
      const weight = totalValue ? h.marketValue / totalValue : 0;
      const beta = betas[h.ticker] ?? 1.0;
      return { ticker: h.ticker, weight, beta, contribution: weight * beta };
    });
    return { portfolioBeta, segments };
  }, [betaResult, holdings, totalValue]);

  /* ── 52-week range from real market data ── */
  const tickerList = useMemo(() => holdings.map(h => h.ticker), [holdings]);
  const { data: rangeResult, isLoading: is52wLoading, isError: use52WeekError } = use52Week(tickerList, tickerList.length > 0);


  /* rebalancing logic moved to RebalancingWidget */

  /* ── loading state ── */
  if (isLoading) {
    return (
      <PageLayout title="Risk Analysis">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading risk data…</p>
        </div>
      </PageLayout>
    );
  }

  /* ── empty state ── */
  if (!holdings.length) {
    return (
      <PageLayout title="Risk Analysis">
        <div className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">Upload a statement on the Portfolio page or add holdings to view risk analysis.</p>
        </div>
      </PageLayout>
    );
  }

  /* ══════════════════  RENDER  ══════════════════ */
  return (
    <PageLayout title="Risk Analysis">
      <div className="space-y-6">

        {/* ── 1. RISK METRICS / SECTOR BREAKDOWN ── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Risk Metrics</CardTitle>
                <CardDescription>Comprehensive risk analysis and portfolio statistics</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-shrink-0 flex items-center justify-center">
                <div className="relative h-40 w-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sectorData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={1} stroke="hsl(var(--card))">
                        {sectorData.map((entry) => (
                          <Cell key={entry.name} fill={getGicsSectorColor(entry.name)} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [fmtCurrency(Number(v)), 'Value']} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Positions</span>
                    <span className="text-lg font-bold font-mono">{holdings.length}</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5 max-h-[300px] overflow-y-auto">
                {holdings
                  .sort((a, b) => b.marketValue - a.marketValue)
                  .map((h) => (
                    <div key={h.ticker} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-b-0">
                      <div className="flex items-center gap-2">
                        <SectorDot sector={h.sector} size="xs" gicsDetail={h.gicsDetail} />
                        <span className="text-sm font-mono font-medium truncate max-w-[120px]">{h.ticker}</span>
                        <SectorBadge sector={h.sector} size="xs" className="hidden sm:inline-flex" gicsDetail={h.gicsDetail} />
                      </div>
                      <div className="flex items-center gap-3 font-mono text-sm">
                        <span className="text-muted-foreground">{fmtPct(totalValue ? (h.marketValue / totalValue) * 100 : 0)}</span>
                        <span className="font-semibold">{fmtCurrency(h.marketValue)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── 2. PORTFOLIO BETA GRAPH ── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Portfolio Beta Graph</CardTitle>
                <CardDescription>Visualize each holding's contribution to overall portfolio volatility</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Card className="bg-muted/30 border-border/50">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Portfolio Beta (vs SPY, 1Y)</p>
                    {isBetaLoading ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Calculating…</span>
                      </div>
                    ) : (
                      <p className="text-3xl font-bold font-mono">{betaData.portfolioBeta.toFixed(2)}</p>
                    )}
                  </div>
                  <Badge variant={getBetaLabel(betaData.portfolioBeta).variant}>
                    {getBetaLabel(betaData.portfolioBeta).label}
                  </Badge>
                </div>
                <div className="h-5 rounded-full overflow-hidden flex">
                  {betaData.segments.map((seg, i) => (
                    <div key={seg.ticker + i} style={{ width: `${seg.weight * 100}%`, backgroundColor: getGicsSectorColor(holdings.find(h => h.ticker === seg.ticker)?.sector) }}
                      title={`${seg.ticker}: β${seg.beta.toFixed(2)} (${(seg.weight * 100).toFixed(1)}%)`} />
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground font-mono">0%</span>
                  <span className="text-[10px] text-muted-foreground font-mono">50%</span>
                  <span className="text-[10px] text-muted-foreground font-mono">100%</span>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* ── 3. MARKET POSITION ANALYSIS ── */}
        <MarketPositionWidget
          holdings={holdings.map(h => ({ ticker: h.ticker, name: h.name, closePrice: h.closePrice, marketValue: h.marketValue }))}
          ranges={rangeResult?.ranges}
          isLoading={is52wLoading}
          isError={!!use52WeekError}
          totalHoldings={holdings.length}
        />

        {/* ── 4. REBALANCING ANALYSIS ── */}
        <RebalancingWidget
          holdings={holdings.map(h => ({
            ticker: h.ticker,
            name: h.name,
            sector: h.sector,
            country: h.country,
            shares: h.shares,
            closePrice: h.closePrice,
            marketValue: h.marketValue,
          }))}
        />

        {/* ── 5. STRESS TEST ── */}
        <StressTestSection
          holdings={holdings.map(h => ({
            ticker: h.ticker,
            name: h.name,
            shares: h.shares,
            closePrice: h.closePrice,
            marketValue: h.marketValue,
          }))}
          betas={betaResult?.betas ?? {}}
          isBetaLoading={isBetaLoading}
        />
      </div>
    </PageLayout>
  );
};

export default RiskAnalysis;
