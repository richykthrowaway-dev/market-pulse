import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * news-sync-global — Rotating batch ingestion of global news via GNews.io + MarketAux.
 *
 * Two sources per country:
 *   - GNews.io:   general business headlines (10 articles/country, category=business)
 *   - MarketAux:  stock-specific news with entity/ticker matching (3 articles/country)
 *
 * 8 batches of country codes rotate on each invocation:
 *   0: US, CA, MX, BR, AR, CO   (Americas)
 *   1: GB, DE, FR, IT, ES, NL   (Western Europe)
 *   2: SE, NO, DK, FI, PL, AT, CH (Northern / Central Europe)
 *   3: JP, CN, KR, TW, HK       (East Asia)
 *   4: IN, PK, ID, TH, MY, PH, SG (South / Southeast Asia)
 *   5: AU, NZ, ZA, NG, EG, KE   (Oceania / Africa)
 *   6: IL, AE, SA, TR, UA, RO   (Middle East / Eastern Europe)
 *   7: IE, PT, GR, CZ, HU, SK, BG, RS (Southern / Eastern Europe)
 *
 * State is tracked in the `news_sync_state` table (row id = 'global').
 * Each invocation fetches one batch from both APIs, deduplicates by URL,
 * inserts new articles, advances the batch counter, and trims beyond 5000 total.
 *
 * Trigger: POST /functions/v1/news-sync-global (no body required)
 *
 * Response: { ok, batch, countries, inserted, errors, nextBatch }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GNEWS_BASE = "https://gnews.io/api/v4/top-headlines";
const MARKETAUX_BASE = "https://api.marketaux.com/v1/news/all";
const STATE_ROW_ID = "global";
const MAX_ARTICLES = 5000;
const FETCH_TIMEOUT_MS = 10_000;

const COUNTRY_BATCHES: string[][] = [
  ["us", "ca", "mx", "br", "ar", "co"],
  ["gb", "de", "fr", "it", "es", "nl"],
  ["se", "no", "dk", "fi", "pl", "at", "ch"],
  ["jp", "cn", "kr", "tw", "hk"],
  ["in", "pk", "id", "th", "my", "ph", "sg"],
  ["au", "nz", "za", "ng", "eg", "ke"],
  ["il", "ae", "sa", "tr", "ua", "ro"],
  ["ie", "pt", "gr", "cz", "hu", "sk", "bg", "rs"],
];

const TOTAL_BATCHES = COUNTRY_BATCHES.length;

// ── GNews types ────────────────────────────────────────────────────────────────

interface GNewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  image: string | null;
  publishedAt: string;
  source: { name: string; url: string };
}

interface GNewsResponse {
  totalArticles: number;
  articles: GNewsArticle[];
}

// ── MarketAux types ──────────────────────────────────────────────────────────

interface MarketAuxEntity {
  symbol: string;
  name: string;
  exchange: string | null;
  industry: string | null;
  sentiment_score: number | null;
}

interface MarketAuxArticle {
  uuid: string;
  title: string;
  description: string;
  snippet: string;
  url: string;
  image_url: string | null;
  published_at: string;
  source: string;
  entities: MarketAuxEntity[];
}

interface MarketAuxResponse {
  meta: { found: number; returned: number; limit: number; page: number };
  data: MarketAuxArticle[] | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Fetch top-headlines for a single country from GNews.io.
 * Returns [] on any error (network, rate-limit, timeout).
 * Caller should check `rateLimited` flag on the return value.
 */
async function fetchCountryNews(
  countryCode: string,
  apiKey: string,
): Promise<{ articles: GNewsArticle[]; rateLimited: boolean }> {
  const url =
    `${GNEWS_BASE}?country=${countryCode}&category=business&max=10&apikey=${apiKey}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (res.status === 429) {
      console.warn(
        `[news-sync-global] Rate limited (429) on country=${countryCode}`,
      );
      // Drain body to avoid connection leak
      await res.text();
      return { articles: [], rateLimited: true };
    }

    if (!res.ok) {
      const text = await res.text();
      console.error(
        `[news-sync-global] GNews ${res.status} for ${countryCode}: ${text.slice(0, 200)}`,
      );
      return { articles: [], rateLimited: false };
    }

    const data: GNewsResponse = await res.json();
    return {
      articles: Array.isArray(data?.articles) ? data.articles : [],
      rateLimited: false,
    };
  } catch (e) {
    console.error(
      `[news-sync-global] Fetch error for ${countryCode}: ${e}`,
    );
    return { articles: [], rateLimited: false };
  }
}

/**
 * Fetch stock-specific news for a country from MarketAux.
 * Free tier: 3 articles per request, entity-matched with ticker symbols.
 * Returns [] if key is missing, on error, or on rate-limit.
 */
async function fetchMarketAuxNews(
  countryCode: string,
  apiKey: string | undefined,
): Promise<{ articles: MarketAuxArticle[]; rateLimited: boolean }> {
  if (!apiKey) return { articles: [], rateLimited: false };

  const url =
    `${MARKETAUX_BASE}?countries=${countryCode.toLowerCase()}&filter_entities=true&limit=3&api_token=${apiKey}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (res.status === 429) {
      console.warn(
        `[news-sync-global] MarketAux rate limited (429) on country=${countryCode}`,
      );
      await res.text();
      return { articles: [], rateLimited: true };
    }

    if (!res.ok) {
      const text = await res.text();
      console.error(
        `[news-sync-global] MarketAux ${res.status} for ${countryCode}: ${text.slice(0, 200)}`,
      );
      return { articles: [], rateLimited: false };
    }

    const data: MarketAuxResponse = await res.json();
    return {
      articles: Array.isArray(data?.data) ? data.data : [],
      rateLimited: false,
    };
  } catch (e) {
    console.error(
      `[news-sync-global] MarketAux fetch error for ${countryCode}: ${e}`,
    );
    return { articles: [], rateLimited: false };
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const t0 = Date.now();

  // ── Validate env ──────────────────────────────────────────────────────────
  const gnewsApiKey = Deno.env.get("GNEWS_API_KEY");
  const marketauxApiKey = Deno.env.get("MARKETAUX_API_KEY");

  if (!gnewsApiKey && !marketauxApiKey) {
    return new Response(
      JSON.stringify({ error: "At least one of GNEWS_API_KEY or MARKETAUX_API_KEY must be set" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (!marketauxApiKey) {
    console.warn("[news-sync-global] MARKETAUX_API_KEY not set — skipping stock news");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ── Step 1: Read sync state to determine current batch ──────────────────
    const { data: stateRow } = await supabase
      .from("news_sync_state")
      .select("current_batch, total_batches")
      .eq("id", STATE_ROW_ID)
      .maybeSingle();

    const currentBatch = stateRow?.current_batch ?? 0;
    const batchIndex = currentBatch % TOTAL_BATCHES;
    const countries = COUNTRY_BATCHES[batchIndex];

    console.log(
      `[news-sync-global] Batch ${batchIndex}/${TOTAL_BATCHES}: [${countries.join(", ")}]`,
    );

    // ── Step 2: Fetch news for each country from both APIs ──────────────────
    interface CollectedArticle {
      title: string;
      summary: string;
      source: string;
      url: string;
      imageUrl: string | null;
      publishedAt: string;
      countryCode: string;
      relatedSymbols: string[] | null;
    }

    const allArticles: CollectedArticle[] = [];
    const errors: string[] = [];
    let gnewsRateLimited = false;
    let marketauxRateLimited = false;

    for (const cc of countries) {
      // ── GNews.io (general business news) ──
      if (!gnewsRateLimited && gnewsApiKey) {
        const gnResult = await fetchCountryNews(cc, gnewsApiKey);

        if (gnResult.rateLimited) {
          gnewsRateLimited = true;
          errors.push(`GNews rate limited at country=${cc}`);
        } else {
          for (const article of gnResult.articles) {
            allArticles.push({
              title: (article.title || "").slice(0, 1000),
              summary: (article.description || article.content || "").slice(0, 2000),
              source: article.source?.name || "Unknown",
              url: article.url || "",
              imageUrl: article.image && article.image.startsWith("http") ? article.image : null,
              publishedAt: article.publishedAt
                ? new Date(article.publishedAt).toISOString()
                : new Date().toISOString(),
              countryCode: cc.toUpperCase(),
              relatedSymbols: null,
            });
          }
          console.log(
            `[news-sync-global] GNews ${cc}: ${gnResult.articles.length} articles`,
          );
        }
      }

      // ── MarketAux (stock-specific news with entity matching) ──
      if (!marketauxRateLimited && marketauxApiKey) {
        const maResult = await fetchMarketAuxNews(cc, marketauxApiKey);

        if (maResult.rateLimited) {
          marketauxRateLimited = true;
          errors.push(`MarketAux rate limited at country=${cc}`);
        } else {
          for (const article of maResult.articles) {
            // Extract ticker symbols from matched entities
            const symbols = article.entities
              ?.map((e) => e.symbol)
              .filter(Boolean) ?? [];

            allArticles.push({
              title: (article.title || "").slice(0, 1000),
              summary: (article.description || article.snippet || "").slice(0, 2000),
              source: article.source || "Unknown",
              url: article.url || "",
              imageUrl: article.image_url && article.image_url.startsWith("http")
                ? article.image_url
                : null,
              publishedAt: article.published_at
                ? new Date(article.published_at).toISOString()
                : new Date().toISOString(),
              countryCode: cc.toUpperCase(),
              relatedSymbols: symbols.length > 0 ? symbols : null,
            });
          }
          console.log(
            `[news-sync-global] MarketAux ${cc}: ${maResult.articles.length} articles`,
          );
        }
      }

    }

    // Check if we got anything at all
    if (allArticles.length === 0) {
      errors.push("No articles fetched this batch");
    }

    // ── Step 3: Collect all URLs and deduplicate against existing news ───────
    const articleUrls = allArticles.map((a) => a.url).filter(Boolean);

    // Find which URLs already exist in the DB
    const existingUrls = new Set<string>();
    if (articleUrls.length > 0) {
      // Query in chunks of 100 to stay within PostgREST limits
      for (let i = 0; i < articleUrls.length; i += 100) {
        const chunk = articleUrls.slice(i, i + 100);
        const { data: existing } = await supabase
          .from("news")
          .select("url")
          .in("url", chunk);
        if (existing) {
          for (const row of existing) {
            existingUrls.add(row.url);
          }
        }
      }
    }

    // Filter to only new articles (also deduplicate within the batch by URL)
    const seenUrls = new Set<string>();
    const newArticles = allArticles.filter((a) => {
      if (!a.url || existingUrls.has(a.url) || seenUrls.has(a.url)) return false;
      seenUrls.add(a.url);
      return true;
    });

    console.log(
      `[news-sync-global] ${allArticles.length} total, ${existingUrls.size} existing, ${newArticles.length} new`,
    );

    // ── Step 4: Map to DB rows and insert ───────────────────────────────────
    let inserted = 0;

    if (newArticles.length > 0) {
      const rows = newArticles.map((a) => ({
        title: a.title,
        summary: a.summary,
        source: a.source,
        url: a.url || "#",
        image_url: a.imageUrl,
        published_at: a.publishedAt,
        country_code: a.countryCode,
        related_symbols: a.relatedSymbols,
      }));

      // Insert in batches of 100
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error: insertErr, count } = await supabase
          .from("news")
          .insert(batch, { count: "exact" });

        if (insertErr) {
          console.error(
            `[news-sync-global] Insert error (batch ${i}): ${insertErr.message}`,
          );
          errors.push(`Insert error: ${insertErr.message}`);
        } else {
          inserted += count ?? batch.length;
        }
      }
    }

    console.log(`[news-sync-global] Inserted ${inserted} new articles`);

    // ── Step 5: Advance batch counter in news_sync_state ────────────────────
    const nextBatch = (currentBatch + 1) % TOTAL_BATCHES;
    const countriesUpper = countries.map((c) => c.toUpperCase());

    const { error: stateErr } = await supabase
      .from("news_sync_state")
      .upsert(
        {
          id: STATE_ROW_ID,
          current_batch: nextBatch,
          total_batches: TOTAL_BATCHES,
          last_synced_at: new Date().toISOString(),
          countries_last_synced: countriesUpper,
        },
        { onConflict: "id" },
      );

    if (stateErr) {
      console.error(
        `[news-sync-global] State update error: ${stateErr.message}`,
      );
      errors.push(`State update error: ${stateErr.message}`);
    }

    // ── Step 6: Trim articles beyond MAX_ARTICLES ───────────────────────────
    // Count total articles, then delete oldest if over the limit.
    const { count: totalCount } = await supabase
      .from("news")
      .select("id", { count: "exact", head: true });

    if (totalCount && totalCount > MAX_ARTICLES) {
      const excess = totalCount - MAX_ARTICLES;
      console.log(
        `[news-sync-global] Trimming ${excess} oldest articles (total: ${totalCount})`,
      );

      // Find the oldest articles to delete
      const { data: oldestRows } = await supabase
        .from("news")
        .select("id")
        .order("published_at", { ascending: true })
        .limit(excess);

      if (oldestRows && oldestRows.length > 0) {
        const idsToDelete = oldestRows.map((r) => r.id);
        // Delete in chunks of 100
        for (let i = 0; i < idsToDelete.length; i += 100) {
          const chunk = idsToDelete.slice(i, i + 100);
          const { error: delErr } = await supabase
            .from("news")
            .delete()
            .in("id", chunk);
          if (delErr) {
            console.error(
              `[news-sync-global] Trim delete error: ${delErr.message}`,
            );
          }
        }
        console.log(
          `[news-sync-global] Trimmed ${oldestRows.length} old articles`,
        );
      }
    }

    // ── Response ────────────────────────────────────────────────────────────
    const elapsed = Date.now() - t0;
    console.log(`[news-sync-global] Done in ${elapsed}ms`);

    return new Response(
      JSON.stringify({
        ok: true,
        batch: batchIndex,
        countries: countriesUpper,
        inserted,
        errors: errors.length > 0 ? errors : undefined,
        nextBatch,
        totalArticles: totalCount ?? null,
        elapsed_ms: elapsed,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[news-sync-global] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
