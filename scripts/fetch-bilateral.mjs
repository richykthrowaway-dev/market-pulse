#!/usr/bin/env node
/**
 * fetch-bilateral.mjs — pre-build the static bilateral-trade dataset.
 *
 * For each reporter country in TOP_REPORTERS we:
 *   1. Call UN Comtrade preview to find its top trading partners (both directions)
 *   2. For each top partner, call Comtrade for the HS-Chapter breakdown of that
 *      bilateral relationship in the latest reported year
 *   3. Write a single JSON file `public/bilateral/{VERSION}/{ISO2}.json` containing
 *      both flow directions for that reporter
 *
 * Output structure matches src/data/bilateralTypes.ts.  Frontend serves these
 * files directly from Vercel's edge CDN — zero runtime API cost at hover time.
 *
 * USAGE:
 *   node scripts/fetch-bilateral.mjs                # build the full top list
 *   node scripts/fetch-bilateral.mjs --reporters US,CN,DE   # subset for testing
 *   node scripts/fetch-bilateral.mjs --force        # ignore existing files
 *
 * RUNTIME:
 *   No-auth Comtrade preview is rate-limited to ~100 calls/hour.
 *   We delay 3 s between calls to stay well under the cap (~20/min).
 *   ~50 reporters × ~18 calls each ≈ 900 calls ≈ 6-9 hours total.
 *   Script is RESUMABLE: existing JSON files are skipped unless --force is given,
 *   so a partial run can pick up where it left off after a crash or rate-limit.
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname    = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Dataset version slug — directory name under public/bilateral/. */
const VERSION = 'v2022';

/** Target data year.  Script will fall back through (Y-1, Y-2) per country. */
const PRIMARY_YEAR = 2022;

/** Top N partners to fetch per (reporter, direction).  Dialog shows top 6. */
const TOP_PARTNERS_PER_DIRECTION = 8;

/** Top N HS chapters to keep per bilateral pair.  Dialog shows top 6. */
const TOP_CHAPTERS = 10;

/**
 * Comtrade subscription key.  Falls back to env var so CI can inject it
 * without committing the secret.  When present, we hit the authenticated
 * `/data/v1/get/` endpoint which returns the full row set (no 500-row
 * preview cap) and supports a much higher rate limit.
 */
const COMTRADE_API_KEY =
  process.env.COMTRADE_API_KEY ?? 'ff15ac53e6964d4491d0e16bcce04814';

/** Polite delay between Comtrade calls (ms). */
const DELAY_MS = COMTRADE_API_KEY ? 800 : 3000;

/** Per-call timeout (ms).  Auth endpoint returns more rows so allow longer. */
const FETCH_TIMEOUT_MS = 30_000;

/**
 * Top 50 reporters by goods trade value (≈ covers ~92% of global trade).
 * Hand-curated from WTO / Comtrade rankings; ordering doesn't matter at
 * runtime — the manifest just lists which countries have static data.
 */
const TOP_REPORTERS = [
  'US', 'CN', 'DE', 'JP', 'GB', 'FR', 'IN', 'IT', 'NL', 'KR',
  'CA', 'MX', 'ES', 'BE', 'CH', 'AE', 'SG', 'TW', 'AU', 'PL',
  'TR', 'BR', 'TH', 'MY', 'ID', 'SE', 'AT', 'IE', 'VN', 'CZ',
  'HK', 'SA', 'ZA', 'IL', 'NO', 'PH', 'PT', 'DK', 'FI', 'HU',
  'GR', 'NZ', 'AR', 'EG', 'NG', 'CL', 'CO', 'RO', 'PK', 'BD',
];

const COMTRADE_BASE = COMTRADE_API_KEY
  ? 'https://comtradeapi.un.org/data/v1/get/C/A/HS'
  : 'https://comtradeapi.un.org/public/v1/preview/C/A/HS';

/** Append the subscription key to every Comtrade URL when configured. */
function withKey(url) {
  if (!COMTRADE_API_KEY) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}subscription-key=${COMTRADE_API_KEY}`;
}
const OUTPUT_DIR    = resolve(PROJECT_ROOT, 'public', 'bilateral', VERSION);
const MANIFEST_PATH = resolve(PROJECT_ROOT, 'public', 'bilateral', 'manifest.json');

// ─────────────────────────────────────────────────────────────────────────────
// M49 ↔ ISO maps (copied from supabase/functions/api-wits/index.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** ISO 3166-1 alpha-3 → UN M49 numeric (Comtrade reporter codes). */
const ISO3_TO_M49 = {
  AFG:'4',AGO:'24',ALB:'8',ARE:'784',ARG:'32',ARM:'51',AUS:'36',AUT:'40',AZE:'31',BDI:'108',
  BEL:'56',BEN:'204',BFA:'854',BGD:'50',BGR:'100',BHR:'48',BHS:'44',BIH:'70',BLR:'112',BLZ:'84',
  BOL:'68',BRA:'76',BRN:'96',BTN:'64',BWA:'72',CAF:'140',CAN:'124',CHE:'756',CHL:'152',CHN:'156',
  CIV:'384',CMR:'120',COD:'180',COG:'178',COL:'170',COM:'174',CPV:'132',CRI:'188',CUB:'192',CYP:'196',
  CZE:'203',DEU:'276',DJI:'262',DNK:'208',DOM:'214',DZA:'12',ECU:'218',EGY:'818',ERI:'232',ESH:'732',
  ESP:'724',EST:'233',ETH:'231',FIN:'246',FJI:'242',FLK:'238',FRA:'251',GAB:'266',GBR:'826',GEO:'268',
  GHA:'288',GIN:'324',GMB:'270',GNB:'624',GNQ:'226',GRC:'300',GRL:'304',GTM:'320',GUY:'328',HKG:'344',
  HND:'340',HRV:'191',HTI:'332',HUN:'348',IDN:'360',IND:'699',IRL:'372',IRN:'364',IRQ:'368',ISL:'352',
  ISR:'376',ITA:'381',JAM:'388',JOR:'400',JPN:'392',KAZ:'398',KEN:'404',KGZ:'417',KHM:'116',KOR:'410',
  KWT:'414',LAO:'418',LBN:'422',LBR:'430',LBY:'434',LKA:'144',LSO:'426',LTU:'440',LUX:'442',LVA:'428',
  MAR:'504',MDA:'498',MDG:'450',MEX:'484',MKD:'807',MLI:'466',MMR:'104',MNE:'499',MNG:'496',MOZ:'508',
  MRT:'478',MUS:'480',MWI:'454',MYS:'458',NAM:'516',NCL:'540',NER:'562',NGA:'566',NIC:'558',NLD:'528',
  NOR:'579',NPL:'524',NZL:'554',OMN:'512',PAK:'586',PAN:'591',PER:'604',PHL:'608',PNG:'598',POL:'616',
  PRI:'630',PRK:'408',PRT:'620',PRY:'600',PSE:'275',QAT:'634',ROU:'642',RUS:'643',RWA:'646',SAU:'682',
  SDN:'729',SEN:'686',SGP:'702',SLB:'90',SLE:'694',SLV:'222',SOM:'706',SRB:'688',SSD:'728',STP:'678',
  SUR:'740',SVK:'703',SVN:'705',SWE:'752',SWZ:'748',SYC:'690',SYR:'760',TCD:'148',TGO:'768',THA:'764',
  TJK:'762',TKM:'795',TLS:'626',TTO:'780',TUN:'788',TUR:'792',TWN:'490',TZA:'834',UGA:'800',UKR:'804',
  URY:'858',USA:'842',UZB:'860',VEN:'862',VNM:'704',VUT:'548',XKX:'412',YEM:'887',ZAF:'710',ZMB:'894',
  ZWE:'716',
};

/** ISO 3166-1 alpha-2 → alpha-3 (just for reporters we ingest). */
const ISO2_TO_ISO3 = {
  US:'USA',CN:'CHN',DE:'DEU',JP:'JPN',GB:'GBR',FR:'FRA',IN:'IND',IT:'ITA',NL:'NLD',KR:'KOR',
  CA:'CAN',MX:'MEX',ES:'ESP',BE:'BEL',CH:'CHE',AE:'ARE',SG:'SGP',TW:'TWN',AU:'AUS',PL:'POL',
  TR:'TUR',BR:'BRA',TH:'THA',MY:'MYS',ID:'IDN',SE:'SWE',AT:'AUT',IE:'IRL',VN:'VNM',CZ:'CZE',
  HK:'HKG',SA:'SAU',ZA:'ZAF',IL:'ISR',NO:'NOR',PH:'PHL',PT:'PRT',DK:'DNK',FI:'FIN',HU:'HUN',
  GR:'GRC',NZ:'NZL',AR:'ARG',EG:'EGY',NG:'NGA',CL:'CHL',CO:'COL',RO:'ROU',PK:'PAK',BD:'BGD',
  RU:'RUS',
};

/** M49 → ISO2 (subset — extend from api-wits if a new partner appears). */
const M49_TO_ISO2 = {
  '4':'AF','8':'AL','12':'DZ','24':'AO','31':'AZ','32':'AR','36':'AU','40':'AT','44':'BS','48':'BH',
  '50':'BD','51':'AM','56':'BE','64':'BT','68':'BO','70':'BA','72':'BW','76':'BR','84':'BZ','90':'SB',
  '96':'BN','100':'BG','104':'MM','108':'BI','112':'BY','116':'KH','120':'CM','124':'CA','132':'CV','140':'CF',
  '144':'LK','148':'TD','152':'CL','156':'CN','170':'CO','174':'KM','178':'CG','180':'CD','188':'CR','191':'HR',
  '192':'CU','196':'CY','203':'CZ','204':'BJ','208':'DK','214':'DO','218':'EC','222':'SV','226':'GQ','231':'ET',
  '232':'ER','233':'EE','238':'FK','242':'FJ','246':'FI','251':'FR','262':'DJ','266':'GA','268':'GE','270':'GM',
  '275':'PS','276':'DE','288':'GH','300':'GR','304':'GL','320':'GT','324':'GN','328':'GY','332':'HT','340':'HN',
  '344':'HK','348':'HU','352':'IS','360':'ID','364':'IR','368':'IQ','372':'IE','376':'IL','381':'IT','384':'CI',
  '388':'JM','392':'JP','398':'KZ','400':'JO','404':'KE','408':'KP','410':'KR','412':'XK','414':'KW','417':'KG',
  '418':'LA','422':'LB','426':'LS','428':'LV','430':'LR','434':'LY','440':'LT','442':'LU','450':'MG','454':'MW',
  '458':'MY','466':'ML','478':'MR','480':'MU','484':'MX','490':'TW','496':'MN','498':'MD','499':'ME','504':'MA',
  '508':'MZ','512':'OM','516':'NA','524':'NP','528':'NL','540':'NC','548':'VU','554':'NZ','558':'NI','562':'NE',
  '566':'NG','578':'NO','579':'NO','586':'PK','591':'PA','598':'PG','600':'PY','604':'PE','608':'PH','616':'PL',
  '620':'PT','624':'GW','626':'TL','630':'PR','634':'QA','642':'RO','643':'RU','646':'RW','678':'ST','682':'SA',
  '686':'SN','688':'RS','690':'SC','694':'SL','699':'IN','702':'SG','703':'SK','704':'VN','705':'SI','706':'SO',
  '710':'ZA','716':'ZW','724':'ES','728':'SS','729':'SD','732':'EH','740':'SR','748':'SZ','752':'SE','756':'CH',
  '760':'SY','762':'TJ','764':'TH','768':'TG','780':'TT','784':'AE','788':'TN','792':'TR','795':'TM','800':'UG',
  '804':'UA','807':'MK','818':'EG','826':'GB','834':'TZ','840':'US','842':'US','854':'BF','858':'UY','860':'UZ',
  '862':'VE','887':'YE','894':'ZM',
};

/** ISO2 → M49 reverse map, built once at module load. */
const ISO2_TO_M49 = {};
for (const [m49, iso2] of Object.entries(M49_TO_ISO2)) {
  // Some countries (US, NO) have multiple M49 entries; the LAST one wins
  // and that matches what Comtrade actually accepts in queries.
  ISO2_TO_M49[iso2] = m49;
}
// Force-pin the "official" codes for countries with multiple M49s
ISO2_TO_M49.US = '842';
ISO2_TO_M49.NO = '579';

// ─────────────────────────────────────────────────────────────────────────────
// Comtrade fetchers
// ─────────────────────────────────────────────────────────────────────────────

async function comtradeFetch(url) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(withKey(url), { signal: ctrl.signal });
    if (res.status === 429) {
      // Rate-limited — back off 60 s and retry once
      console.warn('  ⏸  429 rate-limited, sleeping 60 s and retrying');
      await sleep(60_000);
      const res2 = await fetch(withKey(url), { signal: ctrl.signal });
      if (!res2.ok) return null;
      return await res2.json();
    }
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`  ⚠  fetch failed: ${err.message}`);
    return null;
  } finally {
    clearTimeout(tid);
  }
}

/**
 * Resolve a Comtrade row to its "effective partner" M49 code.
 *
 * Comtrade has two ways to encode a trade partner:
 *   1. Direct:  partnerCode=X partner2Code=X (or 0/899) — most non-EU trade
 *   2. Mirror:  partnerCode=0 partner2Code=X            — common for intra-EU
 *      where the reporter doesn't directly declare the partner and Comtrade
 *      fills in from the partner's own export records.
 *
 * Without handling case (2), reporters like Germany or France appear to have
 * absurd top-partners lists (Greece, Bangladesh, Zimbabwe) because all of
 * their actual top partners use the partnerCode=0 mirror format.
 *
 * Returns null for world aggregates (both codes 0), aggregate regions
 * (899 etc.), and self-trade rows.
 */
function effectivePartnerM49(r, reporterM49) {
  const pc  = String(r.partnerCode  ?? '');
  const p2c = String(r.partner2Code ?? '');
  // Prefer partnerCode when it points to a real country
  const candidate =
    (pc  !== '0' && pc  !== '899' && pc  !== '') ? pc  :
    (p2c !== '0' && p2c !== '899' && p2c !== '') ? p2c : null;
  if (!candidate || candidate === reporterM49) return null;
  return candidate;
}

/**
 * Fetch top trading partners for a reporter in one direction.
 * Uses the "effective partner" rule so intra-EU mirror data isn't silently
 * dropped (which would leave Germany/France/etc. with garbage partner lists).
 * Max-value-wins per partner avoids re-export double counting.
 * Returns: [{ iso2, valueUsd, share }, ...] sorted desc.
 */
async function fetchPartners(reporterM49, year, direction) {
  const flowCode = direction === 'exports' ? 'X' : 'M';
  const url =
    `${COMTRADE_BASE}?reporterCode=${reporterM49}` +
    `&period=${year}` +
    `&cmdCode=TOTAL` +
    `&flowCode=${flowCode}` +
    `&motCode=0` +
    `&customsCode=C00`;

  const json = await comtradeFetch(url);
  if (!json || !Array.isArray(json.data)) return null;

  // Bucket by ISO2 and keep the MAX value seen.  Across `partner2Code`
  // re-export variants, max-wins picks the "primary" / largest row for
  // each partner — preferable to first-write-wins because Comtrade's row
  // order isn't guaranteed.
  const byIso2 = new Map();
  for (const r of json.data) {
    const partnerM49 = effectivePartnerM49(r, reporterM49);
    if (!partnerM49) continue;
    const iso2 = M49_TO_ISO2[partnerM49];
    if (!iso2) continue;             // skip aggregate regions
    const value = typeof r.primaryValue === 'number' ? r.primaryValue : 0;
    if (value <= 0) continue;
    const existing = byIso2.get(iso2);
    if (!existing || value > existing.valueUsd) {
      byIso2.set(iso2, { iso2, valueUsd: Math.round(value) });
    }
  }
  const rows = [...byIso2.values()];
  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + r.valueUsd, 0);
  for (const r of rows) r.share = total > 0 ? r.valueUsd / total : 0;
  rows.sort((a, b) => b.valueUsd - a.valueUsd);
  return rows;
}

/**
 * Fetch HS-Chapter (AG2) breakdown for one bilateral pair.
 * Returns: [{ code, valueUsd, share }, ...] sorted desc.
 */
async function fetchBilateralChapters(reporterM49, partnerM49, year, direction) {
  const flowCode = direction === 'exports' ? 'X' : 'M';
  const url =
    `${COMTRADE_BASE}?reporterCode=${reporterM49}` +
    `&period=${year}` +
    `&partnerCode=${partnerM49}` +
    `&cmdCode=AG2` +
    `&flowCode=${flowCode}` +
    `&motCode=0` +
    `&customsCode=C00`;

  const json = await comtradeFetch(url);
  if (!json || !Array.isArray(json.data)) return null;

  const seen = new Set();
  const rows = [];
  for (const r of json.data) {
    const code = String(r.cmdCode ?? '');
    if (!code || code === 'TOTAL' || code === 'ALL') continue;
    if (seen.has(code)) continue;
    seen.add(code);
    const value = typeof r.primaryValue === 'number' ? r.primaryValue : 0;
    if (value <= 0) continue;
    rows.push({ code, valueUsd: Math.round(value), share: 0 });
  }
  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + r.valueUsd, 0);
  for (const r of rows) r.share = total > 0 ? r.valueUsd / total : 0;
  rows.sort((a, b) => b.valueUsd - a.valueUsd);
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-reporter pipeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Walk year fallback chain until partners data shows up for this reporter.
 * Returns { year, partners } or null when nothing reported in any year.
 */
async function findPartnersWithYearFallback(reporterM49, direction) {
  const years = [PRIMARY_YEAR, PRIMARY_YEAR - 1, PRIMARY_YEAR - 2];
  for (const y of years) {
    const partners = await fetchPartners(reporterM49, y, direction);
    await sleep(DELAY_MS);
    if (partners && partners.length > 0) return { year: y, partners };
    console.log(`    no ${direction} partners for ${y}, trying ${y - 1}`);
  }
  return null;
}

async function buildReporter(iso2) {
  const iso3        = ISO2_TO_ISO3[iso2];
  const reporterM49 = iso3 ? ISO3_TO_M49[iso3] : null;
  if (!reporterM49) {
    console.warn(`  ⚠  no M49 for ${iso2} — skipping`);
    return null;
  }

  const result = { reporter: iso2, exports: {}, imports: {} };

  for (const direction of ['exports', 'imports']) {
    console.log(`  → ${direction}`);
    const partnersResult = await findPartnersWithYearFallback(reporterM49, direction);
    if (!partnersResult) {
      console.log(`    × no ${direction} data in any fallback year`);
      continue;
    }
    const { year, partners } = partnersResult;
    const top = partners.slice(0, TOP_PARTNERS_PER_DIRECTION);

    for (const p of top) {
      const partnerM49 = ISO2_TO_M49[p.iso2];
      if (!partnerM49) {
        console.log(`    ? skipped ${p.iso2} (no M49)`);
        continue;
      }
      const chapters = await fetchBilateralChapters(reporterM49, partnerM49, year, direction);
      await sleep(DELAY_MS);
      if (!chapters || chapters.length === 0) {
        console.log(`    ? ${iso2}→${p.iso2}: no chapter data`);
        continue;
      }
      const top10 = chapters.slice(0, TOP_CHAPTERS);
      const totalUsd = top10.reduce((s, r) => s + r.valueUsd, 0);
      result[direction][p.iso2] = {
        year,
        totalUsd: Math.round(totalUsd),
        topChapters: top10,
      };
      console.log(`    ✓ ${iso2}→${p.iso2} (${year}, ${chapters.length} chapters)`);
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = { reporters: null, force: false };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--force') args.force = true;
    else if (a === '--reporters') args.reporters = (process.argv[++i] ?? '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  }
  return args;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const args = parseArgs();
  const targets = (args.reporters && args.reporters.length > 0) ? args.reporters : TOP_REPORTERS;

  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Ingesting bilateral trade · version=${VERSION} · year=${PRIMARY_YEAR}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Reporters: ${targets.join(', ')}`);
  console.log(`Delay between calls: ${DELAY_MS} ms`);
  console.log('');

  let processed = 0;
  let skipped   = 0;
  let failed    = 0;

  for (const iso2 of targets) {
    const outPath = resolve(OUTPUT_DIR, `${iso2}.json`);
    if (existsSync(outPath) && !args.force) {
      console.log(`◌ ${iso2} (cached, skipping — use --force to refetch)`);
      skipped++;
      continue;
    }

    console.log(`▸ ${iso2}`);
    const result = await buildReporter(iso2);

    if (!result || (Object.keys(result.exports).length + Object.keys(result.imports).length === 0)) {
      console.log(`  × ${iso2}: no data\n`);
      failed++;
      continue;
    }

    writeFileSync(outPath, JSON.stringify(result));
    const sizeKb = (JSON.stringify(result).length / 1024).toFixed(1);
    console.log(`  ✓ wrote ${iso2}.json (${sizeKb} KB)\n`);
    processed++;
  }

  // Build manifest from whatever ended up in the output dir
  const reporters = readdirSync(OUTPUT_DIR)
    .filter((n) => n.endsWith('.json'))
    .map((n) => n.replace(/\.json$/, ''))
    .sort();

  const manifest = {
    version:   VERSION,
    year:      PRIMARY_YEAR,
    generated: new Date().toISOString(),
    reporters,
  };
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log('─'.repeat(60));
  console.log(`Done. processed=${processed} skipped=${skipped} failed=${failed}`);
  console.log(`Manifest: ${MANIFEST_PATH}`);
  console.log(`Reporters in manifest: ${reporters.length}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
