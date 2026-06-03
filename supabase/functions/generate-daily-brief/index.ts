import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * generate-daily-brief
 *
 * Generates a daily AI-written market brief and upserts it to the daily_briefs table.
 * Called by pg_cron at 6:00 AM ET (10:00 UTC) and 6:15 AM ET (10:15 UTC) on weekdays.
 * The idempotency check at the top means the 6:15 retry is a no-op if 6:00 succeeded.
 *
 * pg_cron schedule (run in Supabase SQL editor after deploying):
 *
 *   -- Primary: 6:00 AM ET (10:00 UTC) weekdays
 *   select cron.schedule(
 *     'generate-daily-brief',
 *     '0 10 * * 1-5',
 *     $$select net.http_post(
 *       url := 'https://<project-ref>.supabase.co/functions/v1/generate-daily-brief',
 *       headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
 *     )$$
 *   );
 *
 *   -- Retry: 6:15 AM ET (10:15 UTC) weekdays
 *   select cron.schedule(
 *     'generate-daily-brief-retry',
 *     '15 10 * * 1-5',
 *     $$select net.http_post(
 *       url := 'https://<project-ref>.supabase.co/functions/v1/generate-daily-brief',
 *       headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
 *     )$$
 *   );
 *
 * Required Supabase secrets:
 *   EODHD_API_KEY      — existing secret
 *   FINNHUB_API_KEY    — existing secret
 *   ANTHROPIC_API_KEY  — NEW: add before deploying
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EODHD_BASE   = "https://eodhd.com/api";
const FINNHUB_BASE = "https://finnhub.io/api/v1";
const CLAUDE_URL   = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-3-5-haiku-20241022";

const SPDR_ETFS = [
  { symbol: "XLK",  name: "Technology" },
  { symbol: "XLV",  name: "Healthcare" },
  { symbol: "XLF",  name: "Financials" },
  { symbol: "XLE",  name: "Energy" },
  { symbol: "XLI",  name: "Industrials" },
  { symbol: "XLY",  name: "Cons. Discretionary" },
  { symbol: "XLP",  name: "Cons. Staples" },
  { symbol: "XLB",  name: "Materials" },
  { symbol: "XLRE", name: "Real Estate" },
  { symbol: "XLU",  name: "Utilities" },
  { symbol: "XLC",  name: "Communication" },
];

const INDEX_SYMBOLS = ["^GSPC", "^IXIC", "^DJI", "^RUT", "^VIX", "^FTSE", "^N225", "^GDAXI"];

function todayDate(): string {
  // Use the IANA timezone database to get the correct ET date,
  // accounting for DST (EDT = UTC-4, EST = UTC-5).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function computeSentimentScore(
  advancing: number,
  declining: number,
  newHighs: number,
  newLows: number,
  medianReturn: number,
): number {
  const total = advancing + declining;
  if (total === 0) return 50;
  const advRatio = advancing / total;
  const hlTotal = newHighs + newLows;
  const hlRatio = hlTotal > 0 ? newHighs / hlTotal : 0.5;
  const medNorm = clamp((medianReturn + 3) / 6, 0, 1);
  return Math.round((0.5 * advRatio + 0.3 * hlRatio + 0.2 * medNorm) * 100);
}

function sentimentLabel(score: number): string {
  if (score >= 75) return "Extreme Greed";
  if (score >= 56) return "Greed";
  if (score >= 46) return "Neutral";
  if (score >= 26) return "Fear";
  return "Extreme Fear";
}

function classifyRegime(
  advancing: number,
  declining: number,
  medianReturn: number,
  vix: number,
): string {
  const total = advancing + declining;
  const advRatio = total > 0 ? advancing / total : 0.5;
  if (Math.abs(medianReturn) > 1.5 || vix > 25) return "volatile";
  if (advRatio < 0.40 || medianReturn < -1) return "risk_off";
  if (advRatio > 0.60 && medianReturn > 0) return "trending_up";
  if (advRatio >= 0.45 && advRatio <= 0.55 && Math.abs(medianReturn) < 0.5) return "range_bound";
  return medianReturn > 0 ? "trending_up" : "range_bound";
}

interface BreadthData {
  advancing: number;
  declining: number;
  newHighs: number;
  newLows: number;
  medianReturn: number;
}

async function fetchBreadth(eodhKey: string): Promise<BreadthData | null> {
  try {
    const url = `${EODHD_BASE}/eod-bulk-last-day/US?api_token=${eodhKey}&fmt=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error(`EODHD bulk: HTTP ${res.status}`);
      return null;
    }
    const rows: Array<{ change_p?: number }> = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;

    let advancing = 0, declining = 0, newHighs = 0, newLows = 0;
    const returns: number[] = [];

    for (const row of rows) {
      const chgP = row.change_p ?? 0;
      if (chgP > 0) advancing++;
      else if (chgP < 0) declining++;
      returns.push(chgP);
      if (chgP > 4) newHighs++;
      if (chgP < -4) newLows++;
    }

    returns.sort((a, b) => a - b);
    const mid = Math.floor(returns.length / 2);
    const medianReturn = returns.length % 2 === 0
      ? (returns[mid - 1] + returns[mid]) / 2
      : returns[mid];

    return { advancing, declining, newHighs, newLows, medianReturn };
  } catch (e) {
    console.error("fetchBreadth error:", e);
    return null;
  }
}

interface QuoteResult {
  symbol: string;
  changePercent: number | null;
  price: number | null;
}

async function fetchYahooQuotes(
  symbols: string[],
  supabaseUrl: string,
  serviceKey: string,
): Promise<QuoteResult[]> {
  try {
    const url = `${supabaseUrl}/functions/v1/api-yahoo?endpoint=quotes&symbols=${symbols.join(",")}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      console.error(`api-yahoo quotes: HTTP ${res.status}`);
      return symbols.map((s) => ({ symbol: s, changePercent: null, price: null }));
    }
    const data: Record<string, { regularMarketChangePercent?: number | null; regularMarketPrice?: number | null } | null> = await res.json();
    return symbols.map((s) => ({
      symbol: s,
      changePercent: data[s]?.regularMarketChangePercent ?? null,
      price: data[s]?.regularMarketPrice ?? null,
    }));
  } catch (e) {
    console.error("fetchYahooQuotes error:", e);
    return symbols.map((s) => ({ symbol: s, changePercent: null, price: null }));
  }
}

interface NewsHeadline {
  title: string;
  source: string;
}

async function fetchFinnhubNews(finnhubKey: string, limit = 15): Promise<NewsHeadline[]> {
  try {
    const url = `${FINNHUB_BASE}/news?category=general&token=${finnhubKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return [];
    const items: Array<{ headline?: string; source?: string }> = await res.json();
    return items
      .slice(0, limit)
      .map((i) => ({ title: i.headline ?? "", source: i.source ?? "" }))
      .filter((i) => i.title.length > 0);
  } catch (e) {
    console.error("fetchFinnhubNews error:", e);
    return [];
  }
}

interface ClaudeProseFields {
  summary: string;
  fear_greed_interpretation: string;
  current_events: string;
  watch_today: string;
}

async function callClaude(
  anthropicKey: string,
  data: {
    date: string;
    regime: string;
    sentimentScore: number;
    sentimentLabel: string;
    vix: number | null;
    advancing: number;
    declining: number;
    medianReturn: number;
    sectors: Array<{ name: string; symbol: string; pct_change: number | null }>;
    headlines: NewsHeadline[];
  },
): Promise<ClaudeProseFields> {
  const fallback: ClaudeProseFields = {
    summary: "",
    fear_greed_interpretation: "",
    current_events: "",
    watch_today: "",
  };

  const systemPrompt = `You are a professional market analyst writing a pre-market briefing for retail traders.
You will receive structured market data as JSON. Write the briefing by filling in the output schema below.
Populate only the four prose fields. Do not add or remove any fields.

Tone: clear, direct, factual. No hype, no price predictions, no "should" language.
Limits: max 4 sentences for summary; max 1 sentence for fear_greed_interpretation; max 3 sentences for current_events; max 1 sentence for watch_today.

Return ONLY valid JSON matching this schema:
{
  "summary": "...",
  "fear_greed_interpretation": "...",
  "current_events": "...",
  "watch_today": "..."
}`;

  const userContent = JSON.stringify({
    date: data.date,
    market_regime: data.regime,
    breadth: {
      advancing: data.advancing,
      declining: data.declining,
      advancing_pct: Math.round(data.advancing / (data.advancing + data.declining) * 100),
      median_return_pct: data.medianReturn.toFixed(2),
    },
    sentiment: { score: data.sentimentScore, label: data.sentimentLabel },
    vix: data.vix,
    sectors: data.sectors.map((s) => ({
      name: s.name,
      pct_change: s.pct_change != null ? `${s.pct_change >= 0 ? "+" : ""}${s.pct_change.toFixed(2)}%` : "N/A",
    })),
    top_headlines: data.headlines.slice(0, 10).map((h) => h.title),
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(CLAUDE_URL, {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 600,
          messages: [{ role: "user", content: userContent }],
          system: systemPrompt,
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (!res.ok) {
        console.error(`Claude API: HTTP ${res.status} on attempt ${attempt + 1}`);
        if (attempt === 0) { await new Promise((r) => setTimeout(r, 3000)); continue; }
        return fallback;
      }

      const body = await res.json();
      const text: string = body?.content?.[0]?.text ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("Claude response has no JSON block");
        return fallback;
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary:                   String(parsed.summary ?? ""),
        fear_greed_interpretation: String(parsed.fear_greed_interpretation ?? ""),
        current_events:            String(parsed.current_events ?? ""),
        watch_today:               String(parsed.watch_today ?? ""),
      };
    } catch (e) {
      console.error(`Claude API attempt ${attempt + 1} error:`, e);
      if (attempt === 0) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  return fallback;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const EODHD_KEY     = Deno.env.get("EODHD_API_KEY") ?? "";
  const FINNHUB_KEY   = Deno.env.get("FINNHUB_API_KEY") ?? "";
  const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

  if (!EODHD_KEY) {
    console.error("EODHD_API_KEY not set");
    return new Response(JSON.stringify({ error: "EODHD_API_KEY not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const today = todayDate();

  const { data: existing } = await supabase
    .from("daily_briefs")
    .select("id")
    .eq("date", today)
    .maybeSingle();

  if (existing) {
    console.log(`daily_briefs: row already exists for ${today} — skipping`);
    return new Response(JSON.stringify({ ok: true, skipped: true, date: today }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sectorSymbols = SPDR_ETFS.map((e) => e.symbol);
  const allYahooSymbols = [...INDEX_SYMBOLS, ...sectorSymbols];

  const [breadth, yahooQuotes, headlines] = await Promise.all([
    fetchBreadth(EODHD_KEY),
    fetchYahooQuotes(allYahooSymbols, SUPABASE_URL, SERVICE_KEY),
    fetchFinnhubNews(FINNHUB_KEY, 15),
  ]);

  if (!breadth) {
    console.error("Breadth data unavailable — aborting");
    return new Response(JSON.stringify({ error: "breadth data unavailable" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const quoteMap = Object.fromEntries(yahooQuotes.map((q) => [q.symbol, q]));

  const vixQuote = quoteMap["^VIX"];
  const vix: number | null = vixQuote?.price ?? null;

  const sentScore = computeSentimentScore(
    breadth.advancing, breadth.declining,
    breadth.newHighs, breadth.newLows, breadth.medianReturn,
  );
  const sentLbl = sentimentLabel(sentScore);
  const regime = classifyRegime(
    breadth.advancing, breadth.declining, breadth.medianReturn, vix ?? 20,
  );

  const sectors = SPDR_ETFS.map((etf) => ({
    symbol: etf.symbol,
    name: etf.name,
    pct_change: quoteMap[etf.symbol]?.changePercent ?? null,
  })).sort((a, b) => {
    if (a.pct_change == null) return 1;
    if (b.pct_change == null) return -1;
    return b.pct_change - a.pct_change;
  });

  const fearGreedBase = { score: sentScore, label: sentLbl, vix, interpretation: "" };

  const topSector = sectors.find((s) => s.pct_change != null && s.pct_change > 0);
  const botSector = [...sectors].reverse().find((s) => s.pct_change != null && s.pct_change < 0);
  const advTotal = breadth.advancing + breadth.declining;
  const advPct = advTotal > 0 ? Math.round(breadth.advancing / advTotal * 100) : 50;
  const spxChange = quoteMap["^GSPC"]?.changePercent;
  const spxStr = spxChange != null
    ? `S&P 500 ${spxChange >= 0 ? "+" : ""}${spxChange.toFixed(2)}%`
    : "Markets";
  const dataHeadline = topSector && botSector
    ? `${spxStr} · ${topSector.name} led, ${botSector.name} lagged · ${advPct}% advanced`
    : `${spxStr} · ${advPct}% of stocks advanced`;

  let prose: ClaudeProseFields = { summary: "", fear_greed_interpretation: "", current_events: "", watch_today: "" };
  if (ANTHROPIC_KEY) {
    prose = await callClaude(ANTHROPIC_KEY, {
      date: today, regime, sentimentScore: sentScore, sentimentLabel: sentLbl,
      vix, advancing: breadth.advancing, declining: breadth.declining,
      medianReturn: breadth.medianReturn, sectors, headlines,
    });
  } else {
    console.warn("ANTHROPIC_API_KEY not set — writing data-only row");
  }

  const row = {
    date: today,
    headline: dataHeadline,
    market_regime: regime,
    sentiment_score: sentScore,
    vix,
    summary: prose.summary,
    sectors,
    fear_greed: { ...fearGreedBase, interpretation: prose.fear_greed_interpretation },
    current_events: prose.current_events,
    calendar: [],
    watch_today: prose.watch_today,
    model: ANTHROPIC_KEY ? CLAUDE_MODEL : "none",
  };

  const { error: upsertErr } = await supabase
    .from("daily_briefs")
    .upsert(row, { onConflict: "date" });

  if (upsertErr) {
    console.error("Upsert error:", upsertErr);
    return new Response(JSON.stringify({ error: upsertErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`daily_briefs: upserted row for ${today} (regime=${regime}, sentiment=${sentScore})`);
  return new Response(JSON.stringify({ ok: true, date: today, regime, sentiment: sentScore }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
