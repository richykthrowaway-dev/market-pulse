
import React from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Treemap } from 'recharts';
import { useStocks } from '@/hooks/useSupabaseData';
import { formatNumber } from '@/utils/stocksApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TradingViewHeatmap, TradingViewTechnicalAnalysis, TradingViewScreener } from '@/components/tradingview';
import { getGicsSectorColor } from '@/lib/gicsColors';

const Analysis = () => {
  const { data: stocks = [], isLoading } = useStocks();

  const sectorPerformance = [
    { name: 'Information Technology', value: 8.2 },
    { name: 'Health Care', value: 3.5 },
    { name: 'Financials', value: -1.2 },
    { name: 'Consumer Discretionary', value: 2.8 },
    { name: 'Energy', value: -2.5 },
    { name: 'Materials', value: 0.9 },
    { name: 'Utilities', value: -0.7 },
  ];
  
  const riskData = [
    { name: 'Volatility', value: 65 },
    { name: 'Correlation', value: 42 },
    { name: 'Downside Risk', value: 38 },
    { name: 'Sharpe Ratio', value: 78 },
    { name: 'Liquidity', value: 85 },
  ];
  
  const distributionData = [
    { name: 'Large Cap', value: 55 },
    { name: 'Mid Cap', value: 30 },
    { name: 'Small Cap', value: 15 },
  ];
  
  const stockGrowthData = stocks
    .map(stock => ({
      name: stock.symbol,
      value: Math.abs(stock.changePercent) || 0.01,
      changePercent: stock.changePercent
    }))
    .sort((a, b) => b.changePercent - a.changePercent);
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
  
  const CustomizedContent = (props: any) => {
    const { depth, x, y, width, height, name, changePercent } = props;
    const cp = changePercent ?? 0;
    const color = cp >= 0 ? "#4ade80" : "#f87171";
    const cellValue = cp >= 0 ? `+${cp.toFixed(2)}%` : `${cp.toFixed(2)}%`;

    return (
      <g>
        <rect x={x} y={y} width={width} height={height} style={{ fill: color, stroke: '#fff', strokeWidth: 2 / (depth + 1e-10), strokeOpacity: 1 / (depth + 1e-10) }} />
        {width > 50 && height > 30 ? (
          <>
            <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="#fff" fontSize={14} fontWeight="bold">{name}</text>
            <text x={x + width / 2} y={y + height / 2 + 12} textAnchor="middle" fill="#fff" fontSize={12}>{cellValue}</text>
          </>
        ) : null}
      </g>
    );
  };
  
  return (
    <PageLayout title="Market Analysis">
      {/* TradingView Heatmap - NASDAQ 100 */}
      <div className="mb-6 bg-card rounded-lg p-4 shadow border border-border">
        <h2 className="text-xl font-semibold mb-3">NASDAQ 100 Heatmap</h2>
        <TradingViewHeatmap dataSource="NASDAQ100" blockColor="change" height={450} className="w-full" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Sector Performance (YTD)</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorPerformance} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}%`, 'Performance']} />
                <Bar dataKey="value" name="YTD Performance" fill="#8884d8" radius={[4, 4, 0, 0]}>
                  {sectorPerformance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getGicsSectorColor(entry.name)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Technical Analysis Widget */}
        <div className="bg-card rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Technical Analysis — S&P 500</h2>
          <TradingViewTechnicalAnalysis symbol="FOREXCOM:SPXUSD" interval="1D" height={300} />
        </div>

        <div className="lg:col-span-2 bg-card rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Stock Performance Heatmap</h2>
          {isLoading ? (
            <p className="text-muted-foreground">Loading stock data…</p>
          ) : stockGrowthData.length === 0 ? (
            <p className="text-muted-foreground">No stock data available</p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap data={stockGrowthData} dataKey="value" aspectRatio={4/3} stroke="#fff" fill="#8884d8" content={<CustomizedContent />} />
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-4 text-sm text-muted-foreground">
            <p>Showing performance by percentage change. Green indicates positive growth, red indicates decline.</p>
          </div>
        </div>
        
        <div className="bg-card rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Risk Assessment</h2>
          <div className="space-y-4">
            {riskData.map((item) => (
              <div key={item.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{item.name}</span>
                  <span className="font-medium">{item.value}/100</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${item.value >= 70 ? 'bg-success' : item.value >= 40 ? 'bg-warning' : 'bg-danger'}`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-card rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Market Capitalization Distribution</h2>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distributionData} cx="50%" cy="50%" labelLine={true} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value}%`, 'Allocation']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Gainers Screener */}
        <div className="lg:col-span-2 bg-card rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Top Gainers</h2>
          <TradingViewScreener defaultScreen="top_gainers" defaultColumn="performance" height={400} className="w-full" />
        </div>
      </div>
    </PageLayout>
  );
};

export default Analysis;
