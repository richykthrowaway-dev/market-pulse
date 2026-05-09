#!/usr/bin/env node
/**
 * bulk-ingest-via-bulk-endpoint.mjs
 *
 * Drives the `ingest-bulk-fundamentals` edge function to populate
 * GICS sector / industry-group / industry / sub-industry for every ticker
 * in the Supabase `symbols` table — using EODHD's /bulk-fundamentals
 * endpoint, which is ~50× cheaper on quota than per-ticker /fundamentals.
 *
 * Cost math (47K-ticker DB):
 *   Per-ticker /fundamentals:  47,000 × 10  = 470,000 credits  (~5 days)
 *   Bulk /bulk-fundamentals:    94 × 100    =   9,400 credits  (~10% of one day)
 *
 * One quota fact: each /bulk-fundamentals call = 100 credits flat,
 * regardless of how many tickers come back, so always max out limit=500.
 *
 * Run:
 *   node scripts/bulk-ingest-via-bulk-endpoint.mjs
 *
 * Optional flags:
 *   --exchanges=US,LSE,TO,V,AX    Comma list of EODHD exchange codes (default: US)
 *   --max-pages-per-call=5        Pages of 500 tickers per edge-fn invocation
 *   --max-batches=N               Stop after N edge-fn invocations
 *   --restart                     Ignore .ingest-bulk-progress.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot  = path.resolve(__dirname, '..');
const envPath   = path.join(repoRoot, '.env');
const stateFile = path.join(repoRoot, '.ingest-bulk-progress.json');

// ── Parse .env ──────────────────────────────────────────────────────────────
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=["']?(.+?)["']?\s*$/);
  if (m) env[m[1]] = m[2];
}
const PROJECT_ID = env.VITE_SUPABASE_PROJECT_ID;
const ANON_KEY   = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!PROJECT_ID || !ANON_KEY) {
  console.error('Missing VITE_SUPABASE_PROJECT_ID / VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}

// ── Args ────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const EXCHANGES = (args.exchanges || 'US').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
const MAX_PAGES_PER_CALL = Number(args['max-pages-per-call'] || 5);
const MAX_BATCHES        = args['max-batches'] ? Number(args['max-batches']) : Infinity;
const RESTART            = !!args.restart;

// ── State ───────────────────────────────────────────────────────────────────
//   {
//     exchanges: { US: { offset: 1500, done: false, totalSeen: 1500, totalWritten: 1480 }, ... }
//     batches: 5,
//     creditsUsed: 1500,
//     startedAt: "..."
//   }
let state = { exchanges: {}, batches: 0, creditsUsed: 0, startedAt: null };
if (!RESTART && fs.existsSync(stateFile)) {
  try { state = { ...state, ...JSON.parse(fs.readFileSync(stateFile, 'utf8')) }; }
  catch { /* corrupt — start fresh */ }
}
for (const ex of EXCHANGES) {
  if (!state.exchanges[ex]) state.exchanges[ex] = { offset: 0, done: false, totalSeen: 0, totalWritten: 0 };
}
if (!state.startedAt) state.startedAt = new Date().toISOString();
const saveState = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

// ── Edge-fn caller ──────────────────────────────────────────────────────────
const FN_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/ingest-bulk-fundamentals`;

async function callEdgeFn(payload, attempt = 1) {
  const res = await fetch(FN_URL, {
    method:  'POST',
    headers: {
      apikey:        ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type':'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  const j = (() => { try { return JSON.parse(text); } catch { return { error: text.slice(0, 200) }; }})();
  if (!res.ok) {
    // EODHD quota exhaustion is permanent until tomorrow — bail immediately
    const detail = String(j.detail || j.error || '');
    if (/exceed|limit|quota/i.test(detail)) {
      throw new Error(`QUOTA_EXCEEDED: ${detail}`);
    }
    if (attempt < 4) {
      const delay = 2000 * attempt;
      console.warn(`  ✗ HTTP ${res.status} — retry ${attempt}/3 in ${delay}ms`);
      console.warn(`    response: ${(text || '').slice(0, 200)}`);
      await new Promise(r => setTimeout(r, delay));
      return callEdgeFn(payload, attempt + 1);
    }
    throw new Error(`Edge fn failed after 3 retries: ${text.slice(0, 300)}`);
  }
  return j;
}

function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ── Main loop ───────────────────────────────────────────────────────────────
async function main() {
  console.log('═'.repeat(74));
  console.log(`  Bulk-ingest GICS via /bulk-fundamentals  (50× cheaper than per-ticker)`);
  console.log(`  Exchanges:  ${EXCHANGES.join(', ')}`);
  console.log(`  Pages/call: ${MAX_PAGES_PER_CALL} (${MAX_PAGES_PER_CALL * 500} tickers/invocation)`);
  console.log(`  Project:    ${PROJECT_ID}`);
  console.log(`  Started:    ${state.startedAt}`);
  console.log('═'.repeat(74));

  const startTime = Date.now();

  outer:
  for (const exchange of EXCHANGES) {
    const ex = state.exchanges[exchange];
    if (ex.done) {
      console.log(`✔ ${exchange} already complete — skipping`);
      continue;
    }

    while (!ex.done) {
      if (state.batches >= MAX_BATCHES) {
        console.log(`\n  --max-batches=${MAX_BATCHES} reached.`);
        break outer;
      }

      const t0 = Date.now();
      let result;
      try {
        result = await callEdgeFn({
          exchange,
          offset:    ex.offset,
          limit:     500,
          max_pages: MAX_PAGES_PER_CALL,
        });
      } catch (err) {
        if (String(err.message).startsWith('QUOTA_EXCEEDED')) {
          console.error(`\n✗ EODHD daily quota exhausted: ${err.message.slice(17)}`);
          console.error(`  Progress saved. Re-run tomorrow when the quota resets.`);
          process.exit(2);
        }
        console.error(`✗ Fatal: ${err.message}`);
        console.error(`  Progress saved. Re-run to resume.`);
        process.exit(1);
      }
      const duration = Date.now() - t0;

      ex.totalSeen    += result.tickers_seen    || 0;
      ex.totalWritten += result.tickers_written || 0;
      state.creditsUsed += result.credits_used  || 0;

      if (result.next_offset === null) {
        ex.done = true;
      } else {
        ex.offset = result.next_offset;
      }
      state.batches++;
      saveState();

      console.log(
        `[${String(state.batches).padStart(3)}] ${exchange.padEnd(4)} ` +
        `pages=${result.pages_done} ` +
        `seen=${String(result.tickers_seen).padStart(4)} ` +
        `wrote=${String(result.tickers_written).padStart(4)} ` +
        `${(duration / 1000).toFixed(1)}s | ` +
        `${exchange} total: ${ex.totalWritten}/${ex.totalSeen} | ` +
        `credits: ${state.creditsUsed}` +
        (ex.done ? `  ← exchange complete` : ` next_offset=${ex.offset}`),
      );

      // Brief pause between calls
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const elapsed = Date.now() - startTime;
  console.log('\n' + '═'.repeat(74));
  console.log(`  Done. Batches: ${state.batches}, credits used: ${state.creditsUsed}`);
  for (const [ex, s] of Object.entries(state.exchanges)) {
    console.log(`    ${ex.padEnd(4)}  ${s.totalWritten}/${s.totalSeen} written  ${s.done ? '✔' : `(next offset ${s.offset})`}`);
  }
  console.log(`  Wall time:  ${fmtDuration(elapsed)}`);
  console.log(`  State file: ${path.relative(repoRoot, stateFile)}`);
  console.log('═'.repeat(74));
}

main().catch(e => { console.error(e); process.exit(1); });
