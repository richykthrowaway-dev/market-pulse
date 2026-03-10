/**
 * One-time sync: populate symbols.country from DefeatBeta profile data.
 *
 * Reads symbol→country mappings from the DefeatBeta backend's /api/bulk-countries
 * endpoint (which queries HuggingFace stock_profile.parquet via DuckDB), then
 * batch-updates the Supabase `symbols` table.
 *
 * Usage:
 *   1. Ensure DefeatBeta backend is running on localhost:4400
 *   2. Run: node backend/sync-countries.js
 *
 * This populates the `country` field so the globe screener works for ALL countries.
 */

const BACKEND_URL = 'http://localhost:4400';
const SUPABASE_URL = 'https://fzokumkbgvwsyftwwprx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b2t1bWtiZ3Z3c3lmdHd3cHJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTM2MDAsImV4cCI6MjA4ODMyOTYwMH0.7gg92KfZxouICjHJAwSeImmnqVxQhK7Evt8xit5vMYE';

// Map Yahoo Finance country names → ISO 3166-1 alpha-2 codes
const COUNTRY_TO_ISO2 = {
  'United States': 'US', 'Canada': 'CA', 'United Kingdom': 'GB',
  'Germany': 'DE', 'France': 'FR', 'Japan': 'JP',
  'Hong Kong': 'HK', 'Australia': 'AU', 'India': 'IN',
  'Brazil': 'BR', 'South Korea': 'KR', 'China': 'CN',
  'Italy': 'IT', 'Spain': 'ES', 'Netherlands': 'NL',
  'Switzerland': 'CH', 'Sweden': 'SE', 'Norway': 'NO',
  'Denmark': 'DK', 'Finland': 'FI', 'Belgium': 'BE',
  'Ireland': 'IE', 'Portugal': 'PT', 'Austria': 'AT',
  'Greece': 'GR', 'Poland': 'PL', 'Czech Republic': 'CZ',
  'Czechia': 'CZ', 'Hungary': 'HU', 'Romania': 'RO',
  'Russia': 'RU', 'Turkey': 'TR', 'Israel': 'IL',
  'Saudi Arabia': 'SA', 'United Arab Emirates': 'AE', 'Qatar': 'QA',
  'Kuwait': 'KW', 'South Africa': 'ZA', 'Nigeria': 'NG',
  'Egypt': 'EG', 'Kenya': 'KE', 'Morocco': 'MA',
  'Taiwan': 'TW', 'Singapore': 'SG', 'Indonesia': 'ID',
  'Thailand': 'TH', 'Malaysia': 'MY', 'Philippines': 'PH',
  'Vietnam': 'VN', 'New Zealand': 'NZ', 'Mexico': 'MX',
  'Argentina': 'AR', 'Colombia': 'CO', 'Chile': 'CL',
  'Peru': 'PE', 'Iceland': 'IS', 'Luxembourg': 'LU',
  'Malta': 'MT', 'Cyprus': 'CY', 'Estonia': 'EE',
  'Latvia': 'LV', 'Lithuania': 'LT', 'Slovakia': 'SK',
  'Slovenia': 'SI', 'Croatia': 'HR', 'Serbia': 'RS',
  'Bulgaria': 'BG', 'Uruguay': 'UY', 'Panama': 'PA',
  'Costa Rica': 'CR', 'Jamaica': 'JM', 'Bermuda': 'BM',
  'Cayman Islands': 'KY', 'Jersey': 'JE', 'Guernsey': 'GG',
  'Isle of Man': 'IM', 'Monaco': 'MC', 'Liechtenstein': 'LI',
  'Pakistan': 'PK', 'Bangladesh': 'BD', 'Sri Lanka': 'LK',
  'Macau': 'MO', 'Cambodia': 'KH', 'Myanmar': 'MM',
  'Bahrain': 'BH', 'Oman': 'OM', 'Jordan': 'JO',
  'Lebanon': 'LB', 'Georgia': 'GE', 'Kazakhstan': 'KZ',
  'Ukraine': 'UA',
};

async function fetchPage(offset, limit) {
  const url = `${BACKEND_URL}/api/bulk-countries?offset=${offset}&limit=${limit}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Backend ${resp.status}: ${url}`);
  return resp.json();
}

async function upsertBatch(rows) {
  // Use Supabase REST API directly for batch upsert
  const url = `${SUPABASE_URL}/rest/v1/symbols`;
  const body = rows.map(r => ({
    canonical_ticker: r.symbol,
    country: r.iso2,
    sector: r.sector || null,
  }));

  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    // Supabase doesn't support batch PATCH — use individual updates
  });
  // Actually, we need to do individual updates or use upsert
  // Let's use a different approach: update each symbol's country
}

// More efficient: use Supabase RPC or batch update per country
async function updateCountryBatch(iso2, symbols) {
  // Update all symbols for this country in one call using PostgREST filter
  // PATCH /rest/v1/symbols?canonical_ticker=in.(SYM1,SYM2,...) { country: iso2 }
  const chunkSize = 200; // PostgREST URL length limit
  for (let i = 0; i < symbols.length; i += chunkSize) {
    const chunk = symbols.slice(i, i + chunkSize);
    const filter = `canonical_ticker=in.(${chunk.map(s => `"${s}"`).join(',')})`;
    const url = `${SUPABASE_URL}/rest/v1/symbols?${filter}`;

    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ country: iso2 }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`  ✗ PATCH failed for ${iso2} chunk ${i}: ${resp.status} ${text}`);
    }
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  Sync: DefeatBeta profiles → Supabase symbols.country  ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // Step 1: Fetch all symbol→country pairs from DefeatBeta
  console.log('Step 1: Fetching symbol→country mappings from DefeatBeta...');
  const allMappings = [];
  let offset = 0;
  const pageSize = 2000;
  let hasMore = true;

  while (hasMore) {
    const page = await fetchPage(offset, pageSize);
    allMappings.push(...page.data);
    console.log(`  Fetched ${page.data.length} rows (offset ${offset}, total so far: ${allMappings.length})`);
    hasMore = page.data.length === pageSize;
    offset += pageSize;
  }

  console.log(`\n  Total profiles with country: ${allMappings.length}\n`);

  // Step 2: Group by ISO2 country code
  console.log('Step 2: Grouping by country...');
  const byCountry = new Map();
  let unmapped = 0;

  for (const row of allMappings) {
    const iso2 = COUNTRY_TO_ISO2[row.country];
    if (!iso2) {
      unmapped++;
      continue;
    }
    if (!byCountry.has(iso2)) byCountry.set(iso2, []);
    byCountry.get(iso2).push(row.symbol);
  }

  console.log(`  Countries found: ${byCountry.size}`);
  console.log(`  Unmapped country names: ${unmapped}`);

  // Show top countries by stock count
  const sorted = [...byCountry.entries()].sort((a, b) => b[1].length - a[1].length);
  console.log('\n  Top 15 countries by stock count:');
  for (const [iso2, syms] of sorted.slice(0, 15)) {
    console.log(`    ${iso2}: ${syms.length} stocks`);
  }

  // Step 3: Batch update Supabase
  console.log('\nStep 3: Updating Supabase symbols.country...');
  let updated = 0;

  for (const [iso2, symbols] of sorted) {
    process.stdout.write(`  ${iso2} (${symbols.length} stocks)...`);
    await updateCountryBatch(iso2, symbols);
    updated += symbols.length;
    console.log(` ✓`);
  }

  console.log(`\n✅ Done! Updated ${updated} symbols across ${byCountry.size} countries.`);
  console.log('   The globe screener should now show stocks for all countries.\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
