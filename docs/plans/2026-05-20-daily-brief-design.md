# Daily Market Brief — Design Document

**Date:** 2026-05-20
**Status:** Approved — ready for implementation

---

## Goal

Add a "Daily Brief" card to the top of the Dashboard that gives every user a single, AI-written pre-market summary of the previous trading day. Generated once at 6am ET via a scheduled Supabase edge function, cached in the database, and served to all users with zero per-user cost.

---

## Architecture Overview

```
pg_cron (6:00 AM ET, weekdays)
  → generate-daily-brief edge function
      → EODHD bulk data (breadth: advancing/declining/highs/lows)
      → api-yahoo edge function (8 major index quotes + VIX)
      → Finnhub api-news (top headlines for macro/current events)
      → SPDR ETF quotes via api-yahoo (11 sectors: XLK XLV XLF XLE XLI XLY XLP XLB XLRE XLU XLC)
      → Compute: sentiment score, regime, sector pct changes
      → Claude API (one call, structured JSON output)
      → Write row to daily_briefs table
  → Frontend: React Query fetches today's row on Dashboard mount
```

---

## What The Brief Contains

The brief surfaces data that does NOT already exist on the Dashboard:

| Section | Unique value |
|---|---|
| AI narrative summary (3–4 sentences) | No roll-up interpretation exists anywhere on the Dashboard |
| All 11 SPDR sector returns | Only on `/analysis` page — never on Dashboard |
| Fear & Greed + VIX side-by-side | VIX not shown on Dashboard; sentiment only in `/plan` |
| Current Events blurb | Macro/geopolitical context synthesised from headlines |
| Economic calendar for today | Not shown on Dashboard |
| Watch Today (1 sentence) | Forward-looking note — doesn't exist anywhere |
| Market regime label | Only in `/plan` — never on Dashboard |

The brief deliberately does NOT duplicate:
- Advancing/Declining counts (already in `MarketBreadthCards`)
- Index values grid (already in `MarketOverview`)
- Top gainer/loser tiles (already in `TopMoverCard`)
- Raw news headlines (already in `NewsCard`)
- Return histogram (already in `MarketOverviewCard`)

---

## Database Schema

```sql
create table daily_briefs (
  id              uuid primary key default gen_random_uuid(),
  date            date not null unique,
  headline        text not null,
  market_regime   text not null,       -- trending_up | range_bound | volatile | risk_off
  sentiment_score integer not null,    -- 0–100 composite (breadth formula)
  vix             numeric(6,2),
  summary         text not null,       -- AI 3–4 sentence narrative
  sectors         jsonb not null,      -- all 11 SPDRs [{ symbol, name, pct_change }]
  fear_greed      jsonb not null,      -- { score, label, vix, interpretation }
  current_events  text not null,       -- AI macro/geopolitical blurb
  calendar        jsonb not null,      -- [{ time, name, estimate, prior }]
  watch_today     text not null,       -- AI one-sentence forward-looking note
  generated_at    timestamptz default now(),
  model           text not null        -- e.g. "claude-3-5-haiku-20241022"
);

create index daily_briefs_date_idx on daily_briefs(date desc);

alter table daily_briefs enable row level security;
create policy "public read" on daily_briefs for select using (true);
```

**Key decisions:**
- `date unique` — DB-layer idempotency; even if pg_cron double-fires, only one row per day
- `model` column — tracks which Claude model generated each brief for future auditing
- All AI fields are `text not null` — edge function either succeeds fully or doesn't write
- `sectors` and `calendar` are `jsonb` — structured but flexible if fields change

---

## Sentiment Score Formula

Reuses the existing formula from the Trading Plan's Market Pulse widget (already proven, no new logic):

```
score = (50% × advancers_ratio) + (30% × new_highs / (new_highs + new_lows)) + (20% × median_norm)

where:
  advancers_ratio = advancing / (advancing + declining)        -- from EODHD breadth
  new_highs_ratio = new_highs / (new_highs + new_lows)        -- from EODHD breadth
  median_norm     = clamp((median_return + 3) / 6, 0, 1)      -- normalises -3% to +3% range
```

Labels: 0–25 Extreme Fear · 26–45 Fear · 46–55 Neutral · 56–74 Greed · 75–100 Extreme Greed

---

## Market Regime Classification

```
trending_up   → advancers_ratio > 0.60 AND median_return > 0
range_bound   → 0.45 ≤ advancers_ratio ≤ 0.55 AND abs(median_return) < 0.5
volatile      → abs(median_return) > 1.5 OR vix > 25
risk_off      → advancers_ratio < 0.40 OR median_return < -1
```

---

## Claude API Prompt Template

### System prompt (fixed, sent every day):
```
You are a professional market analyst writing a pre-market briefing for retail traders.
You will receive structured market data as JSON. Write the briefing by filling in the
output schema below — do not add or remove fields. Populate only the prose fields;
leave all numeric fields exactly as provided.

Tone: clear, direct, factual. No hype, no price predictions, no "should" language.
Max 4 sentences for summary. Max 3 sentences for current_events. Max 1 sentence for
watch_today. Max 1 sentence for fear_greed.interpretation.
```

### Output schema Claude fills (prose fields only):
```json
{
  "summary": "[3–4 sentence market narrative]",
  "fear_greed": {
    "score": 64,
    "label": "Greed",
    "vix": 14.2,
    "interpretation": "[1 sentence interpreting VIX + sentiment together]"
  },
  "current_events": "[2–3 sentence macro/geopolitical context from headlines]",
  "watch_today": "[1 sentence forward-looking note]"
}
```

Claude receives pre-computed values for all numeric fields; it only writes the four prose sections. This enforces consistency — the structure never changes, only the words.

---

## Edge Function: `generate-daily-brief`

### Trigger
- `pg_cron`: `0 10 * * 1-5` (10:00 UTC = 6:00 AM ET, weekdays only)
- Retry entry: `15 10 * * 1-5` (6:15 AM ET) — catches cases where EODHD data isn't ready at 6:00

### Steps

1. **Idempotency check** — query `daily_briefs` for today's date. If row exists, return 200 early.

2. **Parallel data fetch:**
   - EODHD `/eod-bulk-last-day/US` → breadth (advancing, declining, new_highs, new_lows, median_return)
   - `api-yahoo` edge function → 8 index quotes (^GSPC, ^IXIC, ^DJI, ^RUT, ^VIX, ^FTSE, ^N225, ^GDAXI)
   - `api-yahoo` edge function → 11 SPDR ETF quotes (XLK, XLV, XLF, XLE, XLI, XLY, XLP, XLB, XLRE, XLU, XLC)
   - `api-news` edge function → top 15 general market headlines

3. **Compute derived values:**
   - Sentiment score (breadth formula above)
   - Market regime (classification rules above)
   - Sector list sorted by pct_change descending
   - Economic calendar events for today (from Finnhub earnings calendar + existing data)

4. **Call Claude API** — single request with structured prompt + computed data → receive prose fields

5. **Write to `daily_briefs`** — single upsert keyed on `date`

### Error handling
- Claude API failure → retry once after 3s; if still fails, write row with prose fields as `""` — card renders data sections only, no AI prose, no broken state
- EODHD data missing at 6am → skip; the 6:15am retry picks it up
- Any fetch failure → log to Supabase edge function logs, return 500 (pg_cron will not retry, the 6:15 entry handles it)

---

## Frontend Component: `DailyBriefCard`

### Location
Top of Dashboard, above the Stats Row. Wrapped in `ErrorBoundary` — if it throws, Dashboard continues rendering normally.

### Collapsed state
```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Daily Brief  ·  Tue 20 May    [TRENDING UP]  [Greed · 64]│
│ "Markets closed broadly higher as tech led gains..."      ▼  │
└─────────────────────────────────────────────────────────────┘
```
- Regime chip: green=trending_up, blue=range_bound, amber=volatile, red=risk_off
- Sentiment badge: green >60, amber 40–60, red <40
- Headline truncated to one line
- Chevron toggles expand/collapse; state persisted to `localStorage` (`brief-expanded-v1`)

### Expanded state
Full brief rendered in labelled sections with dividers. Sector list uses inline mini bars (CSS width, green/red from existing design tokens). Matches existing card style (`bg-card`, `rounded-xl`, `border-border`).

### States
| State | Render |
|---|---|
| Loading | Skeleton matching collapsed height |
| Today's brief exists | Full card |
| No brief for today (before 6am or holiday) | Yesterday's brief with `"Previous session"` badge |
| Table unavailable / React Query error | Card hidden silently — Dashboard unaffected |

### Data hook
```typescript
// src/hooks/useDailyBrief.ts
export function useDailyBrief() {
  return useQuery({
    queryKey: ['daily-brief'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('daily_briefs')
        .select('*')
        .lte('date', today)       // today or earlier
        .order('date', { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    staleTime: 60 * 60_000,       // 1 hour — brief doesn't change during the day
    refetchOnWindowFocus: false,
  });
}
```

---

## Files to Create / Modify

### New files
- `supabase/functions/generate-daily-brief/index.ts` — edge function
- `supabase/migrations/YYYYMMDDHHMMSS_daily_briefs.sql` — table + RLS + index
- `src/hooks/useDailyBrief.ts` — React Query hook
- `src/components/dashboard/DailyBriefCard.tsx` — UI component

### Modified files
- `src/components/layout/Dashboard.tsx` — add `<DailyBriefCard />` above Stats Row

### No changes to
- `App.tsx`, `Sidebar.tsx`, `MobileShell.tsx`, `TradeJournal.tsx`

---

## Scheduling (pg_cron entries)

```sql
-- Primary: 6:00 AM ET (10:00 UTC) weekdays
select cron.schedule(
  'generate-daily-brief',
  '0 10 * * 1-5',
  $$select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/generate-daily-brief',
    headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
  )$$
);

-- Retry: 6:15 AM ET (10:15 UTC) weekdays — catches EODHD data lag
select cron.schedule(
  'generate-daily-brief-retry',
  '15 10 * * 1-5',
  $$select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/generate-daily-brief',
    headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
  )$$
);
```

The idempotency check in the edge function means the retry is a no-op if the primary already succeeded.

---

## Cost Estimate

| Item | Cost |
|---|---|
| Claude API (claude-3-5-haiku, ~2k tokens/day) | ~$0.001/day = ~$0.03/month |
| EODHD API call (bulk endpoint, already used) | $0 (within existing plan) |
| Supabase edge function invocations (2/day) | $0 (within free tier) |
| Supabase DB storage (one row/day, ~2kb) | ~$0.001/month |
| **Total** | **< $0.05/month** |

Scales to any number of users at zero additional cost — the brief is generated once regardless of user count.
