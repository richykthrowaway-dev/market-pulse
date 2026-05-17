import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, ArrowRight, Eye } from 'lucide-react';
import { Area, AreaChart } from 'recharts';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useLiveSpeed } from '@/hooks/useLiveSpeed';
import { useLiveQuotes, type LiveQuote } from '@/hooks/useLiveQuotes';
import { useSymbolSearch } from '@/hooks/useSymbolSearch';
import { useSparkline } from '@/hooks/useSparkline';
import { windowChange } from '@/lib/windowChange';

/**
 * Watchlist — broker-independent watchlist card for the Trading page.
 *
 * Add tickers via autocomplete, see live last price + a tiny sparkline +
 * window change per row. Click a row to select a symbol; send it to the
 * order ticket; remove it. No IBKR gateway required.
 */

interface WatchlistProps {
  selSymbol: string;
  onSelect: (s: string) => void;
  onSendToTicket: (s: string) => void;
  showGatewayNote: boolean;
}

const fmt = (n: number) =>
  '$' + n.toLocaleString('en-US', { maximumFractionDigits: n >= 1000 ? 0 : 2 });

const BUY = 'hsl(var(--trading-buy))';
const SELL = 'hsl(var(--trading-sell))';

interface WatchRowProps {
  sym: string;
  selected: boolean;
  quote: LiveQuote | undefined;
  onSelect: (s: string) => void;
  onSendToTicket: (s: string) => void;
  onRemove: (s: string) => void;
}

function WatchRow({ sym, selected, quote, onSelect, onSendToTicket, onRemove }: WatchRowProps) {
  const { data } = useSparkline(sym);
  const bars = data ?? [];
  const ch = windowChange(bars);
  const color = ch == null ? undefined : ch.abs >= 0 ? BUY : SELL;
  const price = quote?.price ?? null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(sym)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(sym); }
      }}
      className={`flex items-center gap-3 rounded-lg border bg-card/60 px-3 py-2 cursor-pointer transition-colors hover:bg-muted/40 ${
        selected ? 'ring-1 ring-primary/40 bg-muted/40' : 'border-border/60'
      }`}
    >
      <span className="font-semibold text-sm w-16 shrink-0 truncate">{sym}</span>

      <span className="font-mono-num text-sm w-20 shrink-0 text-right">
        {price != null ? fmt(price) : '—'}
      </span>

      {/* Tiny sparkline */}
      <div style={{ width: 64, height: 24 }} className="shrink-0">
        {bars.length > 0 ? (
            <AreaChart width={64} height={24} data={bars.map((b, i) => ({ i, c: b.c }))}>
              <defs>
                <linearGradient id={`spark-${sym}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color ?? 'hsl(var(--muted-foreground))'} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color ?? 'hsl(var(--muted-foreground))'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="c"
                stroke={color ?? 'hsl(var(--muted-foreground))'}
                strokeWidth={1.5}
                fill={`url(#spark-${sym})`}
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
        ) : null}
      </div>

      {/* Window change */}
      <span
        className={`font-mono-num text-xs flex-1 text-right tabular-nums ${
          ch == null ? 'text-muted-foreground' : ch.abs >= 0 ? 'text-trading-buy' : 'text-trading-sell'
        }`}
      >
        {ch == null
          ? '—'
          : `${ch.abs >= 0 ? '+' : '-'}${fmt(Math.abs(ch.abs))} (${ch.pct >= 0 ? '+' : ''}${ch.pct.toFixed(2)}%)`}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          title="Send to order ticket"
          onClick={(e) => { e.stopPropagation(); onSendToTicket(sym); }}
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-trading-sell"
          title="Remove from watchlist"
          onClick={(e) => { e.stopPropagation(); onRemove(sym); }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function Watchlist(props: WatchlistProps) {
  const { selSymbol, onSelect, onSendToTicket, showGatewayNote } = props;
  const { symbols, add, remove } = useWatchlist();

  const { fast, setFast, intervalMs } = useLiveSpeed();

  // `symbols` from useSyncExternalStore is already stable across renders.
  const quotes = useLiveQuotes(symbols, intervalMs);

  // ── Ticker autocomplete ───────────────────────────────────────────────────
  const [symQuery, setSymQuery] = useState('');
  const [showSym, setShowSym] = useState(false);
  const symBoxRef = useRef<HTMLDivElement>(null);
  const { data: symResults = [] } = useSymbolSearch(symQuery);

  useEffect(() => {
    if (!showSym) return;
    const onDoc = (e: MouseEvent) => {
      if (symBoxRef.current && !symBoxRef.current.contains(e.target as Node)) {
        setShowSym(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showSym]);

  const pickSymbol = (ticker: string) => {
    add(ticker);
    setSymQuery('');
    setShowSym(false);
  };

  const [noteVisible, setNoteVisible] = useState(true);

  return (
    <Card className="trading-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          Watchlist
          {symbols.length > 0 && (
            <button
              type="button"
              onClick={() => setFast(!fast)}
              title="Live price refresh rate"
              aria-pressed={fast}
              aria-label={`Live price refresh rate: ${fast ? '5 seconds' : '30 seconds'}`}
              className="ml-auto rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] font-mono-num text-muted-foreground hover:text-foreground transition-colors"
            >
              <span aria-hidden="true">⚡</span> {fast ? '5s' : '30s'}
            </button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Add row — symbol autocomplete */}
        <div className="relative" ref={symBoxRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10" />
          <Input
            placeholder="Add a ticker or company…"
            value={symQuery}
            onChange={(e) => {
              setSymQuery(e.target.value.toUpperCase());
              setShowSym(true);
            }}
            onFocus={() => { if (symQuery) setShowSym(true); }}
            className="pl-9 font-mono text-sm h-10"
            autoComplete="off"
          />
          {showSym && symResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
              {symResults.map((r) => (
                <button
                  key={r.symbolId}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); pickSymbol(r.canonicalTicker); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors"
                >
                  <span className="font-mono text-sm font-semibold">{r.canonicalTicker}</span>
                  <span className="truncate text-xs text-muted-foreground">{r.name}</span>
                  {r.primaryExchangeCode && (
                    <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {r.primaryExchangeCode}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {symbols.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 py-10 text-center">
            <Eye className="h-7 w-7 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Add symbols to build your watchlist.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {symbols.map((sym) => (
              <WatchRow
                key={sym}
                sym={sym}
                selected={sym === selSymbol}
                quote={quotes[sym.trim().toUpperCase()]}
                onSelect={onSelect}
                onSendToTicket={onSendToTicket}
                onRemove={remove}
              />
            ))}
          </div>
        )}

        {showGatewayNote && noteVisible && (
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="flex-1">Connect an IBKR gateway for live order execution.</span>
            <button
              type="button"
              onClick={() => setNoteVisible(false)}
              aria-label="Dismiss note"
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
