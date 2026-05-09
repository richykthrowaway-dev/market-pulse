/**
 * TickerStyleEditor — popover for editing per-ticker position annotations.
 *
 * Features:
 *   • Trade style (Swing / Day Trade / Long Term Hold)
 *   • Price target + stop loss with live % preview
 *   • Risk/Reward ratio badge (auto-computed)
 *   • Dollar risk / dollar reward (based on shares held)
 *   • Entry date + holding-period counter
 *   • Reasoning / notes (500 chars)
 *   • Live price + 1D/1W/1M/3M performance in the header
 *
 * All data persists in localStorage (`ticker-styles-v1`) — survives
 * portfolio re-imports, no authentication required.
 */
import React, { useState, useEffect } from 'react';
import { Pencil, Trash2, Check, X, Loader2, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  useUpsertTickerStyle,
  useDeleteTickerStyle,
  type TradeStyle,
} from '@/hooks/useTickerStyles';
import { useTickerPerformance } from '@/hooks/useTickerPerformance';

const TRADE_STYLES: TradeStyle[] = ['Swing', 'Day Trade', 'Long Term Hold'];

const STYLE_BADGE_COLOR: Record<string, string> = {
  'Swing':           'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  'Day Trade':       'bg-orange-500/15 text-orange-300 border-orange-500/40',
  'Long Term Hold':  'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  'Unclassified':    'bg-muted/40 text-muted-foreground border-border',
};

/** Days between an ISO date string and today */
function holdingDays(entryDate: string): number {
  const entry = new Date(entryDate);
  const now   = new Date();
  return Math.max(0, Math.floor((now.getTime() - entry.getTime()) / 86_400_000));
}

interface Props {
  ticker:        string;
  /** IBKR exchange code — used to build the Yahoo Finance symbol for live perf. */
  exchange?:     string;
  current?:      TradeStyle | 'Unclassified';
  note?:         string;
  priceTarget?:  number | null;
  stopLoss?:     number | null;
  entryDate?:    string | null;
  /** Number of shares held — drives dollar risk/reward calculation. */
  shares?:       number;
  /** Current per-share price (marketValue / shares) from the portfolio. */
  currentPrice?: number;
}

export function TickerStyleEditor({
  ticker,
  exchange,
  current      = 'Unclassified',
  note         = '',
  priceTarget  = null,
  stopLoss     = null,
  entryDate    = null,
  shares,
  currentPrice,
}: Props) {
  const [open, setOpen]               = useState(false);
  const [draftStyle, setDraftStyle]   = useState<TradeStyle | ''>(
    current && current !== 'Unclassified' ? current : ''
  );
  const [draftNote,   setDraftNote]   = useState(note);
  const [draftTarget, setDraftTarget] = useState<string>(priceTarget == null ? '' : String(priceTarget));
  const [draftStop,   setDraftStop]   = useState<string>(stopLoss    == null ? '' : String(stopLoss));
  const [draftEntry,  setDraftEntry]  = useState<string>(entryDate   ?? '');

  const upsert = useUpsertTickerStyle();
  const remove = useDeleteTickerStyle();

  // Live price + performance — fetched on first open, cached 5 min
  const { data: perf, isLoading: perfLoading } = useTickerPerformance(ticker, exchange, open);

  // Reset drafts whenever the popover opens (different ticker or updated props)
  useEffect(() => {
    if (open) {
      setDraftStyle(current && current !== 'Unclassified' ? current : '');
      setDraftNote(note);
      setDraftTarget(priceTarget == null ? '' : String(priceTarget));
      setDraftStop(stopLoss    == null ? '' : String(stopLoss));
      setDraftEntry(entryDate  ?? '');
    }
  }, [open, ticker, current, note, priceTarget, stopLoss, entryDate]);

  const isAnnotated = !!(current && current !== 'Unclassified')
    || !!note || priceTarget != null || stopLoss != null || entryDate != null;

  // ── Derived numbers ────────────────────────────────────────────────────────
  const price      = perf?.price ?? currentPrice ?? null;
  const targetNum  = Number(draftTarget);
  const stopNum    = Number(draftStop);
  const hasTarget  = draftTarget.trim() !== '' && Number.isFinite(targetNum) && targetNum > 0;
  const hasStop    = draftStop.trim()   !== '' && Number.isFinite(stopNum)   && stopNum   > 0;

  // % distance from current price
  const targetPct = price && hasTarget ? ((targetNum - price) / price) * 100 : null;
  const stopPct   = price && hasStop   ? ((stopNum   - price) / price) * 100 : null;

  // Risk / Reward ratio — (target - price) / (price - stop)
  // Only meaningful when price is between stop and target
  const reward    = price && hasTarget ? targetNum - price : null;
  const risk      = price && hasStop   ? price - stopNum   : null;
  const rrRatio   = reward != null && risk != null && risk > 0 ? reward / risk : null;

  // Dollar risk / reward based on shares held
  const dollarReward = reward != null && shares ? reward * shares : null;
  const dollarRisk   = risk   != null && shares ? risk   * shares : null;

  // Holding period
  const holdDays = draftEntry ? holdingDays(draftEntry) : null;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const targetVal = hasTarget ? targetNum : null;
    const stopVal   = hasStop   ? stopNum   : null;
    try {
      await upsert.mutateAsync({
        ticker,
        tradeStyle:  draftStyle || null,
        note:        draftNote,
        priceTarget: targetVal,
        stopLoss:    stopVal,
        entryDate:   draftEntry.trim() || null,
      });
      setOpen(false);
    } catch { /* shown via upsert.error */ }
  };

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(ticker);
      setOpen(false);
    } catch { /* shown via remove.error */ }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Edit trade style for ${ticker}`}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px]',
            'transition-colors hover:brightness-125',
            STYLE_BADGE_COLOR[current ?? 'Unclassified'] || STYLE_BADGE_COLOR.Unclassified,
          )}
        >
          <span className="font-medium uppercase tracking-wider">{current}</span>
          <Pencil className="h-2.5 w-2.5 opacity-60" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 p-3 space-y-2.5 bg-card border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Position Tracker</p>

            {/* Ticker + live price */}
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="font-mono font-semibold text-sm">{ticker}</p>
              {perfLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              {!perfLoading && price != null && (
                <span className="font-mono text-xs text-foreground/80">
                  ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
              {/* Holding period pill */}
              {holdDays != null && (
                <span className={cn(
                  'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] border font-mono',
                  holdDays > 90
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-muted/40 text-muted-foreground border-border/50',
                )}>
                  <Calendar className="h-2.5 w-2.5" />
                  Day {holdDays}
                </span>
              )}
            </div>

            {/* 1D / 1W / 1M / 3M change badges */}
            {!perfLoading && perf && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {([
                  { label: '1D', value: perf.d1 },
                  { label: '1W', value: perf.w1 },
                  { label: '1M', value: perf.m1 },
                  { label: '3M', value: perf.m3 },
                ] as const).map(({ label, value }) => (
                  <span
                    key={label}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono border',
                      value == null
                        ? 'bg-muted/30 text-muted-foreground border-border/50'
                        : value >= 0
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30',
                    )}
                  >
                    <span className="text-muted-foreground">{label}</span>
                    {value == null ? ' —' : ` ${value >= 0 ? '+' : ''}${value.toFixed(2)}%`}
                  </span>
                ))}
              </div>
            )}
          </div>

          {isAnnotated && (
            <button
              onClick={handleDelete}
              disabled={remove.isPending}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] shrink-0',
                'bg-destructive/10 text-destructive border border-destructive/30',
                'hover:bg-destructive/20 transition-colors',
                remove.isPending && 'opacity-50 cursor-wait',
              )}
              aria-label="Delete all annotations for this ticker"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          )}
        </div>

        {/* ── Trade style chips ────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-1">
          {TRADE_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setDraftStyle(prev => prev === s ? '' : s)}
              className={cn(
                'text-[10px] px-2 py-1.5 rounded border transition-colors',
                'flex items-center justify-center font-medium',
                draftStyle === s
                  ? STYLE_BADGE_COLOR[s] + ' ring-1 ring-current'
                  : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* ── Price target + stop loss ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Price Target
            </label>
            <input
              type="number" step="0.01" min="0" inputMode="decimal"
              value={draftTarget}
              onChange={(e) => setDraftTarget(e.target.value)}
              placeholder="—"
              className={cn(
                'w-full text-xs px-2 py-1 rounded border bg-background border-border font-mono',
                'focus:outline-none focus:ring-1 focus:ring-emerald-500/40',
              )}
            />
            {targetPct !== null && (
              <p className={cn('text-[9px] mt-0.5 font-mono', targetPct >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {targetPct >= 0 ? '+' : ''}{targetPct.toFixed(1)}% from current
              </p>
            )}
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Stop Loss
            </label>
            <input
              type="number" step="0.01" min="0" inputMode="decimal"
              value={draftStop}
              onChange={(e) => setDraftStop(e.target.value)}
              placeholder="—"
              className={cn(
                'w-full text-xs px-2 py-1 rounded border bg-background border-border font-mono',
                'focus:outline-none focus:ring-1 focus:ring-rose-500/40',
              )}
            />
            {stopPct !== null && (
              <p className={cn('text-[9px] mt-0.5 font-mono', stopPct >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {stopPct >= 0 ? '+' : ''}{stopPct.toFixed(1)}% from current
              </p>
            )}
          </div>
        </div>

        {/* ── Feature 1: Risk/Reward + Feature 3: Dollar Risk/Reward ─────── */}
        {(rrRatio !== null || dollarReward !== null || dollarRisk !== null) && (
          <div className={cn(
            'rounded border px-2.5 py-2 space-y-1.5',
            rrRatio != null && rrRatio >= 2
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : rrRatio != null && rrRatio >= 1
                ? 'bg-amber-500/5 border-amber-500/20'
                : 'bg-rose-500/5 border-rose-500/20',
          )}>
            {/* R:R ratio row */}
            {rrRatio !== null && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Risk / Reward
                </span>
                <span className={cn(
                  'font-mono text-xs font-semibold',
                  rrRatio >= 2 ? 'text-emerald-400' : rrRatio >= 1 ? 'text-amber-400' : 'text-rose-400',
                )}>
                  {rrRatio.toFixed(2)}:1
                </span>
              </div>
            )}

            {/* Dollar risk / reward row */}
            {(dollarReward !== null || dollarRisk !== null) && (
              <div className="flex items-center gap-3">
                {dollarReward !== null && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                    <TrendingUp className="h-3 w-3" />
                    +${dollarReward.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                )}
                {dollarRisk !== null && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-rose-400">
                    <TrendingDown className="h-3 w-3" />
                    −${dollarRisk.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Feature 2: Entry date ────────────────────────────────────────── */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Entry Date
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={draftEntry}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDraftEntry(e.target.value)}
              className={cn(
                'flex-1 text-xs px-2 py-1 rounded border bg-background border-border font-mono',
                'focus:outline-none focus:ring-1 focus:ring-primary/40',
                '[color-scheme:dark]',
              )}
            />
            {holdDays != null && (
              <span className={cn(
                'text-[10px] font-mono shrink-0',
                holdDays > 90  ? 'text-amber-400' :
                holdDays > 30  ? 'text-cyan-400'  : 'text-muted-foreground',
              )}>
                {holdDays === 0 ? 'Today' : holdDays === 1 ? '1 day' : `${holdDays} days`}
              </span>
            )}
          </div>
          {/* Flag when trade style and holding period are mismatched */}
          {draftStyle === 'Day Trade' && holdDays != null && holdDays > 2 && (
            <p className="text-[9px] text-amber-400 mt-0.5">
              ⚠ Held {holdDays} days — consider updating trade style
            </p>
          )}
          {draftStyle === 'Swing' && holdDays != null && holdDays > 60 && (
            <p className="text-[9px] text-amber-400 mt-0.5">
              ⚠ Held {holdDays} days — consider updating to Long Term Hold
            </p>
          )}
        </div>

        {/* ── Notes ────────────────────────────────────────────────────────── */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Reasoning / Notes
          </label>
          <textarea
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            placeholder="Why this trade? Entry thesis, target, stop, etc."
            rows={3}
            className={cn(
              'w-full text-xs p-2 rounded border bg-background border-border',
              'focus:outline-none focus:ring-1 focus:ring-primary/40',
              'resize-none font-mono',
            )}
            maxLength={500}
          />
          <p className="text-[9px] text-muted-foreground text-right mt-0.5">
            {draftNote.length}/500
          </p>
        </div>

        {/* ── Error feedback ────────────────────────────────────────────────── */}
        {(upsert.error || remove.error) && (
          <p className="text-[10px] text-destructive bg-destructive/10 border border-destructive/30 rounded px-2 py-1">
            {(upsert.error as Error | null)?.message
              ?? (remove.error as Error | null)?.message
              ?? 'Save failed — please try again.'}
          </p>
        )}

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/50">
          <button
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={upsert.isPending}
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px]',
              'bg-primary/15 text-primary border border-primary/40',
              'hover:bg-primary/25 transition-colors',
              upsert.isPending && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Check className="h-3 w-3" /> {upsert.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
