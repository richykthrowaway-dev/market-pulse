/**
 * Per-ticker user annotations (trade style + freeform note / price targets).
 *
 * Stored in localStorage (`ticker-styles-v1`) — no authentication required.
 * The app doesn't have a login system so Supabase auth is unavailable;
 * localStorage gives the same "survives page refresh / re-import" guarantee
 * for a single-user portfolio tool.
 *
 * Data shape in storage:
 *   Record<UPPERCASE_TICKER, StoredStyle>
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type TradeStyle = 'Day Trade' | 'Swing Trade' | 'Long Term';

/**
 * Legacy → current label map. Existing localStorage entries from earlier
 * versions used the old names ('Swing', 'Long Term Hold'); these get
 * transparently rewritten on read so users don't see "Unclassified" for
 * positions they previously categorized.
 */
const LEGACY_LABELS: Record<string, TradeStyle> = {
  'Swing':          'Swing Trade',
  'Long Term Hold': 'Long Term',
};

export interface TickerStyle {
  ticker:      string;
  tradeStyle:  TradeStyle | null;
  note:        string | null;
  priceTarget: number | null;
  stopLoss:    number | null;
  /** ISO date string (YYYY-MM-DD) of when the position was opened. */
  entryDate:   string | null;
  updatedAt:   string;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'ticker-styles-v1';

function loadAll(): Record<string, TickerStyle> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, TickerStyle>;
    // Migrate legacy label values in-place so existing user data survives
    // the rename ('Swing' → 'Swing Trade', 'Long Term Hold' → 'Long Term').
    let mutated = false;
    for (const key of Object.keys(data)) {
      const entry = data[key];
      if (entry?.tradeStyle && LEGACY_LABELS[entry.tradeStyle as string]) {
        entry.tradeStyle = LEGACY_LABELS[entry.tradeStyle as string];
        mutated = true;
      }
    }
    if (mutated) saveAll(data); // persist the migration so it only runs once
    return data;
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, TickerStyle>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('ticker-styles: localStorage write failed', e);
  }
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Read all ticker styles. Returns Record<ticker, TickerStyle>.
 * Backed by localStorage — instant, no network call.
 */
export function useTickerStyles() {
  return useQuery<Record<string, TickerStyle>>({
    queryKey:  ['user-ticker-styles'],
    queryFn:   () => loadAll(),
    staleTime: Infinity,          // localStorage never goes stale on its own
    refetchOnWindowFocus: false,
  });
}

/**
 * Upsert a ticker's annotation (style, note, price target, stop loss).
 * All fields except ticker are optional — save a note without a style, etc.
 */
export function useUpsertTickerStyle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      ticker:       string;
      tradeStyle?:  TradeStyle | null;
      note?:        string;
      priceTarget?: number | null;
      stopLoss?:    number | null;
      entryDate?:   string | null;
    }) => {
      const ticker  = params.ticker.toUpperCase();
      const all     = loadAll();
      const existing = all[ticker];

      all[ticker] = {
        ticker,
        tradeStyle:  params.tradeStyle  !== undefined ? (params.tradeStyle  ?? null) : (existing?.tradeStyle  ?? null),
        note:        params.note        !== undefined ? (params.note        ?? null) : (existing?.note        ?? null),
        priceTarget: params.priceTarget !== undefined ? (params.priceTarget ?? null) : (existing?.priceTarget ?? null),
        stopLoss:    params.stopLoss    !== undefined ? (params.stopLoss    ?? null) : (existing?.stopLoss    ?? null),
        entryDate:   params.entryDate   !== undefined ? (params.entryDate   ?? null) : (existing?.entryDate   ?? null),
        updatedAt:   new Date().toISOString(),
      };

      saveAll(all);
      return { ticker };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-ticker-styles'] });
    },
  });
}

/**
 * Delete a ticker's annotation entirely (reverts to "Unclassified").
 */
export function useDeleteTickerStyle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticker: string) => {
      const key = ticker.toUpperCase();
      const all = loadAll();
      delete all[key];
      saveAll(all);
      return { ticker: key };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-ticker-styles'] });
    },
  });
}
