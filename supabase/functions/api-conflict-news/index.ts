import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-conflict-news — fetches recent English-language news articles about
 * a given conflict location using the Google News RSS feed.
 *
 * Google News RSS aggregates Reuters, AP, BBC, Bloomberg, The Guardian,
 * and hundreds of other outlets.  No API key, no rate limit documentation,
 * free for non-commercial use per the feed's terms.
 *
 * Query params:
 *   ?country=Ukraine   — country / location name (required)
 *
 * Response: { articles: [{ title, url, source, pubDate }] }
 * Returns up to 5 articles.  Empty array on any error.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

interface ParsedArticle {
  title:   string;
  url:     string;
  source:  string;  // "Reuters", "The Guardian", "BBC", …
  pubDate: string;  // RFC 822: "Sun, 10 May 2026 02:19:14 GMT"
}

/**
 * Minimal RSS XML parser — pulls <item> blocks and extracts the fields
 * we need.  Google News RSS doesn't use CDATA for titles so plain regex
 * is sufficient and avoids the need for a full XML library.
 */
function parseRss(xml: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null && articles.length < 5) {
    const block = m[1];

    // Title — plain text or CDATA
    const titleM =
      block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ??
      block.match(/<title>([^<]*)<\/title>/);

    // Link — Google News redirect URL
    const linkM = block.match(/<link>(https?:\/\/[^\s<]+)<\/link>/);

    // pubDate
    const dateM = block.match(/<pubDate>([^<]+)<\/pubDate>/);

    // Source name ("Reuters", "BBC", …) — text content of <source …>…</source>
    const srcM = block.match(/<source[^>]*>([^<]+)<\/source>/);

    if (!titleM?.[1] || !linkM?.[1]) continue;

    articles.push({
      title:   titleM[1].trim(),
      url:     linkM[1].trim(),
      source:  srcM?.[1]?.trim() ?? "",
      pubDate: dateM?.[1]?.trim() ?? "",
    });
  }

  return articles;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url     = new URL(req.url);
  const country = (url.searchParams.get("country") ?? "").trim();

  if (!country) return jsonResp({ articles: [] });

  try {
    // Google News RSS — English, US edition
    const q = encodeURIComponent(`${country} conflict`);
    const rssUrl =
      `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;

    const res = await fetch(rssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MarketPulse/1.0; +https://market-pulse.app)",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
    });

    if (!res.ok) return jsonResp({ articles: [] });

    const xml      = await res.text();
    const articles = parseRss(xml);

    return jsonResp({ articles });
  } catch (err) {
    console.error("api-conflict-news error:", err);
    return jsonResp({ articles: [] });
  }
});
