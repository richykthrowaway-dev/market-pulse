import { useMemo } from 'react';
import { Banknote, ArrowUp, ArrowDown } from 'lucide-react';
import { useCurrencyRates, CURRENCIES } from '@/hooks/useCurrencyRates';
import { EXCHANGES, type ExchangeInfo } from '@/data/exchangeData';
import { cn } from '@/lib/utils';

/**
 * CurrencyCard — local currency vs USD with today's percentage move.
 *
 * Reuses the already-cached `useCurrencyRates` hook (api-fx-rates edge
 * function), so opening the Summary tab adds zero new network calls
 * when other parts of the app have already loaded FX rates.
 *
 * Currency lookup: ISO2 → primary exchange (EXCHANGES table) → ISO 4217
 * currency code.  Skipped for countries whose exchange isn't in the
 * table OR whose currency is USD (no point showing "1 USD = 1 USD").
 */

interface Props {
  iso2: string;
}

function getPrimaryCurrency(iso2: string): { code: string; exchange: ExchangeInfo } | null {
  const ex = EXCHANGES.find(e => e.country === iso2.toUpperCase());
  if (!ex) return null;
  return { code: ex.currency, exchange: ex };
}

export function CurrencyCard({ iso2 }: Props) {
  const { rates, isLoading } = useCurrencyRates();

  const currency = useMemo(() => getPrimaryCurrency(iso2), [iso2]);

  // Skip rendering entirely if we can't resolve a currency, or if the
  // country trades in USD (no FX move to show).
  if (!currency || currency.code === 'USD') return null;

  const rate = rates?.[currency.code];

  // api-fx-rates can return rates keyed by currency code; if we don't
  // find this country's currency we silently skip rendering — the
  // user is browsing a country with thinly-traded currency we don't
  // cover.
  if (!isLoading && !rate) return null;

  const meta = CURRENCIES[currency.code];
  const positive = rate ? rate.changePct >= 0 : false;
  // `rate.changePct` is in market convention.  For USD/XXX pairs (most),
  // a positive market change means USD strengthened — i.e. the LOCAL
  // currency WEAKENED.  We display from the local-currency perspective,
  // so we invert the sign when the symbol is USD-base (USDxxx=X form).
  const isUsdBase = rate?.symbol?.startsWith('USD') ?? false;
  const localPct  = rate ? (isUsdBase ? -rate.changePct : rate.changePct) : 0;
  const localUp   = localPct >= 0;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Banknote className="w-3 h-3" />
          Currency vs USD
        </h3>
        {meta && (
          <span className="text-[10px] text-muted-foreground/70">
            {meta.name}
          </span>
        )}
      </div>

      {isLoading || !rate ? (
        <div className="h-12 rounded bg-muted/30 animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-2 flex-wrap">
          {/* USD-per-local rate (always quoted as "X local = 1 USD") */}
          <div>
            <span className="text-lg font-bold tabular-nums">
              {rate.usdRate.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: rate.usdRate < 10 ? 4 : 2,
              })}
            </span>
            <span className="text-xs text-muted-foreground ml-1">
              {currency.code} / USD
            </span>
          </div>

          {/* Today's move — color from LOCAL currency's perspective */}
          <span className={cn(
            'ml-auto flex items-center gap-0.5 text-xs font-mono font-semibold tabular-nums',
            localUp ? 'text-emerald-400' : 'text-red-400',
          )}>
            {localUp ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {localUp ? '+' : ''}{localPct.toFixed(2)}%
          </span>
        </div>
      )}

      <p className="mt-1 text-[9px] text-muted-foreground/50 leading-snug">
        {meta?.symbol && <span className="font-mono">{meta.symbol} </span>}
        Yahoo Finance · daily change vs USD
      </p>
    </div>
  );
}
