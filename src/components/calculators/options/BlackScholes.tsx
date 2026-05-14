// src/components/calculators/options/BlackScholes.tsx
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sparkles } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { CalculatorShell, Callout } from '../CalculatorShell';
import { NumInput } from '../NumInput';
import { StatBox } from '../StatBox';
import { ChartTooltip } from '../ChartTooltip';
import { fmtDollar, yFmt } from '../calcUtils';

type OptType = 'call' | 'put';

function cnd(x: number): number {
  const a1 = 0.31938153;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const L = Math.abs(x);
  const k = 1 / (1 + 0.2316419 * L);
  const w =
    1 -
    (1 / Math.sqrt(2 * Math.PI)) *
      Math.exp((-L * L) / 2) *
      (a1 * k + a2 * k ** 2 + a3 * k ** 3 + a4 * k ** 4 + a5 * k ** 5);
  return x < 0 ? 1 - w : w;
}

function npdf(x: number): number {
  return Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
}

interface BSResult {
  price: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  intrinsic: number;
  extrinsic: number;
  d1: number;
  d2: number;
}

function blackScholes(type: OptType, S: number, K: number, t: number, sigma: number, r: number, q: number): BSResult {
  // Guard against degenerate inputs
  const safeT = Math.max(t, 1e-9);
  const safeSig = Math.max(sigma, 1e-9);

  const d1 = (Math.log(S / K) + (r - q + (safeSig * safeSig) / 2) * safeT) / (safeSig * Math.sqrt(safeT));
  const d2 = d1 - safeSig * Math.sqrt(safeT);

  const eqt = Math.exp(-q * safeT);
  const ert = Math.exp(-r * safeT);

  let price = 0;
  let delta = 0;
  let theta = 0;
  let rho = 0;

  if (type === 'call') {
    price = S * eqt * cnd(d1) - K * ert * cnd(d2);
    delta = eqt * cnd(d1);
    theta =
      ((-S * eqt * npdf(d1) * safeSig) / (2 * Math.sqrt(safeT)) -
        r * K * ert * cnd(d2) +
        q * S * eqt * cnd(d1)) /
      365;
    rho = (K * safeT * ert * cnd(d2)) / 100;
  } else {
    price = K * ert * cnd(-d2) - S * eqt * cnd(-d1);
    delta = eqt * (cnd(d1) - 1);
    theta =
      ((-S * eqt * npdf(d1) * safeSig) / (2 * Math.sqrt(safeT)) +
        r * K * ert * cnd(-d2) -
        q * S * eqt * cnd(-d1)) /
      365;
    rho = (-K * safeT * ert * cnd(-d2)) / 100;
  }

  const gamma = (eqt * npdf(d1)) / (S * safeSig * Math.sqrt(safeT));
  const vega = (S * eqt * npdf(d1) * Math.sqrt(safeT)) / 100;

  const intrinsic = type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
  const extrinsic = Math.max(price - intrinsic, 0);

  return { price, delta, gamma, vega, theta, rho, intrinsic, extrinsic, d1, d2 };
}

export function BlackScholes() {
  const [type, setType] = useState<OptType>('call');
  const [S, setS] = useState(100);
  const [K, setK] = useState(100);
  const [dte, setDte] = useState(30);
  const [iv, setIv] = useState(30);
  const [rate, setRate] = useState(5);
  const [yld, setYld] = useState(0);

  const result = useMemo(() => {
    const t = dte / 365;
    const sigma = iv / 100;
    const r = rate / 100;
    const q = yld / 100;
    return blackScholes(type, S, K, t, sigma, r, q);
  }, [type, S, K, dte, iv, rate, yld]);

  // Sensitivity table
  const sensitivity = useMemo(() => {
    const t = dte / 365;
    const sigma = iv / 100;
    const r = rate / 100;
    const q = yld / 100;
    const mults = [0.9, 0.95, 1.0, 1.05, 1.1];
    return mults.map(m => {
      const px = +(S * m).toFixed(2);
      const res = blackScholes(type, px, K, t, sigma, r, q);
      return { mult: m, stock: px, price: res.price, delta: res.delta };
    });
  }, [S, K, dte, iv, rate, yld, type]);

  // Price-vs-stock chart
  const chartData = useMemo(() => {
    const t = dte / 365;
    const sigma = iv / 100;
    const r = rate / 100;
    const q = yld / 100;
    const pMin = K * 0.8;
    const pMax = K * 1.2;
    const steps = 60;
    const arr: { stock: number; price: number; intrinsic: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const px = pMin + ((pMax - pMin) * i) / steps;
      const res = blackScholes(type, px, K, t, sigma, r, q);
      const intr = type === 'call' ? Math.max(px - K, 0) : Math.max(K - px, 0);
      arr.push({ stock: +px.toFixed(2), price: +res.price.toFixed(2), intrinsic: +intr.toFixed(2) });
    }
    return arr;
  }, [K, dte, iv, rate, yld, type]);

  return (
    <CalculatorShell
      title="Black-Scholes Pricer"
      description="Theoretical option price and Greeks with continuous dividends."
      inputs={
        <>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Option Type</Label>
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={type === 'call' ? 'default' : 'outline'}
                onClick={() => setType('call')}
                className="h-8"
              >
                Call
              </Button>
              <Button
                type="button"
                size="sm"
                variant={type === 'put' ? 'default' : 'outline'}
                onClick={() => setType('put')}
                className="h-8"
              >
                Put
              </Button>
            </div>
          </div>
          <NumInput label="Stock Price (S)" value={S} onChange={setS} min={0.01} step={1} prefix="$" />
          <NumInput label="Strike (K)" value={K} onChange={setK} min={0.01} step={1} prefix="$" />
          <NumInput label="Days to Expiration" value={dte} onChange={setDte} min={1} max={3650} step={1} suffix="days" />
          <NumInput label="Implied Volatility" value={iv} onChange={setIv} min={0.1} max={500} step={1} suffix="%" />
          <NumInput label="Risk-Free Rate" value={rate} onChange={setRate} min={0} max={50} step={0.25} suffix="%" />
          <NumInput label="Dividend Yield" value={yld} onChange={setYld} min={0} max={50} step={0.25} suffix="%" />
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatBox
              label="Theoretical Price"
              value={`$${result.price.toFixed(2)}`}
              sub={`${fmtDollar(result.price * 100)} per contract`}
              highlight="positive"
            />
            <StatBox
              label="Intrinsic"
              value={`$${result.intrinsic.toFixed(2)}`}
              sub={`Extrinsic: $${result.extrinsic.toFixed(2)}`}
            />
            <StatBox
              label="Delta"
              value={result.delta.toFixed(4)}
              sub="Per $1 stock move"
            />
            <StatBox
              label="Gamma"
              value={result.gamma.toFixed(4)}
              sub="Delta sensitivity"
            />
            <StatBox
              label="Theta"
              value={`$${result.theta.toFixed(4)}`}
              sub="Per day decay"
              highlight={result.theta < 0 ? 'negative' : undefined}
            />
            <StatBox
              label="Vega"
              value={`$${result.vega.toFixed(4)}`}
              sub="Per 1% IV move"
            />
            <StatBox
              label="Rho"
              value={`$${result.rho.toFixed(4)}`}
              sub="Per 1% rate move"
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Price vs Stock Price</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                  <XAxis
                    dataKey="stock"
                    tick={{ fontSize: 11 }}
                    tickFormatter={v => `$${Number(v).toFixed(0)}`}
                    interval="preserveStartEnd"
                  />
                  <YAxis tickFormatter={yFmt} tick={{ fontSize: 11 }} width={60} />
                  <RechartsTooltip
                    content={
                      <ChartTooltip
                        labelPrefix="Stock $"
                        formatter={(v: number) => `$${v.toFixed(2)}`}
                      />
                    }
                  />
                  <ReferenceLine
                    x={S}
                    stroke="#3b82f6"
                    strokeDasharray="2 2"
                    label={{ value: 'Spot', position: 'top', fontSize: 10, fill: '#3b82f6' }}
                  />
                  <ReferenceLine
                    x={K}
                    stroke="#f59e0b"
                    strokeDasharray="4 3"
                    label={{ value: 'Strike', position: 'top', fontSize: 10, fill: '#f59e0b' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="intrinsic"
                    name="Intrinsic"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    name="Theoretical"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Sensitivity Table</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <thead>
                    <tr className="text-[11px] text-muted-foreground uppercase tracking-wide border-b">
                      <th className="text-left py-2 font-semibold">Scenario</th>
                      <th className="text-right py-2 font-semibold">Stock</th>
                      <th className="text-right py-2 font-semibold">Price</th>
                      <th className="text-right py-2 font-semibold">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivity.map(row => {
                      const pct = (row.mult - 1) * 100;
                      const label =
                        row.mult === 1 ? 'Current'
                        : `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`;
                      return (
                        <tr key={row.mult} className="border-b last:border-0">
                          <td className={`py-2 ${row.mult === 1 ? 'font-semibold' : ''}`}>{label}</td>
                          <td className="text-right py-2">${row.stock.toFixed(2)}</td>
                          <td className="text-right py-2">${row.price.toFixed(2)}</td>
                          <td className="text-right py-2">{row.delta.toFixed(4)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Callout icon={<Sparkles className="h-4 w-4 text-amber-500" />}>
            Theta will erode this position by{' '}
            <strong className="text-foreground">${Math.abs(result.theta).toFixed(4)}</strong>{' '}
            per day at current levels. Vega means each 1% IV change moves the price by{' '}
            <strong className="text-foreground">${result.vega.toFixed(4)}</strong>.
          </Callout>
        </>
      }
    />
  );
}
