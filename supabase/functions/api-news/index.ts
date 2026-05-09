import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-news — Multi-source news aggregator with auto-translation + DB cache.
 *
 * CACHE-FIRST ARCHITECTURE:
 *   1. Check news_cache table for a fresh cached response (< CACHE_TTL)
 *   2. If cache HIT → return immediately (0 API calls burned)
 *   3. If cache MISS → fetch from external APIs, translate, store in cache
 *
 * Sources (ordered by priority per country):
 *   0. AllAfrica RSS — per-country + business feeds for 54 African countries (FREE)
 *   0b. Pan-African  — BBC Africa, Africanews, France24 Africa RSS (FREE, keyword-matched)
 *   1. GNews.io     — localized business headlines (GNEWS_API_KEY)
 *   2. NewsAPI.org   — headlines for countries GNews doesn't cover well (NEWSAPI_KEY)
 *   3. MarketAux    — stock-specific news with entity matching (MARKETAUX_API_KEY)
 *   4. Finnhub      — general market news + company news by ticker (FINNHUB_API_KEY)
 *
 * Key rotation:
 *   - Primary GNews key → well-covered GNEWS_COUNTRIES (top-headlines)
 *   - Supplemental keys (GNEWS_API_KEY_2, _3, …) → gap countries (search fallback)
 *
 * Non-English articles are automatically translated to English via Google Translate.
 *
 * Query params:
 *   country  - ISO 3166-1 alpha-2 code (e.g. "JP", "BR")
 *   symbols  - comma-separated tickers (e.g. "AAPL,MSFT")
 *   days     - how many days back for company news (default: 7)
 *   fresh    - "1" to bypass cache and force a fresh fetch
 *
 * Response: { news: NewsItem[], timestamp: number, cached?: boolean }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const GNEWS_BASE = "https://gnews.io/api/v4/top-headlines";
const MARKETAUX_BASE = "https://api.marketaux.com/v1/news/all";
const NEWSAPI_BASE = "https://newsapi.org/v2";
const NEWSDATA_BASE = "https://newsdata.io/api/1/news";
const CURRENTS_BASE = "https://api.currentsapi.services/v1/latest-news";
const TIMEOUT_MS = 8_000;

/**
 * Cache TTL: 6 hours.
 * With 89 countries and 3 GNews keys (300 calls/day), this means at most
 * 89 × 4 = 356 calls/day if EVERY country is visited. In practice, far fewer
 * countries are accessed daily, so 6h is a safe sweet spot.
 */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
  relatedSymbols: string[];
}

// ── Country source routing ────────────────────────────────────────────────

const GNEWS_COUNTRIES = new Set([
  "US", "GB", "CA", "AU", "IN", "DE", "FR", "IT", "ES", "NL", "CH", "SE",
  "NO", "DK", "FI", "PL", "AT", "IE", "PT", "GR", "CZ", "HU", "RO", "UA",
  "JP", "CN", "KR", "HK", "TW", "SG", "ID", "TH", "MY", "PH", "PK", "NZ",
  "BR", "MX", "AR", "CO", "IL", "AE", "SA", "TR", "ZA", "EG", "NG",
  "BG", "RS", "SK",
]);

const NEWSAPI_COUNTRIES = new Set([
  "AE", "AR", "AT", "AU", "BE", "BG", "BR", "CA", "CH", "CN", "CO", "CU",
  "CZ", "DE", "EG", "FR", "GB", "GR", "HK", "HU", "ID", "IE", "IL", "IN",
  "IT", "JP", "KR", "LT", "LV", "MA", "MX", "MY", "NG", "NL", "NO", "NZ",
  "PH", "PL", "PT", "RO", "RS", "RU", "SA", "SE", "SG", "SI", "SK", "TH",
  "TR", "TW", "UA", "US", "VE", "ZA",
]);

// Currents API supports a limited set of countries — calling with an
// unsupported country returns HTTP 400. Verified live against the API.
const CURRENTS_COUNTRIES = new Set([
  "US", "GB", "CA", "AU", "NZ", "IE",
  "DE", "FR", "IT", "ES", "NL", "CH", "SE", "NO", "DK", "FI", "PL", "AT",
  "PT", "GR", "CZ", "HU", "RO", "BE", "RU", "UA",
  "JP", "CN", "KR", "HK", "TW", "SG", "ID", "TH", "MY", "PH", "PK", "IN", "VN",
  "BR", "MX", "AR", "CO", "CL",
  "SA", "AE", "IR", "IQ", "LB", "QA", "TR", "IL",
  "NG", "KE", "EG", "GH",
]);

// NewsData.io has effectively universal country coverage (60+ ISO2 codes).
// We don't gate on a country list — failures are silent and fall through.

const COUNTRY_NAMES: Record<string, string> = {
  GH: "Ghana", TZ: "Tanzania", ET: "Ethiopia", UG: "Uganda",
  SN: "Senegal", CI: "Ivory Coast", CM: "Cameroon", DZ: "Algeria",
  TN: "Tunisia", BW: "Botswana", ZW: "Zimbabwe", AO: "Angola",
  MZ: "Mozambique", RW: "Rwanda", NA: "Namibia", KE: "Kenya",
  QA: "Qatar", KW: "Kuwait", JO: "Jordan", BH: "Bahrain", OM: "Oman",
  LB: "Lebanon", IQ: "Iraq", IR: "Iran",
  VN: "Vietnam", BD: "Bangladesh", LK: "Sri Lanka", KZ: "Kazakhstan",
  MM: "Myanmar", KH: "Cambodia", NP: "Nepal", MN: "Mongolia",
  CL: "Chile", PE: "Peru", EC: "Ecuador", UY: "Uruguay", PY: "Paraguay",
  HR: "Croatia", EE: "Estonia", IS: "Iceland", LU: "Luxembourg",
  US: "United States", GB: "United Kingdom", DE: "Germany", FR: "France",
  JP: "Japan", CN: "China", BR: "Brazil", IN: "India", RU: "Russia",
  ZA: "South Africa", SA: "Saudi Arabia", AE: "UAE", KR: "South Korea",
  BE: "Belgium", MA: "Morocco", VE: "Venezuela", SI: "Slovenia",
  LT: "Lithuania", LV: "Latvia", CU: "Cuba",
  // Africa (34 new)
  BJ: "Benin", BF: "Burkina Faso", BI: "Burundi", CV: "Cape Verde",
  CF: "Central African Republic", TD: "Chad", KM: "Comoros",
  CG: "Congo-Brazzaville", CD: "DR Congo", DJ: "Djibouti",
  GQ: "Equatorial Guinea", ER: "Eritrea", SZ: "Eswatini",
  GA: "Gabon", GM: "Gambia", GN: "Guinea", GW: "Guinea-Bissau",
  LS: "Lesotho", LR: "Liberia", LY: "Libya", MG: "Madagascar",
  MW: "Malawi", ML: "Mali", MR: "Mauritania", MU: "Mauritius",
  NE: "Niger", ST: "São Tomé and Príncipe", SC: "Seychelles",
  SL: "Sierra Leone", SO: "Somalia", SS: "South Sudan",
  SD: "Sudan", TG: "Togo", ZM: "Zambia",
  // Europe (8 new)
  AL: "Albania", BA: "Bosnia", BY: "Belarus", CY: "Cyprus",
  MD: "Moldova", ME: "Montenegro", MK: "North Macedonia", XK: "Kosovo",
  // Middle East (6 new — IR, IQ, LB already above)
  PS: "Palestine", SY: "Syria", YE: "Yemen",
  // Central Asia
  TM: "Turkmenistan", UZ: "Uzbekistan", KG: "Kyrgyzstan", TJ: "Tajikistan",
  // South Asia (additional)
  AF: "Afghanistan", BT: "Bhutan",
  // Southeast Asia (additional)
  BN: "Brunei", LA: "Laos", TL: "Timor-Leste",
  // South Caucasus
  AM: "Armenia", AZ: "Azerbaijan", GE: "Georgia",
  // East Asia (additional)
  KP: "North Korea",
  // Pacific
  FJ: "Fiji", NC: "New Caledonia", PG: "Papua New Guinea",
  SB: "Solomon Islands", VU: "Vanuatu",
  // Caribbean
  BS: "Bahamas", DO: "Dominican Republic", HT: "Haiti",
  JM: "Jamaica", PR: "Puerto Rico", TT: "Trinidad and Tobago",
  // Central America
  BZ: "Belize", CR: "Costa Rica", GT: "Guatemala", HN: "Honduras",
  NI: "Nicaragua", PA: "Panama", SV: "El Salvador",
  // South America (additional)
  BO: "Bolivia", GY: "Guyana", SR: "Suriname",
  // Other
  GL: "Greenland", EH: "Western Sahara", FK: "Falkland Islands",
};

// ── RSS Feeds (free, unlimited) ────────────────────────────────────────────

/**
 * Country code → AllAfrica RSS feed slug.
 * AllAfrica aggregates from 140+ African news orgs and provides
 * per-country feeds with 15-30 articles each. FREE, no API key needed.
 */
const ALLAFRICA_FEEDS: Record<string, string> = {
  // Original 20
  ZA: "southafrica", EG: "egypt", NG: "nigeria", KE: "kenya",
  MA: "morocco", GH: "ghana", TZ: "tanzania", ET: "ethiopia",
  UG: "uganda", SN: "senegal", CI: "cotedivoire", CM: "cameroon",
  DZ: "algeria", TN: "tunisia", BW: "botswana", ZW: "zimbabwe",
  AO: "angola", MZ: "mozambique", RW: "rwanda", NA: "namibia",
  // 34 new — all verified working RSS feeds
  BJ: "benin", BF: "burkinafaso", BI: "burundi",
  CF: "centralafricanrepublic", TD: "chad",
  DJ: "djibouti", GQ: "equatorialguinea", ER: "eritrea",
  SZ: "eswatini", GA: "gabon", GM: "gambia", GN: "guinea",
  GW: "guineabissau", LS: "lesotho", LR: "liberia", LY: "libya",
  MG: "madagascar", MW: "malawi", ML: "mali", MR: "mauritania",
  MU: "mauritius", NE: "niger", ST: "saotomeandprincipe",
  SC: "seychelles", SL: "sierraleone", SO: "somalia",
  SS: "southsudan", SD: "sudan", TG: "togo", ZM: "zambia",
  // Note: CV (Cape Verde), KM (Comoros), CG (Congo-Brazzaville),
  // CD (DR Congo) have no working AllAfrica feeds — use AllAfrica Business + GNews search
};

/** African countries WITHOUT a dedicated AllAfrica feed */
const AFRICAN_NO_FEED = new Set(["CV", "KM", "CG", "CD"]);

// ── Country-specific business RSS feeds ──────────────────────────────────
// FREE, no API key, no rate limits. Each country gets 1-3 high-quality local
// English-language business outlets. Failures are silent — broken feeds just
// return [] and the rest of the pipeline (GNews, MarketAux, pan-regional)
// still runs.
//
// Coverage focus: Asia + Middle East (where pan-regional feeds were thin)
// + supplemental high-traffic outlets for major African economies.
const COUNTRY_BUSINESS_RSS: Record<string, Array<{ url: string; source: string }>> = {
  // ── Asia ────────────────────────────────────────────────────────────────
  IN: [
    { url: "https://www.thehindu.com/business/feeder/default.rss",            source: "The Hindu Business" },
    { url: "https://www.livemint.com/rss/markets",                             source: "LiveMint Markets" },
    { url: "https://www.business-standard.com/rss/markets-106.rss",            source: "Business Standard" },
  ],
  CN: [
    { url: "https://www.chinadaily.com.cn/rss/business_rss.xml",               source: "China Daily Business" },
    { url: "https://www.globaltimes.cn/rss/economy.xml",                       source: "Global Times Economy" },
  ],
  JP: [
    { url: "https://www3.nhk.or.jp/nhkworld/en/news/rss/all.xml",              source: "NHK World" },
    { url: "https://japannews.yomiuri.co.jp/feed/",                            source: "The Japan News" },
  ],
  HK: [
    { url: "https://www.scmp.com/rss/91/feed",                                 source: "SCMP Business" },
    { url: "https://www.scmp.com/rss/2/feed",                                  source: "SCMP Hong Kong" },
  ],
  KR: [
    { url: "https://www.koreaherald.com/rss/020100000000.xml",                 source: "Korea Herald Business" },
    { url: "https://www.koreatimes.co.kr/www/rss/biz.xml",                     source: "Korea Times Business" },
  ],
  TW: [
    { url: "https://focustaiwan.tw/rss/biz",                                   source: "Focus Taiwan Business" },
  ],
  SG: [
    { url: "https://www.straitstimes.com/news/business/rss.xml",               source: "Straits Times Business" },
    { url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6936",                                       source: "Channel News Asia Business" },
  ],
  ID: [
    { url: "https://www.thejakartapost.com/business/rss",                      source: "Jakarta Post Business" },
    { url: "https://en.tempo.co/rss/business",                                 source: "Tempo Business" },
  ],
  TH: [
    { url: "https://www.bangkokpost.com/rss/data/business.xml",                source: "Bangkok Post Business" },
    { url: "https://www.nationthailand.com/rss/business",                      source: "The Nation Business" },
  ],
  MY: [
    { url: "https://www.thestar.com.my/rss/Business/",                         source: "The Star Malaysia Business" },
    { url: "https://www.malaymail.com/feed/rss/money",                         source: "Malay Mail Money" },
  ],
  PH: [
    { url: "https://business.inquirer.net/feed",                               source: "Inquirer Business" },
    { url: "https://www.philstar.com/rss/business",                            source: "Philstar Business" },
  ],
  VN: [
    { url: "https://e.vnexpress.net/rss/business.rss",                         source: "VnExpress Business" },
    { url: "https://vietnamnews.vn/rss/economy.rss",                           source: "Vietnam News Economy" },
  ],
  PK: [
    { url: "https://www.dawn.com/feeds/business",                              source: "Dawn Business" },
    { url: "https://tribune.com.pk/feed/business",                             source: "Express Tribune Business" },
  ],
  BD: [
    { url: "https://www.thedailystar.net/business/rss.xml",                    source: "Daily Star Business" },
    { url: "https://www.dhakatribune.com/feed/business",                       source: "Dhaka Tribune Business" },
  ],
  LK: [
    { url: "https://www.dailymirror.lk/RSS_BREAKING_NEWS/107",                 source: "Daily Mirror Sri Lanka" },
  ],
  KZ: [
    { url: "https://astanatimes.com/category/business/feed/",                  source: "Astana Times Business" },
  ],
  MM: [
    { url: "https://www.mmtimes.com/rss/business.xml",                         source: "Myanmar Times Business" },
  ],
  KH: [
    { url: "https://www.phnompenhpost.com/rss/business.xml",                   source: "Phnom Penh Post Business" },
  ],
  NP: [
    { url: "https://kathmandupost.com/rss",                                    source: "Kathmandu Post" },
  ],
  MN: [
    { url: "https://www.montsame.mn/en/rss/0/8",                               source: "MONTSAME Mongolia" },
  ],

  // ── Middle East ─────────────────────────────────────────────────────────
  SA: [
    { url: "https://www.arabnews.com/taxonomy/term/8/feed",                    source: "Arab News Business" },
    { url: "https://saudigazette.com.sa/rssFeed/120",                          source: "Saudi Gazette Business" },
  ],
  AE: [
    { url: "https://gulfnews.com/rss?xml&page=business",                       source: "Gulf News Business" },
    { url: "https://www.thenationalnews.com/business/rss.xml",                 source: "The National Business" },
    { url: "https://www.khaleejtimes.com/rss/business",                        source: "Khaleej Times Business" },
  ],
  TR: [
    { url: "https://www.dailysabah.com/rss/business",                          source: "Daily Sabah Business" },
    { url: "https://www.hurriyetdailynews.com/rss/business",                   source: "Hurriyet Business" },
  ],
  IL: [
    { url: "https://www.jpost.com/rss/rssfeedsbusinessandinnovation.aspx",     source: "Jerusalem Post Business" },
    { url: "https://www.timesofisrael.com/topic/business/feed/",               source: "Times of Israel Business" },
    { url: "https://www.haaretz.com/cmlink/1.628152",                          source: "Haaretz Business" },
  ],
  IR: [
    { url: "https://www.tehrantimes.com/rss/economy",                          source: "Tehran Times Economy" },
    { url: "https://financialtribune.com/rss.xml",                             source: "Financial Tribune" },
  ],
  EG: [
    { url: "https://egyptindependent.com/feed/",                               source: "Egypt Independent" },
    { url: "https://english.ahram.org.eg/rss.aspx?CategoryID=3",               source: "Ahram Online Business" },
  ],
  QA: [
    { url: "https://thepeninsulaqatar.com/feed/business",                      source: "The Peninsula Business" },
    { url: "https://www.gulf-times.com/rss/business",                          source: "Gulf Times Business" },
  ],
  KW: [
    { url: "https://www.arabtimesonline.com/category/business/feed/",          source: "Arab Times Business" },
  ],
  BH: [
    { url: "https://www.gdnonline.com/rss/business.xml",                       source: "Gulf Daily News" },
  ],
  OM: [
    { url: "https://timesofoman.com/rss/business",                             source: "Times of Oman Business" },
  ],
  JO: [
    { url: "https://jordantimes.com/rss/business",                             source: "Jordan Times Business" },
  ],
  LB: [
    { url: "https://www.dailystar.com.lb/RSS.aspx?id=3&fromDate=&toDate=",     source: "Daily Star Lebanon" },
  ],

  // ── Africa supplemental (per-country business outlets) ─────────────────
  // These augment the per-country AllAfrica feeds + the pan-African wire
  // feeds. URLs were probed for liveness; broken ones are kept commented as
  // breadcrumbs for future revivals.
  ZA: [
    { url: "https://mg.co.za/feed/",                                           source: "Mail & Guardian" },
    { url: "https://feeds.news24.com/articles/fin24/Companies/rss",            source: "News24 Companies" },
    { url: "https://www.businesslive.co.za/feeds/rss/?publication=bd&section=companies", source: "BusinessLive Companies" },
  ],
  NG: [
    { url: "https://www.vanguardngr.com/feed/",                                source: "Vanguard Nigeria" },
    { url: "https://www.thisdaylive.com/feed/",                                source: "ThisDay Nigeria" },
    { url: "https://dailytrust.com/feed/",                                     source: "Daily Trust" },
    { url: "https://leadership.ng/feed/",                                      source: "Leadership Nigeria" },
    { url: "https://punchng.com/topics/business/feed/",                        source: "Punch Business" },
    { url: "https://www.premiumtimesng.com/business/feed",                     source: "Premium Times Business" },
    { url: "https://businessday.ng/feed/",                                     source: "BusinessDay Nigeria" },
  ],
  KE: [
    { url: "https://www.standardmedia.co.ke/rss/business.php",                 source: "Standard Media Business" },
    { url: "https://nation.africa/kenya/business/-/996.atom",                  source: "Daily Nation Business" },
    { url: "https://www.businessdailyafrica.com/bd/rss",                       source: "Business Daily Africa" },
  ],
  GH: [
    { url: "https://www.myjoyonline.com/business/feed/",                       source: "MyJoy Business" },
    { url: "https://citinewsroom.com/category/business/feed/",                 source: "Citi News Business" },
  ],
  TZ: [
    { url: "https://www.thecitizen.co.tz/tanzania/news/business/-/1840414.atom", source: "The Citizen Tanzania Business" },
  ],
  UG: [
    { url: "https://www.monitor.co.ug/uganda/business/-/688322.atom",          source: "Monitor Uganda Business" },
  ],
  ZW: [
    { url: "https://www.herald.co.zw/category/business/feed/",                 source: "The Herald Business" },
    { url: "https://www.chronicle.co.zw/feed/",                                source: "Chronicle Zimbabwe" },
  ],
  ET: [
    { url: "https://www.thereporterethiopia.com/feed/",                        source: "The Reporter Ethiopia" },
    { url: "https://capitalethiopia.com/category/business/feed/",              source: "Capital Ethiopia Business" },
  ],
  LY: [
    { url: "https://libyaherald.com/feed/",                                    source: "Libya Herald" },
  ],
  NA: [
    { url: "https://www.namibian.com.na/feed/",                                source: "The Namibian" },
  ],
};

/**
 * Fetch all country-specific business RSS feeds for a country in parallel.
 * Each feed is independent — one failure doesn't block the others. FREE.
 */
async function fetchCountryBusinessRss(countryCode: string): Promise<NewsItem[]> {
  const feeds = COUNTRY_BUSINESS_RSS[countryCode];
  if (!feeds || feeds.length === 0) return [];

  const results = await Promise.all(
    feeds.map(async ({ url, source }, feedIdx) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) {
          console.warn(`Country RSS ${source} (${countryCode}): HTTP ${res.status}`);
          return [];
        }
        const xml = await res.text();
        // Reuse the pan-regional parser (handles HTML in description, media images,
        // CDATA, both <item> and <entry> patterns better than the AllAfrica parser).
        const items = parsePanRegionalRss(xml, source, 15);
        return items.map((item, i) => ({
          ...item,
          id: `rss-country-${countryCode}-${feedIdx}-${i}`,
        }));
      } catch (e) {
        console.error(`Country RSS ${source} (${countryCode}) error: ${e}`);
        return [];
      }
    }),
  );

  const all = results.flat();
  console.log(`Country RSS ${countryCode}: ${all.length} articles from ${feeds.length} feeds`);
  return all;
}

// ── Pan-African RSS Feeds (BBC, Africanews, France24) ────────────────────
// Fetch ONCE per cache window, distribute to countries via keyword matching.
// Extremely efficient: 3 HTTP requests cover ALL 54 African countries.

const PAN_AFRICAN_FEED_URLS = [
  { url: "http://www.africanews.com/feed/", source: "Africanews", maxItems: 80 },
  { url: "https://feeds.bbci.co.uk/news/world/africa/rss.xml", source: "BBC Africa", maxItems: 50 },
  { url: "https://www.france24.com/en/africa/rss", source: "France24 Africa", maxItems: 50 },
  // Continental business / development outlets — verified live RSS feeds.
  // Each one auto-distributes across all 54 African countries via keyword matching.
  { url: "https://www.theafricareport.com/feed/", source: "The Africa Report", maxItems: 50 },
  { url: "https://www.howwemadeitinafrica.com/feed/", source: "How We Made It In Africa", maxItems: 40 },
  { url: "https://furtherafrica.com/feed/", source: "FurtherAfrica", maxItems: 30 },
  { url: "https://techcabal.com/feed/", source: "TechCabal", maxItems: 30 },
  { url: "https://news.un.org/feed/subscribe/en/news/region/africa/feed/rss.xml", source: "UN News Africa", maxItems: 50 },
  { url: "https://www.theguardian.com/world/africa/rss", source: "Guardian Africa", maxItems: 40 },
];

/** Country code → keywords for matching pan-African articles to countries.
 *  Includes country name, demonym, capital, and major cities. */
const PAN_AFRICAN_KEYWORDS: Record<string, string[]> = {
  ZA: ["South Africa", "South African", "Johannesburg", "Cape Town", "Pretoria", "Durban"],
  EG: ["Egypt", "Egyptian", "Cairo", "Alexandria"],
  NG: ["Nigeria", "Nigerian", "Lagos", "Abuja"],
  KE: ["Kenya", "Kenyan", "Nairobi", "Mombasa"],
  MA: ["Morocco", "Moroccan", "Rabat", "Casablanca", "Marrakech"],
  GH: ["Ghana", "Ghanaian", "Accra"],
  TZ: ["Tanzania", "Tanzanian", "Dar es Salaam", "Dodoma"],
  ET: ["Ethiopia", "Ethiopian", "Addis Ababa"],
  UG: ["Uganda", "Ugandan", "Kampala"],
  SN: ["Senegal", "Senegalese", "Dakar"],
  CI: ["Ivory Coast", "Ivorian", "Abidjan"],
  CM: ["Cameroon", "Cameroonian", "Douala"],
  DZ: ["Algeria", "Algerian", "Algiers"],
  TN: ["Tunisia", "Tunisian", "Tunis"],
  BW: ["Botswana", "Gaborone"],
  ZW: ["Zimbabwe", "Zimbabwean", "Harare", "Bulawayo"],
  AO: ["Angola", "Angolan", "Luanda"],
  MZ: ["Mozambique", "Mozambican", "Maputo"],
  RW: ["Rwanda", "Rwandan", "Kigali"],
  NA: ["Namibia", "Namibian", "Windhoek"],
  BJ: ["Benin", "Beninese", "Porto-Novo", "Cotonou"],
  BF: ["Burkina Faso", "Burkinabe", "Ouagadougou"],
  BI: ["Burundi", "Burundian", "Bujumbura", "Gitega"],
  CV: ["Cape Verde", "Cabo Verde", "Praia"],
  CF: ["Central African Republic", "Bangui"],
  TD: ["Chad", "Chadian", "N'Djamena"],
  KM: ["Comoros", "Comorian", "Moroni"],
  CG: ["Congo-Brazzaville", "Republic of Congo", "Brazzaville"],
  CD: ["DR Congo", "DRC", "Kinshasa", "Democratic Republic of Congo", "Congo-Kinshasa"],
  DJ: ["Djibouti", "Djiboutian"],
  GQ: ["Equatorial Guinea", "Malabo"],
  ER: ["Eritrea", "Eritrean", "Asmara"],
  SZ: ["Eswatini", "Swaziland", "Swazi", "Mbabane"],
  GA: ["Gabon", "Gabonese", "Libreville"],
  GM: ["Gambia", "Gambian", "Banjul"],
  GN: ["Guinea", "Guinean", "Conakry"],
  GW: ["Guinea-Bissau", "Bissau"],
  LS: ["Lesotho", "Maseru"],
  LR: ["Liberia", "Liberian", "Monrovia"],
  LY: ["Libya", "Libyan", "Tripoli", "Benghazi"],
  MG: ["Madagascar", "Malagasy", "Antananarivo"],
  MW: ["Malawi", "Malawian", "Lilongwe", "Blantyre"],
  ML: ["Mali", "Malian", "Bamako"],
  MR: ["Mauritania", "Mauritanian", "Nouakchott"],
  MU: ["Mauritius", "Mauritian", "Port Louis"],
  NE: ["Niger", "Nigerien", "Niamey"],
  ST: ["Sao Tome", "São Tomé"],
  SC: ["Seychelles", "Seychellois"],
  SL: ["Sierra Leone", "Freetown", "Sierra Leonean"],
  SO: ["Somalia", "Somali", "Mogadishu", "Somaliland"],
  SS: ["South Sudan", "Juba"],
  SD: ["Sudan", "Sudanese", "Khartoum"],
  TG: ["Togo", "Togolese"],
  ZM: ["Zambia", "Zambian", "Lusaka"],
};

// ── Pan-European RSS Feeds ───────────────────────────────────────────────

const PAN_EUROPEAN_FEED_URLS = [
  { url: "https://www.euronews.com/rss", source: "Euronews", maxItems: 80 },
  { url: "https://www.france24.com/en/europe/rss", source: "France24 Europe", maxItems: 50 },
];

/** All European country codes in the system */
const EUROPEAN_COUNTRIES = new Set([
  "GB", "DE", "FR", "IT", "ES", "NL", "CH", "SE", "NO", "DK", "FI", "PL",
  "AT", "IE", "PT", "GR", "CZ", "HU", "RO", "SK", "BG", "RS", "UA", "RU",
  "BE", "HR", "SI", "LT", "LV", "EE", "IS", "LU",
  // 8 new
  "AL", "BA", "BY", "CY", "MD", "ME", "MK", "XK",
]);

const PAN_EUROPEAN_KEYWORDS: Record<string, string[]> = {
  GB: ["Britain", "British", "UK", "United Kingdom", "London", "England", "Scotland", "Wales"],
  DE: ["Germany", "German", "Berlin", "Munich", "Frankfurt"],
  FR: ["France", "French", "Paris", "Macron"],
  IT: ["Italy", "Italian", "Rome", "Milan"],
  ES: ["Spain", "Spanish", "Madrid", "Barcelona"],
  NL: ["Netherlands", "Dutch", "Amsterdam", "The Hague"],
  CH: ["Switzerland", "Swiss", "Zurich", "Geneva", "Bern"],
  SE: ["Sweden", "Swedish", "Stockholm"],
  NO: ["Norway", "Norwegian", "Oslo"],
  DK: ["Denmark", "Danish", "Copenhagen"],
  FI: ["Finland", "Finnish", "Helsinki"],
  PL: ["Poland", "Polish", "Warsaw", "Krakow"],
  AT: ["Austria", "Austrian", "Vienna"],
  IE: ["Ireland", "Irish", "Dublin"],
  PT: ["Portugal", "Portuguese", "Lisbon"],
  GR: ["Greece", "Greek", "Athens"],
  CZ: ["Czech", "Prague", "Czechia"],
  HU: ["Hungary", "Hungarian", "Budapest", "Orban"],
  RO: ["Romania", "Romanian", "Bucharest"],
  SK: ["Slovakia", "Slovak", "Bratislava"],
  BG: ["Bulgaria", "Bulgarian", "Sofia"],
  RS: ["Serbia", "Serbian", "Belgrade"],
  UA: ["Ukraine", "Ukrainian", "Kyiv", "Kiev", "Kharkiv", "Zelensky"],
  RU: ["Russia", "Russian", "Moscow", "Kremlin", "Putin"],
  BE: ["Belgium", "Belgian", "Brussels"],
  HR: ["Croatia", "Croatian", "Zagreb"],
  SI: ["Slovenia", "Slovenian", "Ljubljana"],
  LT: ["Lithuania", "Lithuanian", "Vilnius"],
  LV: ["Latvia", "Latvian", "Riga"],
  EE: ["Estonia", "Estonian", "Tallinn"],
  IS: ["Iceland", "Icelandic", "Reykjavik"],
  LU: ["Luxembourg"],
  AL: ["Albania", "Albanian", "Tirana"],
  BA: ["Bosnia", "Bosnian", "Sarajevo", "Herzegovina"],
  BY: ["Belarus", "Belarusian", "Minsk", "Lukashenko"],
  CY: ["Cyprus", "Cypriot", "Nicosia"],
  MD: ["Moldova", "Moldovan", "Chisinau"],
  ME: ["Montenegro", "Montenegrin", "Podgorica"],
  MK: ["Macedonia", "Macedonian", "Skopje", "North Macedonia"],
  XK: ["Kosovo", "Kosovar", "Pristina"],
};

// ── Pan-Middle East RSS Feeds ────────────────────────────────────────────

const PAN_ME_FEED_URLS = [
  { url: "https://www.aljazeera.com/xml/rss/all.xml", source: "Al Jazeera", maxItems: 50 },
  { url: "https://www.middleeasteye.net/rss", source: "Middle East Eye", maxItems: 40 },
  { url: "https://www.france24.com/en/middle-east/rss", source: "France24 ME", maxItems: 50 },
];

/** All Middle East country codes in the system */
const ME_COUNTRIES = new Set([
  "IL", "AE", "SA", "QA", "KW", "BH", "OM", "JO", "TR",
  // 6 new
  "IR", "IQ", "LB", "PS", "SY", "YE",
]);

const PAN_ME_KEYWORDS: Record<string, string[]> = {
  IL: ["Israel", "Israeli", "Tel Aviv", "Jerusalem", "Netanyahu", "Gaza"],
  AE: ["UAE", "Emirati", "Dubai", "Abu Dhabi", "Emirates"],
  SA: ["Saudi", "Saudi Arabia", "Riyadh", "Jeddah"],
  QA: ["Qatar", "Qatari", "Doha"],
  KW: ["Kuwait", "Kuwaiti"],
  BH: ["Bahrain", "Bahraini", "Manama"],
  OM: ["Oman", "Omani", "Muscat"],
  JO: ["Jordan", "Jordanian", "Amman"],
  TR: ["Turkey", "Turkish", "Ankara", "Istanbul", "Erdogan"],
  IR: ["Iran", "Iranian", "Tehran", "IRGC", "Ayatollah"],
  IQ: ["Iraq", "Iraqi", "Baghdad", "Mosul", "Basra", "Kurdistan"],
  LB: ["Lebanon", "Lebanese", "Beirut", "Hezbollah"],
  PS: ["Palestine", "Palestinian", "West Bank", "Gaza", "Ramallah"],
  SY: ["Syria", "Syrian", "Damascus", "Aleppo", "Assad"],
  YE: ["Yemen", "Yemeni", "Houthi", "Sanaa", "Aden"],
};

// ── Pan-Asia-Pacific RSS Feeds ──────────────────────────────────────────

const PAN_ASIA_FEED_URLS = [
  { url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml", source: "BBC Asia", maxItems: 40 },
  { url: "https://www.france24.com/en/asia-pacific/rss", source: "France24 Asia", maxItems: 50 },
];

const ASIA_PACIFIC_COUNTRIES = new Set([
  "JP", "CN", "KR", "HK", "TW", "IN", "SG", "ID", "TH", "MY", "PH", "PK",
  "AU", "NZ", "VN", "BD", "LK", "KZ", "MM", "MN", "KP", "AF", "NP", "BT",
  "TM", "UZ", "KG", "TJ", "BN", "KH", "LA", "TL", "FJ", "PG", "NC", "SB", "VU",
]);

const PAN_ASIA_KEYWORDS: Record<string, string[]> = {
  JP: ["Japan", "Japanese", "Tokyo", "Osaka"],
  CN: ["China", "Chinese", "Beijing", "Shanghai", "Xi Jinping"],
  KR: ["South Korea", "Korean", "Seoul"],
  HK: ["Hong Kong"],
  TW: ["Taiwan", "Taiwanese", "Taipei"],
  IN: ["India", "Indian", "New Delhi", "Mumbai", "Modi"],
  SG: ["Singapore", "Singaporean"],
  ID: ["Indonesia", "Indonesian", "Jakarta"],
  TH: ["Thailand", "Thai", "Bangkok"],
  MY: ["Malaysia", "Malaysian", "Kuala Lumpur"],
  PH: ["Philippines", "Filipino", "Manila", "Duterte", "Marcos"],
  PK: ["Pakistan", "Pakistani", "Islamabad", "Karachi", "Lahore"],
  AU: ["Australia", "Australian", "Sydney", "Melbourne", "Canberra"],
  NZ: ["New Zealand", "Kiwi", "Wellington", "Auckland"],
  VN: ["Vietnam", "Vietnamese", "Hanoi", "Ho Chi Minh"],
  BD: ["Bangladesh", "Bangladeshi", "Dhaka"],
  LK: ["Sri Lanka", "Sri Lankan", "Colombo"],
  KZ: ["Kazakhstan", "Kazakh", "Astana", "Almaty"],
  MM: ["Myanmar", "Burma", "Burmese", "Yangon", "Naypyidaw"],
  MN: ["Mongolia", "Mongolian", "Ulaanbaatar"],
  KP: ["North Korea", "Pyongyang", "Kim Jong"],
  AF: ["Afghanistan", "Afghan", "Kabul", "Taliban"],
  NP: ["Nepal", "Nepali", "Kathmandu"],
  BT: ["Bhutan", "Bhutanese", "Thimphu"],
  TM: ["Turkmenistan", "Turkmen", "Ashgabat"],
  UZ: ["Uzbekistan", "Uzbek", "Tashkent"],
  KG: ["Kyrgyzstan", "Kyrgyz", "Bishkek"],
  TJ: ["Tajikistan", "Tajik", "Dushanbe"],
  BN: ["Brunei", "Bruneian", "Bandar Seri Begawan"],
  KH: ["Cambodia", "Cambodian", "Phnom Penh"],
  LA: ["Laos", "Laotian", "Vientiane"],
  TL: ["Timor-Leste", "East Timor", "Timorese", "Dili"],
  FJ: ["Fiji", "Fijian", "Suva"],
  PG: ["Papua New Guinea", "Port Moresby"],
  NC: ["New Caledonia", "Noumea"],
  SB: ["Solomon Islands", "Honiara"],
  VU: ["Vanuatu", "Port Vila"],
};

// ── Pan-Americas RSS Feeds ──────────────────────────────────────────────

const PAN_AMERICAS_FEED_URLS = [
  { url: "https://feeds.bbci.co.uk/news/world/latin_america/rss.xml", source: "BBC Latin America", maxItems: 40 },
  { url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml", source: "BBC US & Canada", maxItems: 40 },
  { url: "https://www.france24.com/en/americas/rss", source: "France24 Americas", maxItems: 50 },
];

const AMERICAS_COUNTRIES = new Set([
  "US", "CA", "MX", "BR", "AR", "CO", "CL", "PE", "VE",
  "EC", "BO", "PY", "UY", "GY", "SR",
  "GT", "CR", "PA", "HN", "SV", "NI", "BZ",
  "CU", "DO", "HT", "JM", "BS", "PR", "TT", "FK",
]);

const PAN_AMERICAS_KEYWORDS: Record<string, string[]> = {
  US: ["United States", "American", "Washington", "White House", "Congress", "Biden", "Trump"],
  CA: ["Canada", "Canadian", "Ottawa", "Toronto", "Trudeau"],
  MX: ["Mexico", "Mexican", "Mexico City"],
  BR: ["Brazil", "Brazilian", "Brasilia", "Sao Paulo", "Lula"],
  AR: ["Argentina", "Argentine", "Buenos Aires", "Milei"],
  CO: ["Colombia", "Colombian", "Bogota"],
  CL: ["Chile", "Chilean", "Santiago"],
  PE: ["Peru", "Peruvian", "Lima"],
  VE: ["Venezuela", "Venezuelan", "Caracas", "Maduro"],
  EC: ["Ecuador", "Ecuadorian", "Quito", "Guayaquil"],
  BO: ["Bolivia", "Bolivian", "La Paz", "Sucre"],
  PY: ["Paraguay", "Paraguayan", "Asuncion"],
  UY: ["Uruguay", "Uruguayan", "Montevideo"],
  GY: ["Guyana", "Guyanese", "Georgetown"],
  SR: ["Suriname", "Surinamese", "Paramaribo"],
  GT: ["Guatemala", "Guatemalan"],
  CR: ["Costa Rica", "Costa Rican", "San Jose"],
  PA: ["Panama", "Panamanian", "Panama Canal"],
  HN: ["Honduras", "Honduran", "Tegucigalpa"],
  SV: ["El Salvador", "Salvadoran", "Bukele"],
  NI: ["Nicaragua", "Nicaraguan", "Managua"],
  BZ: ["Belize", "Belizean", "Belmopan"],
  CU: ["Cuba", "Cuban", "Havana"],
  DO: ["Dominican Republic", "Dominican", "Santo Domingo"],
  HT: ["Haiti", "Haitian", "Port-au-Prince"],
  JM: ["Jamaica", "Jamaican", "Kingston"],
  BS: ["Bahamas", "Bahamian", "Nassau"],
  PR: ["Puerto Rico", "Puerto Rican", "San Juan"],
  TT: ["Trinidad", "Tobago", "Trinidadian", "Port of Spain"],
  FK: ["Falkland", "Malvinas"],
};

// ── Pan-Global RSS Feeds ────────────────────────────────────────────────
// BBC World + France24 global cover ALL countries. Cached once globally.

const PAN_GLOBAL_FEED_URLS = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC World", maxItems: 50 },
  { url: "https://www.france24.com/en/rss", source: "France24", maxItems: 50 },
];

// Merge ALL keyword maps so Pan-Global can match any country
const PAN_GLOBAL_KEYWORDS: Record<string, string[]> = {
  ...PAN_AFRICAN_KEYWORDS,
  ...PAN_EUROPEAN_KEYWORDS,
  ...PAN_ME_KEYWORDS,
  ...PAN_ASIA_KEYWORDS,
  ...PAN_AMERICAS_KEYWORDS,
  // Territories not in other maps
  GL: ["Greenland", "Greenlandic", "Nuuk"],
  EH: ["Western Sahara", "Sahrawi"],
  AM: ["Armenia", "Armenian", "Yerevan"],
  AZ: ["Azerbaijan", "Azerbaijani", "Baku"],
  GE: ["Georgia", "Georgian", "Tbilisi"],
};

/**
 * Parse RSS 2.0 XML into NewsItem[].
 * Uses regex — safe for the rigid, well-defined RSS format.
 */
function parseRssItems(xml: string, countryCode: string): NewsItem[] {
  const items: NewsItem[] = [];
  // Match each <item>...</item> block
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

  for (let i = 0; i < Math.min(itemBlocks.length, 30); i++) {
    const block = itemBlocks[i];

    // Extract fields — handle both CDATA and plain text
    const title = extractXmlField(block, "title");
    const link = extractXmlField(block, "link");
    const desc = extractXmlField(block, "description");
    const pubDate = extractXmlField(block, "pubDate");

    if (!title || !link) continue;

    items.push({
      id: `rss-allafrica-${countryCode}-${i}-${Date.now()}`,
      title,
      summary: desc || title,
      source: "AllAfrica",
      url: link,
      imageUrl: undefined,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      relatedSymbols: [],
    });
  }

  return items;
}

function extractXmlField(block: string, tag: string): string {
  // Try CDATA first: <tag><![CDATA[...]]></tag>
  const cdataMatch = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`));
  if (cdataMatch) return cdataMatch[1].trim();
  // Plain text: <tag>...</tag>
  const plainMatch = block.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`));
  if (plainMatch) return plainMatch[1].trim();
  return "";
}

/**
 * Fetch an AllAfrica RSS feed for a country.
 * FREE — no API key, no rate limits, no daily quota.
 */
async function fetchAllAfricaRss(countryCode: string): Promise<NewsItem[]> {
  const slug = ALLAFRICA_FEEDS[countryCode];
  if (!slug) return [];

  const url = `https://allafrica.com/tools/headlines/rdf/${slug}/headlines.rdf`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) {
      console.warn(`AllAfrica RSS ${countryCode}: HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const items = parseRssItems(xml, countryCode);
    console.log(`AllAfrica RSS ${countryCode}: ${items.length} articles`);
    return items;
  } catch (e) {
    console.error(`AllAfrica RSS error: ${e}`);
    return [];
  }
}

/**
 * Fetch the pan-African business feed (https://allafrica.com/business/).
 * Used as supplement for African countries with sparse country-specific feeds.
 * FREE — no API key, no rate limits.
 */
async function fetchAllAfricaBusiness(countryCode: string): Promise<NewsItem[]> {
  const url = "https://allafrica.com/tools/headlines/rdf/business/headlines.rdf";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = parseRssItems(xml, countryCode);
    // Tag these as business feed so they're distinguishable
    return items.map((item) => ({
      ...item,
      id: item.id.replace("rss-allafrica-", "rss-allafrica-biz-"),
      source: "AllAfrica Business",
    }));
  } catch (e) {
    console.error(`AllAfrica Business RSS error: ${e}`);
    return [];
  }
}

// ── Pan-Regional feed parser & distributor ────────────────────────────────
// Generalized system: fetch RSS feeds ONCE per region, cache under a shared
// key, then keyword-match articles to individual countries.

/**
 * Parse RSS 2.0 XML from pan-regional sources.
 * Strips HTML from descriptions, extracts images from media tags.
 */
function parsePanRegionalRss(xml: string, source: string, maxItems: number): NewsItem[] {
  const items: NewsItem[] = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

  for (let i = 0; i < Math.min(itemBlocks.length, maxItems); i++) {
    const block = itemBlocks[i];
    const title = extractXmlField(block, "title");
    const link = extractXmlField(block, "link");
    const rawDesc = extractXmlField(block, "description");
    const pubDate = extractXmlField(block, "pubDate");
    if (!title || !link) continue;

    const desc = rawDesc ? rawDesc.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').slice(0, 300) : title;

    let imageUrl: string | undefined;
    const mediaMatch = block.match(/url="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp)[^"]*)"/i);
    if (mediaMatch) imageUrl = mediaMatch[1];

    items.push({
      id: `rss-pan-${source.replace(/\s+/g, "").toLowerCase()}-${i}`,
      title,
      summary: desc,
      source,
      url: link,
      imageUrl,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      relatedSymbols: [],
    });
  }
  return items;
}

/**
 * Fetch pan-regional RSS feeds in parallel with DB caching.
 * @param cacheKey  Special key like "_PAN_AFRICA", "_PAN_EUROPE", "_PAN_MIDEAST"
 * @param feedUrls  Array of { url, source, maxItems }
 */
async function fetchPanRegionalFeeds(
  cacheKey: string,
  feedUrls: { url: string; source: string; maxItems: number }[],
): Promise<NewsItem[]> {
  const cached = await getCachedNews(cacheKey);
  if (cached) {
    console.log(`${cacheKey}: cache HIT (${cached.length} articles)`);
    return cached;
  }

  console.log(`${cacheKey}: cache MISS, fetching ${feedUrls.length} feeds...`);
  const results = await Promise.all(
    feedUrls.map(async ({ url, source, maxItems }) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) {
          console.warn(`${cacheKey} ${source}: HTTP ${res.status}`);
          return [];
        }
        const xml = await res.text();
        const items = parsePanRegionalRss(xml, source, maxItems);
        console.log(`${cacheKey} ${source}: ${items.length} articles`);
        return items;
      } catch (e) {
        console.error(`${cacheKey} ${source} error: ${e}`);
        return [];
      }
    }),
  );

  const all = results.flat();
  if (all.length > 0) {
    setCachedNews(cacheKey, all, feedUrls.map((f) => f.source)).catch(() => {});
  }
  console.log(`${cacheKey}: ${all.length} total articles cached`);
  return all;
}

/**
 * Filter pan-regional articles for a specific country using keyword matching.
 * Uses word-boundary regex to avoid "Niger" matching "Nigeria", etc.
 *
 * TITLE-ONLY MATCHING: only checks keywords against the headline.
 * Wire services always name the primary country in the title. Matching
 * on the full body text caused unrelated articles to leak in whenever a
 * country was mentioned in passing (e.g. "German tourists" in an Angola
 * article would show up under Germany).
 */
function filterForCountry(
  articles: NewsItem[],
  countryCode: string,
  keywordMap: Record<string, string[]>,
): NewsItem[] {
  const keywords = keywordMap[countryCode];
  if (!keywords || keywords.length === 0) return [];

  const patterns = keywords.map((kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i");
  });

  return articles
    .filter((article) => {
      // Only match keywords in the TITLE — not the summary/body.
      // This ensures articles are primarily ABOUT events in this country,
      // not merely mentioning it in passing.
      return patterns.some((p) => p.test(article.title));
    })
    .map((article) => ({
      ...article,
      id: `${article.id}-${countryCode}`,
    }));
}

// Convenience wrappers for each region
function fetchPanAfricanFeeds() {
  // _PAN_AFRICA_v2 cache key — bumped from _PAN_AFRICA when we expanded from
  // 3 to 9 pan-African feeds. The version bump invalidates any stale cache
  // entry written with the smaller feed set so users immediately see the
  // expanded coverage rather than waiting up to 6h for the old cache to expire.
  return fetchPanRegionalFeeds("_PAN_AFRICA_v2", PAN_AFRICAN_FEED_URLS);
}
function filterPanAfricanForCountry(articles: NewsItem[], cc: string) {
  return filterForCountry(articles, cc, PAN_AFRICAN_KEYWORDS);
}
function fetchPanEuropeanFeeds() {
  return fetchPanRegionalFeeds("_PAN_EUROPE", PAN_EUROPEAN_FEED_URLS);
}
function filterPanEuropeanForCountry(articles: NewsItem[], cc: string) {
  return filterForCountry(articles, cc, PAN_EUROPEAN_KEYWORDS);
}
function fetchPanMEFeeds() {
  return fetchPanRegionalFeeds("_PAN_MIDEAST", PAN_ME_FEED_URLS);
}
function filterPanMEForCountry(articles: NewsItem[], cc: string) {
  return filterForCountry(articles, cc, PAN_ME_KEYWORDS);
}
function fetchPanAsiaFeeds() {
  return fetchPanRegionalFeeds("_PAN_ASIA", PAN_ASIA_FEED_URLS);
}
function filterPanAsiaForCountry(articles: NewsItem[], cc: string) {
  return filterForCountry(articles, cc, PAN_ASIA_KEYWORDS);
}
function fetchPanAmericasFeeds() {
  return fetchPanRegionalFeeds("_PAN_AMERICAS", PAN_AMERICAS_FEED_URLS);
}
function filterPanAmericasForCountry(articles: NewsItem[], cc: string) {
  return filterForCountry(articles, cc, PAN_AMERICAS_KEYWORDS);
}
function fetchPanGlobalFeeds() {
  return fetchPanRegionalFeeds("_PAN_GLOBAL", PAN_GLOBAL_FEED_URLS);
}
function filterPanGlobalForCountry(articles: NewsItem[], cc: string) {
  return filterForCountry(articles, cc, PAN_GLOBAL_KEYWORDS);
}

// ── Translation ────────────────────────────────────────────────────────────

const ENGLISH_COUNTRIES = new Set(["US", "GB", "CA", "AU", "NZ", "IE", "SG"]);

async function batchTranslate(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return [];

  const SEPARATOR = " ||| ";
  const joined = texts.join(SEPARATOR);

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(joined)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) {
      console.warn(`Translation HTTP ${res.status}`);
      return texts;
    }
    const data = await res.json();
    const translated = (data?.[0] || []).map((s: any) => s[0] || "").join("");
    const parts = translated.split(/\s*\|\|\|\s*/);

    if (parts.length === texts.length) return parts;
    return texts.map((t, i) => parts[i] || t);
  } catch (e) {
    console.warn(`Translation error: ${e}`);
    return texts;
  }
}

async function translateNewsItems(items: NewsItem[], country: string): Promise<NewsItem[]> {
  if (!country || ENGLISH_COUNTRIES.has(country)) return items;

  const needsTranslation: number[] = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].id.startsWith("gnews-") || items[i].id.startsWith("newsapi-")) {
      needsTranslation.push(i);
    }
  }

  if (needsTranslation.length === 0) return items;

  console.log(`Translating ${needsTranslation.length} articles for country=${country}`);

  const titles = needsTranslation.map((i) => items[i].title);
  const summaries = needsTranslation.map((i) => items[i].summary.slice(0, 200));

  const [translatedTitles, translatedSummaries] = await Promise.all([
    batchTranslate(titles),
    batchTranslate(summaries),
  ]);

  const result = [...items];
  for (let j = 0; j < needsTranslation.length; j++) {
    const idx = needsTranslation[j];
    result[idx] = {
      ...result[idx],
      title: translatedTitles[j] || result[idx].title,
      summary: translatedSummaries[j] || result[idx].summary,
    };
  }

  return result;
}

// ── API Keys ────────────────────────────────────────────────────────────────

function getFinnhubKey(): string {
  const key = Deno.env.get("FINNHUB_API_KEY");
  if (key && key.length >= 20) return key;
  return "d6hubv9r01qr5k4dbeo0d6hubv9r01qr5k4dbeog";
}

function getGNewsKeys(): { primary: string; supplemental: string[] } {
  const primary = Deno.env.get("GNEWS_API_KEY") || "";
  const supplemental: string[] = [];
  for (let i = 2; i <= 10; i++) {
    const extra = Deno.env.get(`GNEWS_API_KEY_${i}`);
    if (extra) supplemental.push(extra);
  }
  return { primary, supplemental };
}

function pickGNewsKey(
  keys: { primary: string; supplemental: string[] },
  country: string,
  isSearchFallback: boolean,
): string {
  if (isSearchFallback && keys.supplemental.length > 0) {
    if (keys.supplemental.length === 1) return keys.supplemental[0];
    let hash = 0;
    for (let i = 0; i < country.length; i++) hash += country.charCodeAt(i);
    return keys.supplemental[hash % keys.supplemental.length];
  }
  return keys.primary;
}

// ── DB Cache (PostgREST) ────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function getCachedNews(country: string): Promise<NewsItem[] | null> {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/news_cache?country_code=eq.${country}&select=response_json,cached_at`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        signal: AbortSignal.timeout(3_000),
      },
    );
    if (!res.ok) {
      console.warn(`Cache read failed: ${res.status}`);
      return null;
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const row = rows[0];
    const age = Date.now() - new Date(row.cached_at).getTime();
    if (age > CACHE_TTL_MS) {
      console.log(`Cache STALE for ${country} (${Math.round(age / 60_000)}min old)`);
      return null;
    }

    console.log(`Cache HIT for ${country} (${Math.round(age / 60_000)}min old)`);
    return row.response_json;
  } catch (e) {
    console.warn(`Cache read error: ${e}`);
    return null;
  }
}

async function setCachedNews(country: string, news: NewsItem[], sourceLabels: string[]): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) return;

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/news_cache`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        country_code: country,
        response_json: news,
        source_labels: sourceLabels,
        article_count: news.length,
        cached_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(3_000),
    });
  } catch (e) {
    console.warn(`Cache write error: ${e}`);
  }
}

// ── GNews.io ────────────────────────────────────────────────────────────────

async function fetchGNews(country: string, apiKey: string): Promise<NewsItem[]> {
  const url = `${GNEWS_BASE}?country=${country.toLowerCase()}&category=business&max=10&apikey=${apiKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 429) { await res.text(); console.warn("GNews rate limited"); return []; }
    if (!res.ok) { await res.text(); return []; }
    const data = await res.json();
    const articles = Array.isArray(data?.articles) ? data.articles : [];
    return articles.map((a: any, i: number) => ({
      id: `gnews-${country}-${i}-${Date.now()}`,
      title: a.title || "",
      summary: a.description || a.content || "",
      source: a.source?.name || "Unknown",
      url: a.url || "",
      imageUrl: a.image && a.image.startsWith("http") ? a.image : undefined,
      publishedAt: a.publishedAt ? new Date(a.publishedAt).toISOString() : new Date().toISOString(),
      relatedSymbols: [],
    }));
  } catch (e) {
    console.error(`GNews error: ${e}`);
    return [];
  }
}

async function fetchGNewsSearch(countryName: string, countryCode: string, apiKey: string): Promise<NewsItem[]> {
  const query = encodeURIComponent(`"${countryName}" AND (economy OR business OR market)`);
  const url = `https://gnews.io/api/v4/search?q=${query}&lang=en&max=10&apikey=${apiKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 429) { await res.text(); console.warn("GNews search rate limited"); return []; }
    if (!res.ok) { await res.text(); return []; }
    const data = await res.json();
    const articles = Array.isArray(data?.articles) ? data.articles : [];
    return articles.map((a: any, i: number) => ({
      id: `gnews-search-${countryCode}-${i}-${Date.now()}`,
      title: a.title || "",
      summary: a.description || a.content || "",
      source: a.source?.name || "Unknown",
      url: a.url || "",
      imageUrl: a.image && a.image.startsWith("http") ? a.image : undefined,
      publishedAt: a.publishedAt ? new Date(a.publishedAt).toISOString() : new Date().toISOString(),
      relatedSymbols: [],
    }));
  } catch (e) {
    console.error(`GNews search error: ${e}`);
    return [];
  }
}

// ── NewsAPI.org ──────────────────────────────────────────────────────────────

async function fetchNewsApiHeadlines(country: string, apiKey: string): Promise<NewsItem[]> {
  const url = `${NEWSAPI_BASE}/top-headlines?country=${country.toLowerCase()}&category=business&pageSize=20&apiKey=${apiKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 429) { await res.text(); console.warn("NewsAPI rate limited"); return []; }
    if (!res.ok) { await res.text(); return []; }
    const data = await res.json();
    const articles = Array.isArray(data?.articles) ? data.articles : [];
    return articles
      .filter((a: any) => a.title && a.title !== "[Removed]")
      .map((a: any, i: number) => ({
        id: `newsapi-${country}-${i}-${Date.now()}`,
        title: a.title || "",
        summary: a.description || a.content || "",
        source: a.source?.name || "Unknown",
        url: a.url || "",
        imageUrl: a.urlToImage && a.urlToImage.startsWith("http") ? a.urlToImage : undefined,
        publishedAt: a.publishedAt ? new Date(a.publishedAt).toISOString() : new Date().toISOString(),
        relatedSymbols: [],
      }));
  } catch (e) {
    console.error(`NewsAPI headlines error: ${e}`);
    return [];
  }
}

async function fetchNewsApiSearch(countryName: string, countryCode: string, apiKey: string): Promise<NewsItem[]> {
  const query = encodeURIComponent(`"${countryName}" AND (economy OR business OR market OR trade)`);
  const url = `${NEWSAPI_BASE}/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 429) { await res.text(); console.warn("NewsAPI search rate limited"); return []; }
    if (!res.ok) { await res.text(); return []; }
    const data = await res.json();
    const articles = Array.isArray(data?.articles) ? data.articles : [];
    return articles
      .filter((a: any) => a.title && a.title !== "[Removed]")
      .map((a: any, i: number) => ({
        id: `newsapi-search-${countryCode}-${i}-${Date.now()}`,
        title: a.title || "",
        summary: a.description || a.content || "",
        source: a.source?.name || "Unknown",
        url: a.url || "",
        imageUrl: a.urlToImage && a.urlToImage.startsWith("http") ? a.urlToImage : undefined,
        publishedAt: a.publishedAt ? new Date(a.publishedAt).toISOString() : new Date().toISOString(),
        relatedSymbols: [],
      }));
  } catch (e) {
    console.error(`NewsAPI search error: ${e}`);
    return [];
  }
}

// ── MarketAux ───────────────────────────────────────────────────────────────

async function fetchMarketAux(country: string, apiKey: string): Promise<NewsItem[]> {
  const url = `${MARKETAUX_BASE}?countries=${country.toLowerCase()}&language=en&filter_entities=true&limit=10&api_token=${apiKey}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 429) { await res.text(); console.warn("MarketAux rate limited"); return []; }
    if (!res.ok) { await res.text(); return []; }
    const data = await res.json();
    const articles = Array.isArray(data?.data) ? data.data : [];
    return articles.map((a: any) => ({
      id: `maux-${a.uuid || Date.now()}`,
      title: a.title || "",
      summary: a.description || a.snippet || "",
      source: a.source || "Unknown",
      url: a.url || "",
      imageUrl: a.image_url && a.image_url.startsWith("http") ? a.image_url : undefined,
      publishedAt: a.published_at ? new Date(a.published_at).toISOString() : new Date().toISOString(),
      relatedSymbols: (a.entities || []).map((e: any) => e.symbol).filter(Boolean),
    }));
  } catch (e) {
    console.error(`MarketAux error: ${e}`);
    return [];
  }
}

// ── NewsData.io ─────────────────────────────────────────────────────────────
// Universal country coverage (60+ ISO2 codes), free tier 200/day. The
// per-country `country=` filter is server-side, so results are real news
// FROM the country (not just ABOUT it). Excellent fit for under-covered
// regions where our other sources are thin.

async function fetchNewsData(country: string, apiKey: string): Promise<NewsItem[]> {
  const url = `${NEWSDATA_BASE}?apikey=${apiKey}&country=${country.toLowerCase()}&language=en&size=10`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 429) { await res.text(); console.warn("NewsData.io rate limited"); return []; }
    if (!res.ok) { await res.text(); console.warn(`NewsData.io ${country}: HTTP ${res.status}`); return []; }
    const data = await res.json();
    if (data?.status !== "success") return [];
    const articles = Array.isArray(data.results) ? data.results : [];
    return articles.map((a: any, i: number) => ({
      id: `newsdata-${country}-${a.article_id || i}-${Date.now()}`,
      title: a.title || "",
      summary: a.description || a.content || "",
      source: a.source_name || a.source_id || "NewsData",
      url: a.link || "",
      imageUrl: a.image_url && a.image_url.startsWith("http") ? a.image_url : undefined,
      publishedAt: a.pubDate ? new Date(a.pubDate).toISOString() : new Date().toISOString(),
      relatedSymbols: [],
    })).filter((n: NewsItem) => n.title && n.url);
  } catch (e) {
    console.error(`NewsData.io error: ${e}`);
    return [];
  }
}

// ── Currents API ────────────────────────────────────────────────────────────
// Limited country support (~50 countries — see CURRENTS_COUNTRIES). Free
// tier 600/day. Returns articles tagged with country. Skipped for unsupported
// countries to avoid burning quota on guaranteed 400s.

async function fetchCurrents(country: string, apiKey: string): Promise<NewsItem[]> {
  const url = `${CURRENTS_BASE}?apiKey=${apiKey}&country=${country.toUpperCase()}&page_size=15`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 429) { await res.text(); console.warn("Currents API rate limited"); return []; }
    if (!res.ok) { await res.text(); console.warn(`Currents ${country}: HTTP ${res.status}`); return []; }
    const data = await res.json();
    if (data?.status !== "ok") return [];
    const articles = Array.isArray(data.news) ? data.news : [];
    return articles.map((a: any) => ({
      id: `currents-${country}-${a.id || Date.now()}`,
      title: a.title || "",
      summary: a.description || "",
      source: a.author || "Currents",
      url: a.url || "",
      imageUrl: a.image && a.image !== "None" && a.image.startsWith("http") ? a.image : undefined,
      publishedAt: a.published ? new Date(a.published).toISOString() : new Date().toISOString(),
      relatedSymbols: [],
    })).filter((n: NewsItem) => n.title && n.url);
  } catch (e) {
    console.error(`Currents error: ${e}`);
    return [];
  }
}

// ── Finnhub ─────────────────────────────────────────────────────────────────

interface FinnhubItem {
  id: number;
  datetime: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  image: string;
  related: string;
}

async function fetchFinnhubJson(url: string): Promise<FinnhubItem[]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) { console.error(`Finnhub ${res.status}`); return []; }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error(`Finnhub error: ${e}`);
    return [];
  }
}

function finnhubToNewsItem(item: FinnhubItem): NewsItem {
  return {
    id: String(item.id),
    title: item.headline,
    summary: item.summary || item.headline,
    source: item.source,
    url: item.url,
    imageUrl: item.image && item.image.startsWith("http") ? item.image : undefined,
    publishedAt: new Date(item.datetime * 1000).toISOString(),
    relatedSymbols: item.related ? [item.related] : [],
  };
}

// ── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const finnhubKey = getFinnhubKey();
  const gnewsKeys = getGNewsKeys();
  const marketauxKey = Deno.env.get("MARKETAUX_API_KEY");
  const newsapiKey = Deno.env.get("NEWSAPI_KEY");
  const newsdataKey = Deno.env.get("NEWSDATA_API_KEY");
  const currentsKey = Deno.env.get("CURRENTSAPI_KEY");

  const url = new URL(req.url);
  const country = url.searchParams.get("country")?.toUpperCase() ?? "";
  const symbolsParam = url.searchParams.get("symbols") ?? "";
  const days = Math.min(parseInt(url.searchParams.get("days") ?? "7"), 30);
  const forceFresh = url.searchParams.get("fresh") === "1";

  const symbols = symbolsParam
    ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : [];

  const to = new Date();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fromStr = from.toISOString().split("T")[0];
  const toStr = to.toISOString().split("T")[0];

  try {
    // ── Cache check ──────────────────────────────────────────────────────
    // Even when symbols are provided, we serve the country portion from cache
    // and only add Finnhub company news on top — Finnhub has a generous quota
    // (60/min), but MarketAux/GNews/NewsAPI do not, so cache-skipping the
    // country-level fetches is critical to staying under their daily limits.
    if (country && !forceFresh) {
      const cached = await getCachedNews(country);
      if (cached) {
        // Pure country request → return cached directly
        if (symbols.length === 0) {
          return new Response(
            JSON.stringify({ news: cached, timestamp: Date.now(), cached: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        // Country + symbols → cached country news + fresh Finnhub company news only
        const companyFetches = symbols.map((sym) =>
          fetchFinnhubJson(
            `${FINNHUB_BASE}/company-news?symbol=${encodeURIComponent(sym)}&from=${fromStr}&to=${toStr}&token=${finnhubKey}`,
          ).then((items) => items.map(finnhubToNewsItem)),
        );
        const companyResults = await Promise.all(companyFetches);
        const seen = new Set<string>(cached.map((n) => n.id));
        const merged: NewsItem[] = [...cached];
        for (const items of companyResults) {
          for (const item of items) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              merged.push(item);
            }
          }
        }
        merged.sort((a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
        );
        return new Response(
          JSON.stringify({ news: merged, timestamp: Date.now(), cached: "partial" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Cache MISS → fetch from external APIs ────────────────────────────

    const fetches: Promise<NewsItem[]>[] = [];
    const sourceLabels: string[] = [];

    if (country) {
      const inGNewsList = GNEWS_COUNTRIES.has(country);
      const inNewsApiList = NEWSAPI_COUNTRIES.has(country);
      const hasRssFeed = country in ALLAFRICA_FEEDS;
      const isSearchFallback = !inGNewsList;
      const gnewsKey = (gnewsKeys.primary || gnewsKeys.supplemental.length > 0)
        ? pickGNewsKey(gnewsKeys, country, isSearchFallback)
        : "";

      const keyLabel = gnewsKey
        ? (gnewsKey === gnewsKeys.primary
          ? "primary"
          : `supp${gnewsKeys.supplemental.indexOf(gnewsKey) + 1}`)
        : "none";

      // ── Priority 0: RSS feeds (FREE, unlimited) ──────────────────────
      // For African countries with AllAfrica feeds, use RSS as primary.
      // This completely avoids burning GNews API calls.
      const isAfricanCountry = hasRssFeed || AFRICAN_NO_FEED.has(country);
      if (hasRssFeed) {
        fetches.push(fetchAllAfricaRss(country));
        sourceLabels.push("AllAfrica-RSS");
      }

      // Country-specific business RSS feeds (Asia, Middle East, supplemental Africa).
      // Each country in COUNTRY_BUSINESS_RSS gets 1-3 high-quality local outlets.
      // Always-on for any covered country — FREE, no quota impact.
      if (country in COUNTRY_BUSINESS_RSS) {
        fetches.push(fetchCountryBusinessRss(country));
        sourceLabels.push(`Country-RSS(${COUNTRY_BUSINESS_RSS[country].length})`);
      }
      // Pan-African business feed as supplement for ALL African countries
      // Keyword-filtered to ensure only articles mentioning THIS country are shown
      if (isAfricanCountry) {
        fetches.push(
          fetchAllAfricaBusiness(country).then((items) =>
            filterForCountry(items, country, PAN_AFRICAN_KEYWORDS),
          ),
        );
        sourceLabels.push("AllAfrica-Biz");
      }
      // Pan-African wire feeds (BBC, Africanews, France24) — fetch once, filter by country keywords.
      // The 3 feeds are cached under "_PAN_AFRICA" so only the first African country in a
      // 6-hour window actually hits the wire; all others get a free cache read + keyword filter.
      if (isAfricanCountry) {
        fetches.push(
          fetchPanAfricanFeeds().then((all) => filterPanAfricanForCountry(all, country)),
        );
        sourceLabels.push("Pan-African");
      }

      // ── Priority 1: GNews top-headlines (only for NON-RSS countries) ──
      // Skip GNews for countries that have RSS — saves API calls
      if (gnewsKey && inGNewsList && !isAfricanCountry) {
        fetches.push(fetchGNews(country, gnewsKey));
        sourceLabels.push(`GNews[${keyLabel}]`);
      }

      // ── Priority 2: GNews search (only for non-RSS, non-African gap countries) ─
      if (gnewsKey && !inGNewsList && !isAfricanCountry) {
        const name = COUNTRY_NAMES[country] || country;
        fetches.push(fetchGNewsSearch(name, country, gnewsKey));
        sourceLabels.push(`GNews-search[${keyLabel}]`);
      }

      // ── Priority 3: NewsAPI (only for non-RSS, non-African, non-GNews) ──
      if (newsapiKey && !inGNewsList && !isAfricanCountry && inNewsApiList) {
        fetches.push(fetchNewsApiHeadlines(country, newsapiKey));
        sourceLabels.push("NewsAPI");
      }

      if (newsapiKey && !inGNewsList && !isAfricanCountry && !inNewsApiList) {
        const name = COUNTRY_NAMES[country] || country;
        fetches.push(fetchNewsApiSearch(name, country, newsapiKey));
        sourceLabels.push("NewsAPI-search");
      }

      // ── MarketAux — always (separate quota) ──────────────────────────
      if (marketauxKey) {
        fetches.push(fetchMarketAux(country, marketauxKey));
        sourceLabels.push("MarketAux");
      }

      // ── NewsData.io — universal country coverage (60+ countries) ────
      // Particularly strong for under-covered Africa/Asia/ME small markets
      // where our other sources are thin. Free tier 200/day, gracefully
      // degrades to [] on 429.
      if (newsdataKey) {
        fetches.push(fetchNewsData(country, newsdataKey));
        sourceLabels.push("NewsData.io");
      }

      // ── Currents API — 50+ supported countries ──────────────────────
      // Skipped for unsupported countries (would 400). Free tier 600/day.
      if (currentsKey && CURRENTS_COUNTRIES.has(country)) {
        fetches.push(fetchCurrents(country, currentsKey));
        sourceLabels.push("Currents");
      }

      // ── Pan-European wire feeds (Euronews, France24 Europe) ────────
      // Cached under "_PAN_EUROPE" — supplements GNews for European countries
      if (EUROPEAN_COUNTRIES.has(country)) {
        fetches.push(
          fetchPanEuropeanFeeds().then((all) => filterPanEuropeanForCountry(all, country)),
        );
        sourceLabels.push("Pan-Europe");
      }

      // ── Pan-Middle East wire feeds (Al Jazeera, Middle East Eye, France24 ME) ──
      // Cached under "_PAN_MIDEAST" — supplements GNews for ME countries
      if (ME_COUNTRIES.has(country)) {
        fetches.push(
          fetchPanMEFeeds().then((all) => filterPanMEForCountry(all, country)),
        );
        sourceLabels.push("Pan-ME");
      }

      // ── Pan-Asia-Pacific wire feeds (BBC Asia, France24 Asia) ────────
      if (ASIA_PACIFIC_COUNTRIES.has(country)) {
        fetches.push(
          fetchPanAsiaFeeds().then((all) => filterPanAsiaForCountry(all, country)),
        );
        sourceLabels.push("Pan-Asia");
      }

      // ── Pan-Americas wire feeds (BBC LatAm, BBC US/Canada, France24 Americas) ──
      if (AMERICAS_COUNTRIES.has(country)) {
        fetches.push(
          fetchPanAmericasFeeds().then((all) => filterPanAmericasForCountry(all, country)),
        );
        sourceLabels.push("Pan-Americas");
      }

      // ── Pan-Global wire feeds (BBC World, France24) ──────────────────
      // Catch-all layer: provides articles for ALL countries via keyword matching.
      // Cached globally so only 2 HTTP requests per 6-hour window.
      fetches.push(
        fetchPanGlobalFeeds().then((all) => filterPanGlobalForCountry(all, country)),
      );
      sourceLabels.push("Pan-Global");
    }

    // Finnhub general news — keyword-filtered when a country is selected
    // so only articles mentioning the country appear (no generic US market noise)
    if (country) {
      fetches.push(
        fetchFinnhubJson(`${FINNHUB_BASE}/news?category=general&token=${finnhubKey}`)
          .then((items) => items.map(finnhubToNewsItem))
          .then((items) => filterForCountry(items, country, PAN_GLOBAL_KEYWORDS)),
      );
    } else {
      // No country selected (symbol-only requests) — return unfiltered
      fetches.push(
        fetchFinnhubJson(`${FINNHUB_BASE}/news?category=general&token=${finnhubKey}`)
          .then((items) => items.map(finnhubToNewsItem)),
      );
    }
    sourceLabels.push("Finnhub-general");

    // Finnhub company news for each symbol
    for (const sym of symbols) {
      fetches.push(
        fetchFinnhubJson(
          `${FINNHUB_BASE}/company-news?symbol=${encodeURIComponent(sym)}&from=${fromStr}&to=${toStr}&token=${finnhubKey}`,
        ).then((items) => items.map(finnhubToNewsItem)),
      );
    }
    if (symbols.length > 0) sourceLabels.push("Finnhub-company");

    const results = await Promise.all(fetches);

    // Merge and deduplicate
    const seenUrls = new Set<string>();
    const seenIds = new Set<string>();
    const merged: NewsItem[] = [];

    function addItems(items: NewsItem[]) {
      for (const item of items) {
        if (!item?.title) continue;
        if (item.url && seenUrls.has(item.url)) continue;
        if (seenIds.has(item.id)) continue;
        if (item.url) seenUrls.add(item.url);
        seenIds.add(item.id);
        merged.push(item);
      }
    }

    for (const arr of results) {
      addItems(arr);
    }

    // Translate non-English articles
    const translated = await translateNewsItems(merged, country);

    // Sort newest first
    translated.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    const news = translated.slice(0, 100);

    console.log(
      `api-news: ${news.length} articles [${sourceLabels.join("+")}] country=${country || "none"} symbols=${symbols.length}`,
    );

    // ── Write to cache (fire-and-forget, don't delay response) ──────────
    if (country && symbols.length === 0 && news.length > 0) {
      // Don't await — let it write in the background
      setCachedNews(country, news, sourceLabels).catch((e) =>
        console.warn(`Cache write failed: ${e}`),
      );
    }

    return new Response(JSON.stringify({ news, timestamp: Date.now(), cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("api-news error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
