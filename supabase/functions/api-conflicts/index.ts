import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * api-conflicts — geocoded conflict / unrest event feed.
 *
 * Pulls from two free sources and merges:
 *   1. GDELT 2.1 GeoJSON Feed   — no key, ~15-min latency, broad event types
 *   2. ACLED API                 — academic key required, higher fidelity
 *
 * If neither source yields events (e.g. ACLED key not set + GDELT outage),
 * returns an empty list so the client can degrade gracefully.
 *
 * Response: { events: ConflictEvent[], sources: string[], timestamp: number }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConflictEvent {
  id:          string;
  date:        string;     // ISO date
  lat:         number;
  lng:         number;
  /** ISO 3166-1 alpha-2 country code (uppercase). */
  countryIso2: string;
  /** Human-readable event type, e.g. "Battle", "Protest", "Strategic dev". */
  eventType:   string;
  /** Estimated fatalities, if known.  0 means "unknown or none". */
  fatalities:  number;
  /** One-sentence description / headline. */
  notes:       string;
  /** URL to the source article or report, if available. */
  sourceUrl:   string;
  /** "acled" | "gdelt" | "baseline" — which feed it came from. */
  source:      "acled" | "gdelt" | "baseline";
}

// ── Curated baseline of ongoing major conflict zones ──────────────────────
// Hand-picked, well-known coordinates of active conflict hotspots. Always
// returned regardless of upstream API status, so the layer is never empty.
// These are NOT meant to be high-frequency live data — they're a "show
// something useful" floor. ACLED + GDELT augment them with real-time events.
const BASELINE_CONFLICTS: ConflictEvent[] = [
  // Ukraine — multiple front-line points
  {
    id: "base-ua-bakhmut", date: new Date().toISOString().slice(0,10),
    lat: 48.5944, lng: 38.0000, countryIso2: "UA", eventType: "Active conflict zone", fatalities: 0,
    notes: "Eastern Ukraine front line — Donetsk Oblast (Bakhmut/Avdiivka axis). Russian forces have made incremental gains along this sector following the fall of Avdiivka in early 2024, with both sides suffering heavy losses in attritional trench warfare. Persistent artillery exchanges and drone strikes on logistics routes are ongoing.",
    sourceUrl: "", source: "baseline",
  },
  {
    id: "base-ua-kherson", date: new Date().toISOString().slice(0,10),
    lat: 46.6354, lng: 32.6169, countryIso2: "UA", eventType: "Active conflict zone", fatalities: 0,
    notes: "Kherson region — Dnipro river front with contested left-bank operations since Ukraine's liberation of the city in November 2022. Ukrainian forces maintain footholds on the eastern bank while Russian forces hold occupied territory across the river. Cross-river raids, artillery duels, and drone strikes on grain storage facilities are frequent.",
    sourceUrl: "", source: "baseline",
  },
  {
    id: "base-ua-zaporizhzhia", date: new Date().toISOString().slice(0,10),
    lat: 47.5036, lng: 36.0456, countryIso2: "UA", eventType: "Active conflict zone", fatalities: 0,
    notes: "Zaporizhzhia southern front — heavily fortified Russian multi-layered defensive lines stretching toward Tokmak limited Ukraine's 2023 counteroffensive gains to a narrow salient. Europe's largest nuclear power plant (ZNPP) remains under Russian occupation, with repeated safety alerts raising concerns over reactor integrity. The front line here has been largely static since mid-2023.",
    sourceUrl: "", source: "baseline",
  },

  // Gaza / Israel-Palestine
  {
    id: "base-ps-gaza", date: new Date().toISOString().slice(0,10),
    lat: 31.5, lng: 34.47, countryIso2: "PS", eventType: "Active conflict zone", fatalities: 0,
    notes: "Gaza Strip — sustained IDF military campaign launched in response to the Hamas-led October 7, 2023 attacks that killed approximately 1,200 Israelis and took 250 hostages. The operation has caused severe destruction across northern and southern Gaza, with Palestinian authorities reporting over 35,000 fatalities. A full-scale humanitarian crisis persists, with widespread shortages of food, medicine, and fuel, drawing intense international pressure for a ceasefire.",
    sourceUrl: "", source: "baseline",
  },
  {
    id: "base-il-north", date: new Date().toISOString().slice(0,10),
    lat: 33.207, lng: 35.572, countryIso2: "IL", eventType: "Cross-border exchanges", fatalities: 0,
    notes: "Northern Israel / southern Lebanon border — near-daily Hezbollah-IDF exchanges of rockets, anti-tank missiles, and airstrikes have been ongoing since October 2023. Israel launched a major ground operation in southern Lebanon in late 2024, significantly degrading Hezbollah's military infrastructure and leadership. A US-brokered ceasefire took hold in late November 2024, though sporadic violations continue to be reported.",
    sourceUrl: "", source: "baseline",
  },
  {
    id: "base-lb-south", date: new Date().toISOString().slice(0,10),
    lat: 33.27, lng: 35.20, countryIso2: "LB", eventType: "Cross-border exchanges", fatalities: 0,
    notes: "Southern Lebanon — Hezbollah's military infrastructure suffered severe damage from Israeli precision strikes and a ground incursion in late 2024, including the killing of its secretary-general Hassan Nasrallah. The November 2024 ceasefire agreement requires Hezbollah to withdraw north of the Litani River and the Lebanese Armed Forces to deploy south. Reconstruction is ongoing, but tensions remain elevated along the Blue Line.",
    sourceUrl: "", source: "baseline",
  },

  // Sudan — civil war
  {
    id: "base-sd-khartoum", date: new Date().toISOString().slice(0,10),
    lat: 15.5007, lng: 32.5599, countryIso2: "SD", eventType: "Civil war", fatalities: 0,
    notes: "Khartoum — Sudan's capital has been a major battleground since civil war erupted between the Sudanese Armed Forces (SAF) and the Rapid Support Forces (RSF) paramilitary in April 2023. Much of the city's infrastructure, including hospitals and water systems, has been destroyed, forcing millions to flee. The conflict has triggered one of the world's worst humanitarian crises, with over 8 million people displaced.",
    sourceUrl: "", source: "baseline",
  },
  {
    id: "base-sd-darfur", date: new Date().toISOString().slice(0,10),
    lat: 13.45, lng: 25.34, countryIso2: "SD", eventType: "Civil war", fatalities: 0,
    notes: "Darfur — the RSF has captured most of West, Central, and South Darfur, with El Fasher remaining the last SAF-held major city under siege. Reports of ethnically targeted massacres against the Masalit and other communities have drawn international condemnation and ICC scrutiny. Gold mining revenues from Darfur's artisanal fields have been a key RSF funding source.",
    sourceUrl: "", source: "baseline",
  },

  // Yemen — Houthi conflict
  {
    id: "base-ye-sanaa", date: new Date().toISOString().slice(0,10),
    lat: 15.3694, lng: 44.1910, countryIso2: "YE", eventType: "Civil war", fatalities: 0,
    notes: "Yemen — Houthi (Ansarallah) forces have controlled Sanaa and most of northern Yemen since 2014, fighting a Saudi-led coalition and the internationally recognised government. A UN-brokered truce largely held through 2022–23, but a comprehensive peace deal has not been reached. Yemen's oil export infrastructure in the south remains functional but fragile, with production a fraction of pre-war levels.",
    sourceUrl: "", source: "baseline",
  },
  {
    id: "base-ye-redsea", date: new Date().toISOString().slice(0,10),
    lat: 13.50, lng: 43.00, countryIso2: "YE", eventType: "Maritime attacks", fatalities: 0,
    notes: "Red Sea / Bab-el-Mandeb — Houthi forces have been launching missile, drone, and naval attacks on commercial shipping since November 2023, declaring solidarity with Gaza. Over 100 vessels have been struck or targeted, forcing major container and tanker operators to reroute around the Cape of Good Hope — adding 10–14 days and significant fuel costs per voyage. US, UK, and coalition forces have conducted hundreds of retaliatory strikes on Houthi launch sites with limited lasting effect.",
    sourceUrl: "", source: "baseline",
  },

  // Myanmar — civil war
  {
    id: "base-mm-rakhine", date: new Date().toISOString().slice(0,10),
    lat: 20.20, lng: 93.10, countryIso2: "MM", eventType: "Civil war", fatalities: 0,
    notes: "Rakhine state — the Arakan Army (AA) has seized most of the state from the military junta since its major offensive in late 2023, including the strategic Sittwe port and Ann township. The junta's loss of Rakhine threatens Chinese-backed infrastructure projects including the Kyaukphyu deep-sea port and the China-Myanmar oil and gas pipelines. Hundreds of thousands of civilians have been displaced.",
    sourceUrl: "", source: "baseline",
  },
  {
    id: "base-mm-shan", date: new Date().toISOString().slice(0,10),
    lat: 22.00, lng: 98.00, countryIso2: "MM", eventType: "Civil war", fatalities: 0,
    notes: "Shan state — Operation 1027, launched by the Three Brotherhood Alliance in October 2023, captured significant territory from the military junta along the Chinese border, including Laukkaing and key towns on the China-Myanmar Economic Corridor (CMEC). China brokered a ceasefire in January 2024, but fighting has resumed periodically. Disruption to border trade and Chinese investment projects worth billions of dollars annually has been significant.",
    sourceUrl: "", source: "baseline",
  },

  // DRC eastern conflict
  {
    id: "base-cd-goma", date: new Date().toISOString().slice(0,10),
    lat: -1.6800, lng: 29.2200, countryIso2: "CD", eventType: "Insurgency", fatalities: 0,
    notes: "North Kivu — the M23 rebel group, backed by Rwanda according to UN Group of Experts reports, seized the major city of Goma in early 2025 after years of advance in eastern DRC. Goma is a critical hub for the export of coltan, gold, cassiterite, and wolframite — minerals essential for electronics and EV batteries. The broader eastern DRC conflict has displaced over 7 million people, making it one of the world's largest displacement crises.",
    sourceUrl: "", source: "baseline",
  },

  // Sahel — Mali / Burkina Faso
  {
    id: "base-ml-mopti", date: new Date().toISOString().slice(0,10),
    lat: 14.5, lng: -4.2, countryIso2: "ML", eventType: "Insurgency", fatalities: 0,
    notes: "Central Mali — JNIM (al-Qaeda affiliate) and ISGS (Islamic State) jihadist groups control extensive rural territory following the withdrawal of French Barkhane forces in 2022. Mali's military junta invited Russian Africa Corps (formerly Wagner) as a replacement, but violence has escalated. Gold mining operations, which represent roughly 75% of Mali's export revenues, have been repeatedly disrupted by attacks on transport corridors.",
    sourceUrl: "", source: "baseline",
  },
  {
    id: "base-bf-east", date: new Date().toISOString().slice(0,10),
    lat: 12.07, lng: 0.36, countryIso2: "BF", eventType: "Insurgency", fatalities: 0,
    notes: "Eastern Burkina Faso — armed jihadist groups affiliated with JNIM and ISGS control an estimated 40% of national territory as of 2024, cutting off major towns including Djibo from the capital. Over 2 million people have been internally displaced, with famine conditions emerging in besieged areas. The military junta has expelled French forces and Western NGOs while relying on Russian Africa Corps, limiting independent humanitarian access.",
    sourceUrl: "", source: "baseline",
  },

  // Haiti — gang violence
  {
    id: "base-ht-pap", date: new Date().toISOString().slice(0,10),
    lat: 18.5944, lng: -72.3074, countryIso2: "HT", eventType: "Gang violence", fatalities: 0,
    notes: "Port-au-Prince — the Viv Ansanm gang coalition controls approximately 80% of the capital, having seized the main port, fuel depots, and government buildings in a major offensive in early 2024 that forced Prime Minister Ariel Henry to resign. A Kenya-led Multinational Security Support (MSS) mission deployed in 2024 but faces severe resource constraints. The near-total collapse of state authority has devastated Haiti's agricultural and manufacturing export sectors.",
    sourceUrl: "", source: "baseline",
  },

  // Syria — post-Assad instability
  {
    id: "base-sy-idlib", date: new Date().toISOString().slice(0,10),
    lat: 35.93, lng: 36.63, countryIso2: "SY", eventType: "Active conflict zone", fatalities: 0,
    notes: "Syria — the Assad regime collapsed in December 2024 following a rapid HTS-led offensive that swept from Aleppo to Damascus in under two weeks. Hayat Tahrir al-Sham (HTS) and allied factions now govern most of the country, though rival armed groups contest northeastern and southeastern areas. Syria's oil and gas infrastructure, largely in Kurdish-held territory, remains a source of tensions between the new government and the SDF.",
    sourceUrl: "", source: "baseline",
  },

  // Somalia — Al-Shabaab
  {
    id: "base-so-mogadishu", date: new Date().toISOString().slice(0,10),
    lat: 2.0469, lng: 45.3182, countryIso2: "SO", eventType: "Insurgency", fatalities: 0,
    notes: "Somalia — Al-Shabaab controls significant rural territory in south-central Somalia and continues to conduct large-scale attacks on government, AU mission forces, and civilian infrastructure in Mogadishu and beyond. The African Union Transition Mission (ATMIS) has been gradually handing security responsibilities to Somali National Forces ahead of its 2024 drawdown, a transition that Al-Shabaab is actively trying to exploit. The group's control over key road networks and agricultural regions disrupts food security and trade.",
    sourceUrl: "", source: "baseline",
  },

  // Mexico — cartel violence hotspot
  {
    id: "base-mx-sinaloa", date: new Date().toISOString().slice(0,10),
    lat: 25.0, lng: -107.3, countryIso2: "MX", eventType: "Cartel violence", fatalities: 0,
    notes: "Sinaloa — a violent internal war erupted within the Sinaloa Cartel in 2024 following the arrest of co-founder Ismael 'El Mayo' Zambada in the US, splitting the organisation between factions loyal to Zambada and those backing the sons of Joaquín 'El Chapo' Guzmán. Hundreds have been killed in fighting concentrated around Culiacán, Badiraguato, and border crossings. The violence has disrupted agricultural exports and logistics in a region that accounts for roughly 23% of global silver production.",
    sourceUrl: "", source: "baseline",
  },
];

function fetchBaselineConflicts(): ConflictEvent[] {
  return BASELINE_CONFLICTS;
}

// Translate ACLED 2-letter country code → standard ISO-2 (mostly identical)
const ACLED_COUNTRY_FIX: Record<string, string> = {
  // ACLED uses some non-standard codes — patch as needed
};

// ── GDELT 2.1 DOC API (article list with sourcecountry) ───────────────────
// The legacy GEO 2.0 endpoint (`/api/v2/geo/geo`) was deprecated and now
// returns 404. The DOC API (`/api/v2/doc/doc`) still serves armed-conflict
// articles with `sourcecountry` field — we map sourcecountry → ISO2 and
// place each article at the country centroid (close enough for a "show
// recent news mentions" overlay; ACLED has the precise lat/lng anyway).
async function fetchGdeltEvents(): Promise<ConflictEvent[]> {
  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc" +
    "?query=" + encodeURIComponent("theme:ARMEDCONFLICT sourcelang:eng") +
    "&format=json" +
    "&mode=ArtList" +
    "&maxrecords=75" +
    "&sort=DateDesc" +
    "&timespan=1d";

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    console.warn(`[gdelt] doc api ${res.status}`);
    return [];
  }

  let data: { articles?: Array<{
    url?:           string;
    title?:         string;
    seendate?:      string;
    sourcecountry?: string;
  }> };
  try {
    data = await res.json();
  } catch {
    return [];
  }

  const articles = data.articles ?? [];
  const out: ConflictEvent[] = [];
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const iso2 = COUNTRY_NAME_TO_ISO2[(a.sourcecountry ?? "").toLowerCase()] ?? "";
    if (!iso2) continue;
    const centroid = COUNTRY_CENTROID[iso2];
    if (!centroid) continue;
    // Jitter slightly so multiple events from the same country don't
    // stack invisibly on top of each other.
    const jitter = () => (Math.random() - 0.5) * 1.4;
    out.push({
      id:          `gdelt-${a.seendate ?? Date.now()}-${i}`,
      date:        (a.seendate ?? "").slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") || new Date().toISOString().slice(0, 10),
      lat:         centroid[0] + jitter(),
      lng:         centroid[1] + jitter(),
      countryIso2: iso2,
      eventType:   "News mention",
      fatalities:  0,
      notes:       (a.title ?? "").slice(0, 200),
      sourceUrl:   a.url ?? "",
      source:      "gdelt",
    });
  }
  return out;
}

// ── Country-name → ISO2 (for GDELT sourcecountry mapping) ─────────────────
const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  "ukraine": "UA", "russia": "RU", "united states": "US", "israel": "IL",
  "palestinian territory": "PS", "lebanon": "LB", "syria": "SY", "iraq": "IQ",
  "iran": "IR", "yemen": "YE", "afghanistan": "AF", "pakistan": "PK",
  "india": "IN", "myanmar": "MM", "burma": "MM", "sudan": "SD", "south sudan": "SS",
  "ethiopia": "ET", "somalia": "SO", "nigeria": "NG", "democratic republic of congo": "CD",
  "cameroon": "CM", "mali": "ML", "burkina faso": "BF", "niger": "NE",
  "libya": "LY", "egypt": "EG", "tunisia": "TN", "algeria": "DZ", "morocco": "MA",
  "turkey": "TR", "venezuela": "VE", "colombia": "CO", "mexico": "MX",
  "haiti": "HT", "china": "CN", "taiwan": "TW", "korea, north": "KP",
  "korea, south": "KR", "japan": "JP", "indonesia": "ID", "philippines": "PH",
  "thailand": "TH", "vietnam": "VN", "saudi arabia": "SA", "united arab emirates": "AE",
  "qatar": "QA", "azerbaijan": "AZ", "armenia": "AM", "georgia": "GE",
  "belarus": "BY", "moldova": "MD", "kazakhstan": "KZ", "kenya": "KE",
  "uganda": "UG", "tanzania": "TZ", "rwanda": "RW", "burundi": "BI",
  "angola": "AO", "mozambique": "MZ", "zimbabwe": "ZW", "south africa": "ZA",
  "france": "FR", "germany": "DE", "united kingdom": "GB", "spain": "ES",
  "italy": "IT", "poland": "PL", "greece": "GR", "romania": "RO",
  "ivory coast": "CI", "ghana": "GH", "senegal": "SN", "guinea": "GN",
  "liberia": "LR", "sierra leone": "SL", "central african republic": "CF",
  "chad": "TD", "mauritania": "MR",
};

// Approximate country centroids for GDELT-style events that only carry a country.
const COUNTRY_CENTROID: Record<string, [number, number]> = {
  UA: [49.0, 32.0], RU: [61.5, 105.3], US: [39.5, -98.4], IL: [31.5, 34.9],
  PS: [31.9, 35.2], LB: [33.9, 35.9], SY: [35.0, 38.5], IQ: [33.2, 43.7],
  IR: [32.4, 53.7], YE: [15.6, 47.6], AF: [33.9, 67.7], PK: [30.4, 69.3],
  IN: [21.0, 78.9], MM: [21.9, 95.9], SD: [12.9, 30.2], SS: [7.3, 31.3],
  ET: [9.1, 40.5], SO: [5.2, 46.2], NG: [9.1, 8.7], CD: [-4.0, 21.8],
  CM: [7.4, 12.4], ML: [17.6, -4.0], BF: [12.2, -1.6], NE: [17.6, 8.1],
  LY: [26.3, 17.2], EG: [26.8, 30.8], TN: [33.9, 9.5], DZ: [28.0, 1.7],
  MA: [31.8, -7.1], TR: [38.9, 35.2], VE: [6.4, -66.6], CO: [4.6, -74.3],
  MX: [23.6, -102.5], HT: [18.9, -72.3], CN: [35.9, 104.2], TW: [23.7, 121.0],
  KP: [40.3, 127.5], KR: [35.9, 127.8], JP: [36.2, 138.3], ID: [-0.8, 113.9],
  PH: [12.9, 121.8], TH: [15.9, 100.9], VN: [14.1, 108.3], SA: [23.9, 45.1],
  AE: [23.4, 53.8], QA: [25.4, 51.2], AZ: [40.1, 47.6], AM: [40.1, 45.0],
  GE: [42.3, 43.4], BY: [53.7, 27.9], MD: [47.4, 28.4], KZ: [48.0, 66.9],
  KE: [-0.0, 37.9], UG: [1.4, 32.3], TZ: [-6.4, 34.9], RW: [-1.9, 29.9],
  BI: [-3.4, 29.9], AO: [-11.2, 17.9], MZ: [-18.7, 35.5], ZW: [-19.0, 29.2],
  ZA: [-30.6, 22.9], FR: [46.2, 2.2], DE: [51.2, 10.4], GB: [55.4, -3.4],
  ES: [40.5, -3.7], IT: [41.9, 12.6], PL: [51.9, 19.1], GR: [39.1, 21.8],
  RO: [45.9, 24.9], CI: [7.5, -5.5], GH: [7.9, -1.0], SN: [14.5, -14.5],
  GN: [9.9, -9.7], LR: [6.4, -9.4], SL: [8.5, -11.8], CF: [6.6, 20.9],
  TD: [15.5, 18.7], MR: [21.0, -10.9],
};

// ── ACLED API (new OAuth system, 2024+) ──────────────────────────────────
// Token cached at module scope — survives across requests served by the
// same isolate.  Tokens are valid 24h, so this is plenty.
let acledToken:        string | null = null;
let acledTokenExpiry:  number        = 0;

async function getAcledToken(username: string, password: string): Promise<string | null> {
  if (acledToken && Date.now() < acledTokenExpiry) return acledToken;

  const body = new URLSearchParams({
    username,
    password,
    grant_type: "password",
    client_id:  "acled",
    scope:      "authenticated",
  });

  const res = await fetch("https://acleddata.com/oauth/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
    signal:  AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    console.error(`[acled] oauth token failed: ${res.status} ${await res.text().catch(() => '')}`);
    return null;
  }

  const j = await res.json() as { access_token?: string; expires_in?: number };
  if (!j.access_token) return null;

  acledToken       = j.access_token;
  // Refresh 5 minutes before actual expiry to be safe.
  acledTokenExpiry = Date.now() + ((j.expires_in ?? 86400) - 300) * 1000;
  return acledToken;
}

async function fetchAcledEvents(): Promise<ConflictEvent[]> {
  // New auth: ACLED_USERNAME (email) + ACLED_PASSWORD (myACLED password)
  // Backwards-compat: still accept ACLED_EMAIL as alias for ACLED_USERNAME.
  const username =
    Deno.env.get("ACLED_USERNAME") ?? Deno.env.get("ACLED_EMAIL") ?? "";
  const password = Deno.env.get("ACLED_PASSWORD") ?? "";
  if (!username || !password) return [];  // graceful no-op if not configured

  const token = await getAcledToken(username, password);
  if (!token) return [];

  // Last 14 days, fatalities >= 1.  New API uses the same /api/acled/read
  // endpoint but authenticated via Bearer token instead of query params.
  const fromDate = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
  const url =
    `https://acleddata.com/api/acled/read` +
    `?event_date=${fromDate}` +
    `&event_date_where=>=` +
    `&fatalities=1` +
    `&fatalities_where=>=` +
    `&limit=300`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal:  AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    // If token rejected, invalidate the cache so the next call retries.
    if (res.status === 401 || res.status === 403) {
      acledToken = null;
      acledTokenExpiry = 0;
    }
    throw new Error(`ACLED ${res.status}`);
  }

  const data = await res.json();
  const rows = (data.data ?? []) as Array<{
    event_id_cnty: string;
    event_date:    string;
    latitude:      string;
    longitude:     string;
    iso:           string;        // numeric
    iso3:          string;
    country:       string;
    event_type:    string;
    sub_event_type:string;
    fatalities:    string;
    notes:         string;
    source:        string;
  }>;

  return rows.map((r): ConflictEvent => ({
    id:          `acled-${r.event_id_cnty}`,
    date:        r.event_date,
    lat:         parseFloat(r.latitude),
    lng:         parseFloat(r.longitude),
    countryIso2: iso3ToIso2(r.iso3) ?? "",
    eventType:   r.sub_event_type || r.event_type,
    fatalities:  parseInt(r.fatalities, 10) || 0,
    notes:       (r.notes ?? "").slice(0, 280),
    sourceUrl:   "",
    source:      "acled",
  }));
}

/** Tiny ISO-3 → ISO-2 map for the most-active conflict countries. */
function iso3ToIso2(iso3: string): string | null {
  const m: Record<string, string> = {
    UKR: "UA", RUS: "RU", USA: "US", ISR: "IL", PSE: "PS", LBN: "LB",
    SYR: "SY", IRQ: "IQ", IRN: "IR", YEM: "YE", AFG: "AF", PAK: "PK",
    IND: "IN", MMR: "MM", SDN: "SD", SSD: "SS", ETH: "ET", SOM: "SO",
    NGA: "NG", COD: "CD", CMR: "CM", MLI: "ML", BFA: "BF", NER: "NE",
    LBY: "LY", EGY: "EG", TUN: "TN", DZA: "DZ", MAR: "MA", TUR: "TR",
    GRC: "GR", BGR: "BG", ROU: "RO", HUN: "HU", POL: "PL", DEU: "DE",
    FRA: "FR", GBR: "GB", ESP: "ES", ITA: "IT", VEN: "VE", COL: "CO",
    BRA: "BR", MEX: "MX", HTI: "HT", CUB: "CU", CHN: "CN", TWN: "TW",
    KOR: "KR", PRK: "KP", JPN: "JP", IDN: "ID", PHL: "PH", THA: "TH",
    VNM: "VN", SAU: "SA", ARE: "AE", QAT: "QA", IRQ_ALT: "IQ",
    AZE: "AZ", ARM: "AM", GEO: "GE", BLR: "BY", MDA: "MD", LTU: "LT",
    LVA: "LV", EST: "EE", FIN: "FI", SWE: "SE", NOR: "NO", DNK: "DK",
    NLD: "NL", BEL: "BE", CHE: "CH", AUT: "AT", PRT: "PT", IRL: "IE",
    KAZ: "KZ", UZB: "UZ", TKM: "TM", KGZ: "KG", TJK: "TJ", MNG: "MN",
    AUS: "AU", NZL: "NZ", CAN: "CA", ZAF: "ZA", KEN: "KE", UGA: "UG",
    TZA: "TZ", RWA: "RW", BDI: "BI", AGO: "AO", MOZ: "MZ", ZWE: "ZW",
    ZMB: "ZM", BWA: "BW", NAM: "NA", MDG: "MG", CIV: "CI", GHA: "GH",
    SEN: "SN", GIN: "GN", LBR: "LR", SLE: "SL", BEN: "BJ", TGO: "TG",
    TCD: "TD", CAF: "CF", GAB: "GA", COG: "CG", GNB: "GW", MRT: "MR",
    CHL: "CL", PER: "PE", BOL: "BO", ARG: "AR", PRY: "PY", URY: "UY",
    ECU: "EC", GUY: "GY", SUR: "SR", BLZ: "BZ", GTM: "GT", HND: "HN",
    SLV: "SV", NIC: "NI", CRI: "CR", PAN: "PA", DOM: "DO", JAM: "JM",
  };
  return m[iso3] ?? null;
}

// ── Main handler ──────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Run both live fetches in parallel; tolerate partial failure.
    // Baseline always included so the layer is never empty.
    const results = await Promise.allSettled([fetchAcledEvents(), fetchGdeltEvents()]);
    const events: ConflictEvent[] = [];
    const sources: string[] = [];

    // Always seed with curated baseline of ongoing major conflict zones.
    const baseline = fetchBaselineConflicts();
    events.push(...baseline);
    sources.push("baseline");

    for (const [name, r] of [["acled", results[0]], ["gdelt", results[1]]] as const) {
      if (r.status === "fulfilled" && r.value.length > 0) {
        events.push(...r.value);
        sources.push(name);
      } else if (r.status === "rejected") {
        console.warn(`[${name}] fetch rejected:`, r.reason);
      }
    }

    // De-dup by spatial proximity (~5km) + same date
    const dedup: ConflictEvent[] = [];
    for (const e of events) {
      const dup = dedup.find(
        (d) =>
          d.date === e.date &&
          Math.abs(d.lat - e.lat) < 0.05 &&
          Math.abs(d.lng - e.lng) < 0.05,
      );
      if (!dup) dedup.push(e);
      else if (e.source === "acled") {
        // Prefer ACLED when both feeds have the same incident
        Object.assign(dup, e);
      }
    }

    return new Response(
      JSON.stringify({
        events: dedup,
        sources,
        timestamp: Date.now(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        events: [],
        sources: [],
        error: String(err),
        timestamp: Date.now(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
