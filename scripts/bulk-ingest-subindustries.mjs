#!/usr/bin/env node
/**
 * bulk-ingest-subindustries.mjs
 *
 * Drives the `ingest-fundamentals-bulk` edge function to populate
 * `gics_sub_industry` for every ticker in the Supabase `symbols` table
 * by repeatedly calling the function until all tickers are tagged.
 *
 * Why a separate script?
 *   Each edge-function invocation is bounded by Supabase's 25-second
 *   wall-time limit, so it can only handle ~50 tickers per call. With
 *   ~47K stocks in the table that's ~940 invocations. This script runs
 *   them sequentially with backoff and progress reporting.
 *
 * Resumability:
 *   The edge function returns `last_ticker` after each batch. We pass
 *   it back as `resume_after` on the next call so we never re-process
 *   the same ticker. Progress is also saved to .ingest-progress.json
 *   so a Ctrl-C / network blip / crash can resume from the last batch.
 *
 * Run:
 *   node scripts/bulk-ingest-subindustries.mjs
 *
 * Optional flags:
 *   --limit-per-call=50     Tickers per edge-function call (max 50)
 *   --max-batches=N         Stop after N edge-function calls (for testing)
 *   --target=sub_industry   Filter on missing gics_sub_industry (default)
 *   --target=sector         Filter on missing gics_sector
 *   --restart               Ignore .ingest-progress.json and start over
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot  = path.resolve(__dirname, '..');
const envPath   = path.join(repoRoot, '.env');
const stateFile = path.join(repoRoot, '.ingest-progress.json');

// ── Parse .env (no dotenv dependency) ───────────────────────────────────────
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=["']?(.+?)["']?\s*$/);
  if (m) env[m[1]] = m[2];
}
const PROJECT_ID = env.VITE_SUPABASE_PROJECT_ID;
const ANON_KEY   = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!PROJECT_ID || !ANON_KEY) {
  console.error('Missing VITE_SUPABASE_PROJECT_ID or VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const LIMIT_PER_CALL = Math.min(Number(args['limit-per-call'] || 50), 50);
const MAX_BATCHES    = args['max-batches'] ? Number(args['max-batches']) : Infinity;
const TARGET         = args.target === 'sector' ? 'sector' : 'sub_industry';
const RESTART        = !!args.restart;

// ── Restore previous progress ──────────────────────────────────────────────
let state = { lastTicker: null, totalProcessed: 0, totalFailed: 0, batches: 0, startedAt: null };
if (!RESTART && fs.existsSync(stateFile)) {
  try {
    state = { ...state, ...JSON.parse(fs.readFileSync(stateFile, 'utf8')) };
    console.log(`▶ Resuming from ticker after "${state.lastTicker}"  ` +
                `(processed=${state.totalProcessed}, failed=${state.totalFailed}, batches=${state.batches})`);
  } catch { /* corrupt file — start fresh */ }
}
if (!state.startedAt) state.startedAt = new Date().toISOString();

const saveState = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

// ── Edge-function caller with retries ──────────────────────────────────────
const FN_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/ingest-fundamentals-bulk`;

async function callEdgeFn(resumeAfter, attempt = 1) {
  const body = {
    limit:    LIMIT_PER_CALL,
    missing:  TARGET,
    ...(resumeAfter ? { resume_after: resumeAfter } : {}),
  };
  const res = await fetch(FN_URL, {
    method:  'POST',
    headers: {
      apikey:        ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type':'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    if (attempt < 4) {
      const delay = 2000 * attempt;
      console.warn(`  ✗ HTTP ${res.status} — retry ${attempt}/3 in ${delay}ms`);
      console.warn(`    response: ${text.slice(0, 200)}`);
      await new Promise(r => setTimeout(r, delay));
      return callEdgeFn(resumeAfter, attempt + 1);
    }
    throw new Error(`Edge fn failed after 3 retries: HTTP ${res.status} — ${text.slice(0, 300)}`);
  }
  try { return JSON.parse(text); }
  catch { throw new Error(`Edge fn returned non-JSON: ${text.slice(0, 200)}`); }
}

// ── Pretty timing ──────────────────────────────────────────────────────────
function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ── Main loop ──────────────────────────────────────────────────────────────
async function main() {
  console.log('═'.repeat(70));
  console.log(`  Bulk-ingest GICS sub-industries (target: missing ${TARGET})`);
  console.log(`  Project:    ${PROJECT_ID}`);
  console.log(`  Per-call:   ${LIMIT_PER_CALL} tickers`);
  console.log(`  Started:    ${state.startedAt}`);
  console.log('═'.repeat(70));

  const startTime = Date.now();
  let consecutiveEmpty = 0;

  while (state.batches < MAX_BATCHES) {
    const t0 = Date.now();
    let result;
    try {
      result = await callEdgeFn(state.lastTicker);
    } catch (err) {
      console.error(`✗ Fatal error: ${err.message}`);
      console.error('  Progress saved. Re-run the script to resume.');
      process.exit(1);
    }
    const duration = Date.now() - t0;

    // Empty result → done
    if (result.processed === 0 && result.total === 0) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= 2) {
        console.log('\n✔ All tickers tagged — nothing left to process.');
        break;
      }
      // Sometimes a single empty page happens mid-stream; try once more
      console.log('  (empty page, checking once more…)');
      state.lastTicker = result.last_ticker || state.lastTicker;
      saveState();
      continue;
    }
    consecutiveEmpty = 0;

    state.batches++;
    state.totalProcessed += result.processed || 0;
    state.totalFailed    += result.failed    || 0;
    if (result.last_ticker) state.lastTicker = result.last_ticker;
    saveState();

    const elapsed = Date.now() - startTime;
    const rate    = state.totalProcessed > 0 ? elapsed / state.totalProcessed : 0;
    const remaining = state.totalProcessed > 0
      ? `~${fmtDuration(rate * 47000)} remaining for full 47K`
      : '';

    console.log(
      `[${String(state.batches).padStart(4)}] ` +
      `+${String(result.processed || 0).padStart(2)}p ${String(result.failed || 0).padStart(2)}f  ` +
      `last=${(state.lastTicker || '').padEnd(10)} ` +
      `${(duration / 1000).toFixed(1)}s | ` +
      `total=${state.totalProcessed} | ` +
      `${remaining}`,
    );

    // Light pause between calls so we don't hammer Supabase
    await new Promise(r => setTimeout(r, 500));
  }

  const elapsed = Date.now() - startTime;
  console.log('\n' + '═'.repeat(70));
  console.log(`  Done. Batches: ${state.batches}, ` +
              `processed: ${state.totalProcessed}, failed: ${state.totalFailed}`);
  console.log(`  Wall time:  ${fmtDuration(elapsed)}`);
  console.log(`  Progress saved to ${path.relative(repoRoot, stateFile)}`);
  console.log('═'.repeat(70));
}

main().catch(e => { console.error(e); process.exit(1); });
