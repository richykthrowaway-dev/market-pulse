/**
 * run-ingest.cjs
 * Pages through all symbols and seeds GICS sector/industry/country
 * by calling ingest-fundamentals-bulk repeatedly with resume_after.
 *
 * Usage:
 *   node run-ingest.cjs              — start from beginning
 *   node run-ingest.cjs AAACX        — resume after a specific ticker
 */
const https = require('https');

const TOKEN       = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b2t1bWtiZ3Z3c3lmdHd3cHJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTM2MDAsImV4cCI6MjA4ODMyOTYwMH0.7gg92KfZxouICjHJAwSeImmnqVxQhK7Evt8xit5vMYE';
const BATCH_SIZE  = 50;   // tickers per call (edge fn caps at 50)
const PAUSE_MS    = 2000; // pause between calls (ms)

function invoke(resumeAfter) {
  return new Promise((resolve, reject) => {
    const payload = { limit: BATCH_SIZE };
    if (resumeAfter) payload.resume_after = resumeAfter;
    const body = JSON.stringify(payload);

    const req = https.request({
      hostname: 'fzokumkbgvwsyftwwprx.supabase.co',
      path:     '/functions/v1/ingest-fundamentals-bulk',
      method:   'POST',
      headers:  {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 60000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Bad JSON: ' + data.slice(0, 200))); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  let resumeAfter = process.argv[2] || null;
  let totalProcessed = 0;
  let totalFailed = 0;
  let round = 0;

  console.log(`Starting ingest${resumeAfter ? ` from after "${resumeAfter}"` : ''}`);
  console.log(`Batch size: ${BATCH_SIZE} | Pause between calls: ${PAUSE_MS}ms\n`);

  while (true) {
    round++;
    process.stdout.write(`Round ${round}${resumeAfter ? ` (after ${resumeAfter})` : ''}... `);

    let result;
    try {
      result = await invoke(resumeAfter);
    } catch (err) {
      console.log(`\nERROR: ${err.message} — retrying in 5s...`);
      await sleep(5000);
      continue;
    }

    if (result.error) {
      console.log(`\nFunction error: ${result.error}`);
      process.exit(1);
    }

    const { processed = 0, failed = 0, total = 0, next_resume_after } = result;
    totalProcessed += processed;
    totalFailed    += failed;

    console.log(`✓  processed=${processed}  failed=${failed}  this_batch=${total}  total_so_far=${totalProcessed}`);

    // Done when the function found no tickers to process
    if (total === 0 || !next_resume_after) {
      console.log(`\n✅ Ingest complete! Processed: ${totalProcessed}, Failed: ${totalFailed}`);
      break;
    }

    resumeAfter = next_resume_after;
    await sleep(PAUSE_MS);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
