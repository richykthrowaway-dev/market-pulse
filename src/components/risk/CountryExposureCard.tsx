import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe } from 'lucide-react';
import { computeCountryExposure, isDeveloped, type HoldingMin } from './riskMath';

function fmtCurrency(v: number) {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPct(v: number) { return v.toFixed(1) + '%'; }

// Common country-code → flag emoji (best-effort, falls back to text)
const FLAGS: Record<string, string> = {
  US: '🇺🇸', CA: '🇨🇦', GB: '🇬🇧', UK: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸',
  NL: '🇳🇱', BE: '🇧🇪', CH: '🇨🇭', SE: '🇸🇪', NO: '🇳🇴', DK: '🇩🇰', FI: '🇫🇮', AT: '🇦🇹',
  AU: '🇦🇺', NZ: '🇳🇿', JP: '🇯🇵', HK: '🇭🇰', SG: '🇸🇬', KR: '🇰🇷', CN: '🇨🇳', IN: '🇮🇳',
  BR: '🇧🇷', MX: '🇲🇽', RU: '🇷🇺', ZA: '🇿🇦', IL: '🇮🇱', IE: '🇮🇪',
};

// Distinct colours for top countries (cycled)
const COLORS = ['hsl(220 70% 55%)', 'hsl(0 70% 55%)', 'hsl(35 80% 55%)', 'hsl(150 60% 45%)',
                'hsl(280 60% 60%)', 'hsl(180 60% 45%)', 'hsl(50 80% 55%)', 'hsl(330 60% 55%)'];

interface Props { holdings: HoldingMin[]; }

export function CountryExposureCard({ holdings }: Props) {
  const rows = computeCountryExposure(holdings);
  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + r.value, 0);
  const devValue = rows.filter(r => isDeveloped(r.country)).reduce((s, r) => s + r.value, 0);
  const emergValue = total - devValue;
  const devPct = total > 0 ? (devValue / total) * 100 : 0;
  const emergPct = 100 - devPct;
  const usPct = rows.find(r => r.country === 'US')?.pct ?? 0;
  const homeBias = usPct > 85;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">Geographic Exposure</CardTitle>
            <CardDescription>
              Where your portfolio is invested by listing country
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stacked bar of all countries */}
        <div className="mb-4">
          <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted">
            {rows.map((r, i) => (
              <div
                key={r.country}
                style={{ width: `${r.pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                title={`${r.country}: ${fmtPct(r.pct)}`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground font-mono">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>

        {/* Developed vs Emerging summary */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Developed markets</p>
            <p className="text-xl font-bold font-mono mt-0.5">{fmtPct(devPct)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{fmtCurrency(devValue)}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Emerging / Other</p>
            <p className="text-xl font-bold font-mono mt-0.5">{fmtPct(emergPct)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{fmtCurrency(emergValue)}</p>
          </div>
        </div>

        {/* Country list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 max-h-[240px] overflow-y-auto">
          {rows.map((r, i) => (
            <div key={r.country} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-b-0">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-lg leading-none">{FLAGS[r.country] ?? '🏳️'}</span>
                <span className="text-sm font-mono font-medium">{r.country}</span>
                {!isDeveloped(r.country) && (
                  <Badge variant="outline" className="text-[9px] py-0 px-1.5">EM</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 font-mono text-sm">
                <span className="text-muted-foreground">{fmtPct(r.pct)}</span>
                <span className="font-semibold">{fmtCurrency(r.value)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Home-bias callout (US-centric users) */}
        {homeBias && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <Globe className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p>
              <strong>{fmtPct(usPct)}</strong> US exposure — consider international diversification.
              US equities are roughly 60% of global market cap.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
