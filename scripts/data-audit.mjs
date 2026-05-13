#!/usr/bin/env node
// scripts/data-audit.mjs
//
// Reusable data-pipeline audit for market-pulse.
//
//   Probes every edge function listed in scripts/audit-config.json and
//   reports status, latency, payload size, and a sample field. Also queries
//   key Supabase tables for row counts and freshness via the PostgREST API.
//
//   Writes a snapshot to audits/<timestamp>.json. If a previous snapshot
//   exists it prints a colourised diff (row counts, broken endpoints,
//   newly-stale tables) so you only have to read the deltas.
//
// Usage:
//   node scripts/data-audit.mjs                 # full audit, diff vs last
//   node scripts/data-audit.mjs --no-diff       # no diff
//   node scripts/data-audit.mjs --probe NAME    # probe one function only
//   node scripts/data-audit.mjs --verbose       # dump probe responses
//
// Reads .env (VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY) — no
// extra setup needed. The anon key is sufficient for public read tables;
// RLS-protected tables (snaptrade_*) will return 0 rows by design.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const AUDIT_DIR = join(ROOT, 'audits')
const CONFIG_PATH = join(__dirname, 'audit-config.json')

const args     = process.argv.slice(2)
const NO_DIFF  = args.includes('--no-diff')
const VERBOSE  = args.includes('--verbose')
const PROBE    = args.find((a) => a.startsWith('--probe='))?.split('=')[1]
                  ?? (args[args.indexOf('--probe') + 1] && !args[args.indexOf('--probe') + 1].startsWith('--')
                      ? args[args.indexOf('--probe') + 1]
                      : null)

// ─────────────────────────────────────────────────────────────────────
// Env + config
// ─────────────────────────────────────────────────────────────────────

const env = parseEnv(readFileSync(join(ROOT, '.env'), 'utf8'))
const SUPABASE_URL = env.VITE_SUPABASE_URL
const ANON_KEY     = env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env')
  process.exit(1)
}

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))

function parseEnv(text) {
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────
// Probes
// ─────────────────────────────────────────────────────────────────────

const COLOR = {
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
}

async function probeFunction({ name, qs, expect, method, body }) {
  const url = `${SUPABASE_URL}/functions/v1/${name}${qs ? '?' + qs : ''}`
  const t0 = performance.now()
  let status = 0
  let bodyText = ''
  let json = null
  try {
    const res = await fetch(url, {
      method: method ?? 'GET',
      headers: {
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    status = res.status
    bodyText = await res.text()
    try { json = JSON.parse(bodyText) } catch { /* leave as text */ }
  } catch (err) {
    return {
      name,
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - t0),
      bytes: 0,
      error: String(err),
    }
  }
  const ms = Math.round(performance.now() - t0)
  const bytes = bodyText.length

  let expectOk = true
  if (expect && json) {
    expectOk = expect in json || (Array.isArray(json) && json.length > 0)
  }

  return {
    name,
    ok: status >= 200 && status < 300 && expectOk,
    status,
    ms,
    bytes,
    sample: sampleOf(json, expect),
    error: status >= 400 ? bodyText.slice(0, 120) : null,
  }
}

function sampleOf(json, expectKey) {
  if (json == null) return null
  if (Array.isArray(json)) return { __array: true, length: json.length }
  if (expectKey && expectKey in json) {
    const v = json[expectKey]
    if (Array.isArray(v)) return { [expectKey]: `array(${v.length})` }
    if (typeof v === 'object' && v != null) return { [expectKey]: `object(${Object.keys(v).length} keys)` }
    return { [expectKey]: v }
  }
  return { keys: Object.keys(json).slice(0, 6) }
}

// ─────────────────────────────────────────────────────────────────────
// Table probes
// ─────────────────────────────────────────────────────────────────────

async function probeTable({ name, freshnessColumn }) {
  // PostgREST: HEAD with Prefer: count=exact returns Content-Range "0-N-1/total"
  const countUrl = `${SUPABASE_URL}/rest/v1/${name}?select=*`
  const t0 = performance.now()
  let rows = null
  let freshness = null
  let error = null
  try {
    const headRes = await fetch(countUrl, {
      method: 'HEAD',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    })
    // 200 and 206 (Partial Content) are both valid; PostgREST returns 206
    // whenever the response is range-limited (Prefer: count=exact + Range).
    if (headRes.status >= 400) {
      error = `${headRes.status} ${headRes.statusText}`
    } else {
      const cr = headRes.headers.get('content-range') ?? ''
      const m = cr.match(/\/(\d+|\*)/)
      rows = m && m[1] !== '*' ? parseInt(m[1], 10) : null
    }

    if (freshnessColumn && !error) {
      const freshUrl = `${SUPABASE_URL}/rest/v1/${name}?select=${freshnessColumn}&order=${freshnessColumn}.desc&limit=1`
      const fr = await fetch(freshUrl, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      })
      if (fr.ok) {
        const arr = await fr.json()
        freshness = arr?.[0]?.[freshnessColumn] ?? null
      }
    }
  } catch (err) {
    error = String(err)
  }
  return {
    name,
    rows,
    freshness,
    freshnessHoursAgo: hoursAgo(freshness),
    ms: Math.round(performance.now() - t0),
    error,
  }
}

function hoursAgo(iso) {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.round((Date.now() - t) / 3_600_000)
}

// ─────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────

console.log(COLOR.cyan(`\n📊 market-pulse data audit — ${new Date().toISOString()}\n`))

const fnList = PROBE
  ? config.edgeFunctions.filter((p) => p.name === PROBE)
  : config.edgeFunctions

const tableList = PROBE ? [] : config.tables

console.log(`Probing ${fnList.length} edge functions in parallel…`)
const fnResults = await Promise.all(fnList.map(probeFunction))

console.log(`Probing ${tableList.length} tables…`)
const tableResults = await Promise.all(tableList.map(probeTable))

// ─────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────

console.log('\n' + COLOR.cyan('Edge Functions'))
console.log('─'.repeat(70))
console.log('NAME'.padEnd(28) + 'STATUS'.padEnd(8) + 'MS'.padEnd(8) + 'BYTES'.padEnd(10) + 'SAMPLE')
for (const r of fnResults) {
  const statusStr = r.ok
    ? COLOR.green(String(r.status))
    : COLOR.red(String(r.status))
  const ms = r.ms > config.thresholds.slowFunctionMs
    ? COLOR.yellow(`${r.ms}`)
    : `${r.ms}`
  const sampleStr = r.error
    ? COLOR.red(r.error.slice(0, 60))
    : JSON.stringify(r.sample).slice(0, 50)
  console.log(
    r.name.padEnd(28) +
    statusStr.padEnd(17) +
    ms.padEnd(8) +
    String(r.bytes).padEnd(10) +
    COLOR.dim(sampleStr),
  )
  if (VERBOSE && r.error) console.log('   ' + COLOR.red(r.error))
}

if (tableResults.length > 0) {
  console.log('\n' + COLOR.cyan('Tables'))
  console.log('─'.repeat(70))
  console.log('NAME'.padEnd(28) + 'ROWS'.padEnd(12) + 'FRESHNESS'.padEnd(22) + 'HOURS AGO')
  for (const t of tableResults) {
    const rowsStr = t.error ? COLOR.red('err') : (t.rows == null ? '—' : t.rows.toLocaleString())
    const freshStr = t.freshness ?? '—'
    const hoursStr = t.freshnessHoursAgo == null
      ? '—'
      : t.freshnessHoursAgo > config.thresholds.stalenessWarnHours
        ? COLOR.yellow(`${t.freshnessHoursAgo}h`)
        : COLOR.green(`${t.freshnessHoursAgo}h`)
    console.log(
      t.name.padEnd(28) +
      rowsStr.padEnd(12) +
      freshStr.slice(0, 20).padEnd(22) +
      hoursStr,
    )
    if (VERBOSE && t.error) console.log('   ' + COLOR.red(t.error))
  }
}

// ─────────────────────────────────────────────────────────────────────
// Snapshot + diff
// ─────────────────────────────────────────────────────────────────────

const snapshot = {
  timestamp: new Date().toISOString(),
  edgeFunctions: fnResults,
  tables: tableResults,
}

if (!existsSync(AUDIT_DIR)) mkdirSync(AUDIT_DIR, { recursive: true })

if (!NO_DIFF) {
  const prior = mostRecentSnapshot()
  if (prior) {
    console.log('\n' + COLOR.cyan(`Diff vs ${prior.path.replace(ROOT, '.')}`))
    console.log('─'.repeat(70))
    diff(prior.data, snapshot)
  } else {
    console.log('\n' + COLOR.dim('No prior snapshot — nothing to diff.'))
  }
}

const outPath = join(AUDIT_DIR, isoStamp() + '.json')
writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf8')
console.log('\n' + COLOR.dim(`Saved snapshot → ${outPath.replace(ROOT, '.')}`))

// Exit code reflects whether any probe failed (useful in CI)
const anyFailed = fnResults.some((r) => !r.ok) || tableResults.some((t) => t.error)
process.exit(anyFailed ? 1 : 0)

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function isoStamp() {
  const d = new Date()
  return [
    d.getUTCFullYear(),
    pad(d.getUTCMonth() + 1),
    pad(d.getUTCDate()),
  ].join('-') + 'T' + [
    pad(d.getUTCHours()),
    pad(d.getUTCMinutes()),
  ].join('')
}
function pad(n) { return String(n).padStart(2, '0') }

function mostRecentSnapshot() {
  if (!existsSync(AUDIT_DIR)) return null
  const files = readdirSync(AUDIT_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
  if (files.length === 0) return null
  const path = join(AUDIT_DIR, files[files.length - 1])
  return { path, data: JSON.parse(readFileSync(path, 'utf8')) }
}

function diff(prev, curr) {
  // Edge function status changes
  const prevFn = new Map(prev.edgeFunctions.map((r) => [r.name, r]))
  for (const r of curr.edgeFunctions) {
    const p = prevFn.get(r.name)
    if (!p) continue
    if (p.ok !== r.ok) {
      const arrow = r.ok ? COLOR.green('✓ recovered') : COLOR.red('✗ broken')
      console.log(`  ${r.name.padEnd(28)} ${arrow}  (was ${p.status} → now ${r.status})`)
    } else if (Math.abs(r.ms - p.ms) > 1000) {
      const slowed = r.ms > p.ms
      console.log(
        `  ${r.name.padEnd(28)} ${slowed ? COLOR.yellow('slower') : COLOR.green('faster')}  ${p.ms}ms → ${r.ms}ms`,
      )
    }
  }
  // Row count deltas
  const prevTbl = new Map(prev.tables.map((t) => [t.name, t]))
  for (const t of curr.tables) {
    const p = prevTbl.get(t.name)
    if (!p) continue
    if (t.rows != null && p.rows != null && t.rows !== p.rows) {
      const delta = t.rows - p.rows
      const sign = delta > 0 ? '+' : ''
      const col  = delta > 0 ? COLOR.green : COLOR.yellow
      console.log(
        `  ${t.name.padEnd(28)} ${col(`${sign}${delta.toLocaleString()}`)}  (${p.rows.toLocaleString()} → ${t.rows.toLocaleString()})`,
      )
    }
  }
}
