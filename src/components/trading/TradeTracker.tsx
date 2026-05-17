import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ClipboardList, Plus, X, ArrowRight, CheckCircle2, AlertTriangle, Search, Loader2, Zap,
} from 'lucide-react';
import { useTradeJournal, type TradeSide, type ExitReason } from '@/hooks/useTradeJournal';
import { useOpenTrades, type OpenTrade } from '@/hooks/useOpenTrades';
import { useLiveSpeed } from '@/hooks/useLiveSpeed';
import { useSymbolSearch } from '@/hooks/useSymbolSearch';
import { useJournalSettings } from '@/hooks/useJournalSettings';
import { fetchYahooQuote } from '@/services/yahooFinanceApi';
import { useLiveQuotes } from '@/hooks/useLiveQuotes';
import { unrealizedPnl, stopProximity } from '@/lib/tradeMetrics';

// Setup names saved in the My-Trading-Plan playbook (tp-playbook-v1). Read-only,
// best-effort — the Setup combobox merges these with the Journal's saved setups
// so the user never re-types a setup they've already defined anywhere.
function readPlaybookNames(): string[] {
  try {
    const raw = localStorage.getItem('tp-playbook-v1');
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((p: any) => String(p?.name ?? '').trim()).filter(Boolean);
  } catch { return []; }
}

/**
 * TradeTracker — live open-position tracker, native to the Trading page.
 *
 * Redesigned to the Trading page's own design language (shadcn `trading-card`,
 * segmented Long/Short toggle, `font-mono-num`, live deal preview) so it feels
 * like a sibling of Quick Order rather than a transplanted widget.
 *
 * Data is unchanged: open positions live in the shared `useOpenTrades` store;
 * closing a trade writes once into `useTradeJournal` — it appears in the
 * Journal automatically. Broker-independent (no IBKR gateway required).
 */

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function emptyDraft(): OpenTrade {
  return {
    id: Math.random().toString(36).slice(2, 9),
    symbol: '', side: 'long', quantity: 0, entryPrice: 0,
    entryDate: todayISO(), planValid: true,
  };
}

const EXIT_REASONS: ExitReason[] = ['target', 'stop', 'time', 'discretion', 'panic'];

function daysHeld(entryDate: string): number {
  const d = new Date(entryDate + 'T00:00:00');
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86_400_000));
}

// Read the user's saved Risk Parameters (set in My Trading Plan) so the deal
// preview can show account-relative risk. Read-only; gracefully optional.
function readRiskParams(): { account: number; riskPct: number } | null {
  try {
    const r = localStorage.getItem('tp-risk-v1');
    if (!r) return null;
    const p = JSON.parse(r);
    if (typeof p?.account === 'number' && typeof p?.riskPct === 'number') {
      return { account: p.account, riskPct: p.riskPct };
    }
    return null;
  } catch { return null; }
}

const money = (n: number) =>
  '$' + n.toLocaleString('en-US', { maximumFractionDigits: n >= 1000 ? 0 : 2 });

export function TradeTracker() {
  const { addTrade } = useTradeJournal();
  const { trades: open, addOpen, removeOpen, patchOpen } = useOpenTrades();

  const [draft, setDraft] = useState<OpenTrade>(emptyDraft());
  const [closingId, setClosingId] = useState<string | null>(null);
  const [exitPrice, setExitPrice] = useState('');
  const [exitDate, setExitDate] = useState(todayISO());
  const [exitReason, setExitReason] = useState<ExitReason>('target');
  const [fees, setFees] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  const { fast, setFast, intervalMs } = useLiveSpeed();
  const openSymbols = useMemo(() => open.map((t) => t.symbol), [open]);
  const quotes = useLiveQuotes(openSymbols, intervalMs);

  // ── Ticker autocomplete + live-price infill ───────────────────────────────
  const { settings, addSetup } = useJournalSettings();
  const [symQuery, setSymQuery] = useState('');
  const [showSym, setShowSym] = useState(false);
  const [live, setLive] = useState<{ price: number | null; name: string | null } | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const symBoxRef = useRef<HTMLDivElement>(null);
  const { data: symResults = [] } = useSymbolSearch(symQuery);

  // Close the suggestion dropdown on any outside click.
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

  // Combined, de-duplicated setup options: Journal's saved setups first, then
  // any playbook setups defined in My Trading Plan.
  const setupOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of [...settings.setups, ...readPlaybookNames()]) {
      const key = s.toLowerCase();
      if (s && !seen.has(key)) { seen.add(key); out.push(s); }
    }
    return out;
  }, [settings.setups]);

  const set = <K extends keyof OpenTrade>(k: K, v: OpenTrade[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  // Pick a ticker from the dropdown: set the symbol, then fetch a live quote and
  // infill Entry (only if the user hasn't already typed one) + show the name.
  const pickSymbol = useCallback(async (ticker: string, name: string) => {
    const sym = ticker.trim().toUpperCase();
    setDraft((d) => ({ ...d, symbol: sym }));
    setSymQuery('');
    setShowSym(false);
    setLive({ price: null, name });
    setLiveLoading(true);
    try {
      const q = await fetchYahooQuote(sym);
      const price = q?.regularMarketPrice ?? null;
      setLive({ price, name: q?.shortName ?? q?.longName ?? name });
      if (price != null) {
        setDraft((d) => (d.symbol === sym && !d.entryPrice ? { ...d, entryPrice: price } : d));
      }
    } catch {
      setLive({ price: null, name });
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const isLong = draft.side === 'long';
  const canAdd = draft.symbol.trim() !== '' && draft.quantity > 0 && draft.entryPrice > 0;

  // ── Live deal preview — recomputes as the user types ──────────────────────
  const preview = useMemo(() => {
    const { entryPrice: e, stopLoss: s, target: t, quantity: q, side } = draft;
    const riskPS = s != null && e > 0 ? Math.abs(e - s) : null;
    const rewardPS = t != null && e > 0 ? Math.abs(t - e) : null;
    const rr = riskPS && rewardPS && riskPS > 0 ? rewardPS / riskPS : null;
    const dollarRisk = riskPS != null && q > 0 ? riskPS * q : null;
    const posValue = e > 0 && q > 0 ? e * q : null;
    const rp = readRiskParams();
    const acctRiskPct = dollarRisk != null && rp ? (dollarRisk / rp.account) * 100 : null;
    const overRisk = acctRiskPct != null && rp ? acctRiskPct > rp.riskPct : false;

    // Non-blocking sanity hints
    const hints: string[] = [];
    if (s != null && e > 0) {
      if (side === 'long' && s >= e) hints.push('Stop is at/above entry for a long.');
      if (side === 'short' && s <= e) hints.push('Stop is at/below entry for a short.');
    }
    if (t != null && e > 0) {
      if (side === 'long' && t <= e) hints.push('Target is at/below entry for a long.');
      if (side === 'short' && t >= e) hints.push('Target is at/above entry for a short.');
    }
    if (rr != null && rr < 1.5) hints.push(`R:R is only ${rr.toFixed(1)}:1 — below most plan minimums.`);
    return { rr, dollarRisk, posValue, acctRiskPct, overRisk, hints, hasRp: !!rp };
  }, [draft]);

  const submit = useCallback(() => {
    if (!canAdd) return;
    addOpen({ ...draft, symbol: draft.symbol.trim().toUpperCase() });
    setDraft(emptyDraft());
    setLive(null);
    setSymQuery('');
    if (draft.setup?.trim()) addSetup(draft.setup.trim());
    toast.success('Trade tracked');
  }, [draft, canAdd, addOpen, addSetup]);

  function beginClose(t: OpenTrade) {
    setClosingId(t.id);
    setExitPrice(String(t.target ?? t.entryPrice));
    setExitDate(todayISO());
    setExitReason('target');
    setFees('');
    setCloseNotes('');
  }

  function confirmClose(t: OpenTrade) {
    addTrade({
      symbol: t.symbol, side: t.side, quantity: t.quantity,
      entryPrice: t.entryPrice, exitPrice: Number(exitPrice) || 0,
      entryDate: t.entryDate, exitDate, fees: Number(fees) || 0,
      notes: [t.notes, closeNotes].filter(Boolean).join(' · '),
      tags: [], stopLoss: t.stopLoss, target: t.target, setup: t.setup,
      exitReason, inPlaybook: !!t.setup,
    });
    removeOpen(t.id);
    setClosingId(null);
    toast.success(`${t.symbol} closed — filed to your Journal`);
  }

  const fieldCls = 'h-9 font-mono-num text-sm';
  const lblCls = 'text-[11px] font-medium text-muted-foreground';

  return (
    <Card className="trading-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          Trade Tracker
          <span className="ml-2 text-[11px] font-normal text-muted-foreground">
            live positions · closing files straight to your Journal
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ─────────── LEFT: New trade entry ─────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New trade</p>

            {/* Symbol — autocomplete + live-price infill */}
            <div className="relative" ref={symBoxRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10" />
              <Input
                placeholder="Search ticker or company…"
                value={draft.symbol}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase();
                  set('symbol', v);
                  setSymQuery(v);
                  setShowSym(true);
                  setLive(null);
                }}
                onFocus={() => { if (draft.symbol) { setSymQuery(draft.symbol); setShowSym(true); } }}
                onKeyDown={(e) => { if (e.key === 'Enter') { setShowSym(false); submit(); } }}
                className="pl-9 font-mono text-sm h-10"
                autoComplete="off"
              />
              {(liveLoading || (live && (live.price != null || live.name))) && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[11px]">
                  {liveLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Zap className="h-3 w-3 text-primary" />
                      {live?.price != null && (
                        <span className="font-mono-num text-foreground">{money(live.price)}</span>
                      )}
                    </span>
                  )}
                </div>
              )}

              {showSym && symResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                  {symResults.map((r) => (
                    <button
                      key={r.symbolId}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); pickSymbol(r.canonicalTicker, r.name); }}
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

            {live?.name && !liveLoading && (
              <p className="-mt-1 text-[11px] text-muted-foreground">
                <Zap className="inline h-3 w-3 text-primary mr-0.5 -mt-0.5" />
                {live.name}
                {live.price != null && <> · live {money(live.price)}</>}
              </p>
            )}

            {/* Long / Short segmented toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => set('side', 'long')}
                className={`rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
                  isLong ? 'btn-buy' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Long
              </button>
              <button
                type="button"
                onClick={() => set('side', 'short')}
                className={`rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
                  !isLong ? 'btn-sell' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Short
              </button>
            </div>

            {/* Plan numbers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={lblCls}>Quantity</label>
                <Input type="number" min={0} className={fieldCls}
                  value={draft.quantity || ''}
                  onChange={(e) => set('quantity', Number(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <label className={lblCls}>Entry</label>
                <Input type="number" min={0} step={0.01} className={fieldCls}
                  value={draft.entryPrice || ''}
                  onChange={(e) => set('entryPrice', Number(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <label className={lblCls}>Stop</label>
                <Input type="number" min={0} step={0.01} className={fieldCls}
                  value={draft.stopLoss ?? ''}
                  onChange={(e) => set('stopLoss', e.target.value === '' ? undefined : Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <label className={lblCls}>Target</label>
                <Input type="number" min={0} step={0.01} className={fieldCls}
                  value={draft.target ?? ''}
                  onChange={(e) => set('target', e.target.value === '' ? undefined : Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <label className={lblCls}>Setup</label>
                <Input
                  list="tt-setup-options"
                  className={`${fieldCls} font-sans`}
                  placeholder="VCP / pullback…"
                  value={draft.setup ?? ''}
                  onChange={(e) => set('setup', e.target.value)}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v) addSetup(v); }}
                />
                <datalist id="tt-setup-options">
                  {setupOptions.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div className="space-y-1">
                <label className={lblCls}>Entry date</label>
                <Input type="date" className={fieldCls}
                  value={draft.entryDate}
                  onChange={(e) => set('entryDate', e.target.value)} />
              </div>
            </div>

            {/* Live deal preview */}
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Risk : Reward</span>
                <span className={`font-mono-num font-semibold ${
                  preview.rr == null ? '' : preview.rr >= 2 ? 'text-trading-buy' : preview.rr >= 1.5 ? 'text-warning' : 'text-trading-sell'
                }`}>{preview.rr != null ? `${preview.rr.toFixed(2)} : 1` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">$ at risk (1R)</span>
                <span className={`font-mono-num ${preview.overRisk ? 'text-trading-sell font-semibold' : ''}`}>
                  {preview.dollarRisk != null ? money(preview.dollarRisk) : '—'}
                  {preview.acctRiskPct != null && (
                    <span className="text-muted-foreground"> · {preview.acctRiskPct.toFixed(2)}%</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Position value</span>
                <span className="font-mono-num">{preview.posValue != null ? money(preview.posValue) : '—'}</span>
              </div>
              {preview.overRisk && (
                <div className="flex items-center gap-1.5 text-trading-sell pt-0.5">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>Exceeds your saved max risk %.</span>
                </div>
              )}
              {preview.hints.map((h, i) => (
                <div key={i} className="flex items-center gap-1.5 text-warning pt-0.5">
                  <AlertTriangle className="h-3 w-3 shrink-0" /><span>{h}</span>
                </div>
              ))}
            </div>

            <Button
              onClick={submit}
              disabled={!canAdd}
              className={`w-full font-semibold ${isLong ? 'btn-buy' : 'btn-sell'}`}
            >
              <Plus className="h-4 w-4 mr-1" />
              Track {isLong ? 'Long' : 'Short'} {draft.symbol || 'trade'}
            </Button>
          </div>

          {/* ─────────── RIGHT: Open positions ─────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Open positions
              </p>
              <div className="flex items-center gap-2">
                {open.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFast(!fast)}
                    title="Live price refresh rate"
                    aria-pressed={fast}
                    aria-label={`Live price refresh rate: ${fast ? '5 seconds' : '30 seconds'}`}
                    className="rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] font-mono-num text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span aria-hidden="true">⚡</span> {fast ? '5s' : '30s'}
                  </button>
                )}
                {open.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">{open.length} tracked</span>
                )}
              </div>
            </div>

            {open.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 py-10 text-center">
                <ClipboardList className="h-7 w-7 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No open trades tracked.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Fill the form to start tracking a live position.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                {open.map((t) => {
                  const risk = t.stopLoss != null ? Math.abs(t.entryPrice - t.stopLoss) : null;
                  const reward = t.target != null ? Math.abs(t.target - t.entryPrice) : null;
                  const rr = risk && reward && risk > 0 ? reward / risk : null;
                  const long = t.side === 'long';
                  const closing = closingId === t.id;
                  const q = quotes[t.symbol.trim().toUpperCase()];
                  const livePrice = q?.price ?? null;
                  const pnl = livePrice != null ? unrealizedPnl(t.side, t.entryPrice, livePrice, t.quantity) : null;
                  const stopState = livePrice != null ? stopProximity(t.side, t.entryPrice, t.stopLoss, livePrice) : 'ok';
                  const gapPct = (to?: number) =>
                    livePrice != null && to != null && livePrice > 0
                      ? ((to - livePrice) / livePrice) * 100
                      : null;
                  return (
                    <div key={t.id}
                      className={`rounded-lg border bg-card/60 p-3 transition-colors ${
                        long ? 'border-l-2 border-l-trading-buy' : 'border-l-2 border-l-trading-sell'
                      }`}>
                      {/* Header row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{t.symbol}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                          long ? 'bg-trading-buy/15 text-trading-buy' : 'bg-trading-sell/15 text-trading-sell'
                        }`}>{t.side}</span>
                        {rr != null && (
                          <span className="text-[11px] text-muted-foreground font-mono-num">
                            R:R <b className="text-foreground">{rr.toFixed(1)}:1</b>
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground ml-auto">{daysHeld(t.entryDate)}d held</span>
                      </div>

                      {/* Numbers */}
                      <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                        {[['Qty', t.quantity], ['Entry', `$${t.entryPrice}`],
                          ['Stop', t.stopLoss != null ? `$${t.stopLoss}` : '—'],
                          ['Target', t.target != null ? `$${t.target}` : '—']].map(([k, v]) => (
                          <div key={k as string}>
                            <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">{k}</div>
                            <div className="font-mono-num font-medium">{v}</div>
                          </div>
                        ))}
                      </div>

                      {/* Live row */}
                      <div className="mt-2 rounded-md bg-muted/30 px-2.5 py-2 text-xs">
                        {livePrice == null ? (
                          <span className="text-muted-foreground/60">waiting for price…</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="font-mono-num">
                              <span className="text-muted-foreground/70">Last </span>
                              {money(livePrice)}
                            </span>
                            {pnl && (
                              <span className={`font-mono-num font-semibold ${
                                pnl.dollars >= 0 ? 'text-trading-buy' : 'text-trading-sell'
                              }`}>
                                {pnl.dollars >= 0 ? '+' : ''}{money(pnl.dollars)} ({pnl.pct >= 0 ? '+' : ''}{pnl.pct.toFixed(2)}%)
                              </span>
                            )}
                            {t.stopLoss != null && (
                              <span className={`font-mono-num ${
                                stopState === 'breached' ? 'text-trading-sell font-semibold'
                                  : stopState === 'near' ? 'text-warning' : 'text-muted-foreground'
                              }`}>
                                {stopState === 'breached' ? 'stop hit' : `${Math.abs(gapPct(t.stopLoss) ?? 0).toFixed(1)}% to stop`}
                              </span>
                            )}
                            {t.target != null && (() => {
                              const reached = t.side === 'long' ? livePrice >= t.target : livePrice <= t.target;
                              return (
                                <span className={`font-mono-num ${reached ? 'text-trading-buy font-semibold' : 'text-muted-foreground'}`}>
                                  {reached ? 'target hit' : `${Math.abs(gapPct(t.target) ?? 0).toFixed(1)}% to target`}
                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Plan-valid toggle + actions */}
                      <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-border/50 flex-wrap">
                        <button
                          type="button"
                          onClick={() => patchOpen(t.id, { planValid: !t.planValid })}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          title="Toggle whether the original plan still holds"
                        >
                          <CheckCircle2 className={`h-3.5 w-3.5 ${t.planValid ? 'text-trading-buy' : 'text-muted-foreground/40'}`} />
                          {t.planValid ? 'Plan valid' : 'Plan in question'}
                        </button>
                        <div className="ml-auto flex items-center gap-1.5">
                          {closing ? (
                            <Button size="sm" variant="ghost" className="h-7 text-xs"
                              onClick={() => setClosingId(null)}>Cancel</Button>
                          ) : (
                            <>
                              <Button size="sm" className="h-7 text-xs" onClick={() => beginClose(t)}>
                                Close <ArrowRight className="h-3 w-3 ml-1" /> Journal
                              </Button>
                              <Button size="sm" variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-trading-sell"
                                title="Discard (no journal entry)"
                                onClick={() => removeOpen(t.id)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Inline close form */}
                      {closing && (
                        <div className="mt-3 pt-3 border-t border-border/50 space-y-2.5">
                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <label className={lblCls}>Exit price</label>
                              <Input type="number" step={0.01} className={fieldCls}
                                value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <label className={lblCls}>Exit date</label>
                              <Input type="date" className={fieldCls}
                                value={exitDate} onChange={(e) => setExitDate(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <label className={lblCls}>Exit reason</label>
                              <Select value={exitReason} onValueChange={(v) => setExitReason(v as ExitReason)}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {EXIT_REASONS.map((r) => (
                                    <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <label className={lblCls}>Fees</label>
                              <Input type="number" step={0.01} className={fieldCls}
                                value={fees} onChange={(e) => setFees(e.target.value)} />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className={lblCls}>Close notes (optional)</label>
                            <Input className={`${fieldCls} font-sans`} placeholder="What happened on the exit…"
                              value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
                          </div>
                          <Button size="sm" className="w-full font-semibold"
                            onClick={() => confirmClose(t)}>
                            Confirm close &amp; add to Journal
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
