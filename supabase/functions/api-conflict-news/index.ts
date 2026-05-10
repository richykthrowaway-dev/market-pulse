import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-conflict-news — fetch recent English-language news articles about
 * a given conflict location using the GDELT 2.0 DOC API (ArtList mode).
 *
 * Query params:
 *   ?country=Ukraine         — country name string (required)
 *
 * Response: { articles: ConflictNewsArticle[] }
 *
 * GDELT DOC API is free, no key, last-14-day window, English only.
 * Returns up to 5 articles. Empty array on any error.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

interface GdeltArticle {
  url:          string;
  title:        string;
  seendate:     string;   // "20241215T120000Z"
  domain:       string;
  socialimage?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url     = new URL(req.url);
  const country = (url.searchParams.get("country") ?? "").trim();

  if (!country) return json({ articles: [] });

  try {
    // Quoted country name + "conflict" keeps results on-topic
    const q = encodeURIComponent(`"${country}" conflict`);
    const gdeltUrl =
      `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}` +
      `&mode=ArtList&maxrecords=5&format=json&timespan=14d&sourcelang=English`;

    const res = await fetch(gdeltUrl, {
      headers: { "User-Agent": "MarketPulse/1.0" },
    });

    if (!res.ok) return json({ articles: [] });

    const data = await res.json();
    const articles = ((data.articles ?? []) as GdeltArticle[])
      .slice(0, 5)
      .map((a) => ({
        url:         a.url,
        title:       a.title,
        seendate:    a.seendate,
        domain:      a.domain,
        socialimage: a.socialimage ?? null,
      }));

    return json({ articles });
  } catch (err) {
    console.error("api-conflict-news error:", err);
    return json({ articles: [] });
  }
});
