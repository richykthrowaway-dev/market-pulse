const https = require('https');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b2t1bWtiZ3Z3c3lmdHd3cHJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NTM2MDAsImV4cCI6MjA4ODMyOTYwMH0.7gg92KfZxouICjHJAwSeImmnqVxQhK7Evt8xit5vMYE';
const body = JSON.stringify({ limit: 10 });

const options = {
  hostname: 'fzokumkbgvwsyftwwprx.supabase.co',
  path: '/functions/v1/ingest-fundamentals-bulk',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
  timeout: 30000,
};

let data = '';
const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response:', data);
    process.exit(0);
  });
});

req.on('timeout', () => { console.log('REQUEST TIMED OUT'); req.destroy(); });
req.on('error', (e) => { console.log('ERROR:', e.message); process.exit(1); });

req.write(body);
req.end();

console.log('Request sent, waiting up to 30s...');
