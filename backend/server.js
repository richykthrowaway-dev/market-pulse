/**
 * DefeatBeta Data Backend
 *
 * A lightweight Express server that uses DuckDB to query the
 * defeatbeta/yahoo-finance-data HuggingFace dataset (parquet files)
 * directly over HTTP — no Python required.
 *
 * Capabilities:
 *   /api/profile        — Company profile (sector, industry, employees, etc.)
 *   /api/financials      — Income statements, balance sheets, cash flow
 *   /api/prices          — Historical OHLCV price data
 *   /api/news            — Stock-specific news articles
 *   /api/earnings        — Earnings calendar & dates
 *   /api/dividends       — Dividend history
 *   /api/splits          — Stock split events
 *   /api/officers        — Company executives
 *   /api/shares          — Shares outstanding history
 *   /api/transcripts     — Earnings call transcripts
 *   /api/revenue-breakdown — Revenue by segment/geography
 *   /api/sec-filings     — SEC filing documents
 *   /api/trailing-eps    — Trailing EPS data
 *   /api/treasury-yields — Daily US Treasury yield curve
 *   /api/exchange-rates  — Currency exchange rates
 */

const express = require('express');
const cors = require('cors');
const duckdb = require('duckdb');

const app = express();
app.use(cors());
app.use(express.json());

// DuckDB returns BigInt for large integers — convert to Number in JSON
app.set('json replacer', (_key, value) =>
  typeof value === 'bigint' ? Number(value) : value
);

const PORT = process.env.PORT || 4400;

// ── DuckDB setup ────────────────────────────────────────────────────────────

const db = new duckdb.Database(':memory:');
const conn = db.connect();

// Install and load httpfs for remote parquet reading
conn.exec("INSTALL httpfs; LOAD httpfs;", (err) => {
  if (err) console.error('httpfs install error:', err);
  else console.log('[DuckDB] httpfs loaded — remote parquet queries enabled');
});

// Base URL for all parquet files
const HF_BASE = 'https://huggingface.co/datasets/defeatbeta/yahoo-finance-data/resolve/main/data';

// ── Helper: run DuckDB query and return promise ─────────────────────────────

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    conn.all(sql, ...params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', engine: 'DuckDB', dataset: 'defeatbeta/yahoo-finance-data' });
});

// Company profile
app.get('/api/profile', async (req, res) => {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  try {
    const rows = await query(
      `SELECT * FROM '${HF_BASE}/stock_profile.parquet' WHERE symbol = ?`,
      [symbol.toUpperCase()]
    );
    res.json({ data: rows[0] || null, symbol });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Financial statements (income, balance_sheet, cash_flow)
app.get('/api/financials', async (req, res) => {
  const { symbol, type, period } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  try {
    let sql = `SELECT * FROM '${HF_BASE}/stock_statement.parquet' WHERE symbol = ?`;
    const params = [symbol.toUpperCase()];

    if (type) {
      sql += ` AND lower(finance_type) = ?`;
      params.push(type.toLowerCase());
    }
    if (period) {
      sql += ` AND lower(period_type) = ?`;
      params.push(period.toLowerCase());
    }
    sql += ` ORDER BY report_date DESC LIMIT 20`;

    const rows = await query(sql, params);
    res.json({ data: rows, symbol, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Historical prices
app.get('/api/prices', async (req, res) => {
  const { symbol, days } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  const limit = Math.min(parseInt(days) || 365, 3650);
  try {
    const rows = await query(
      `SELECT * FROM '${HF_BASE}/stock_prices.parquet'
       WHERE symbol = ?
       ORDER BY report_date DESC
       LIMIT ?`,
      [symbol.toUpperCase(), limit]
    );
    res.json({ data: rows.reverse(), symbol, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Stock news — uses related_symbols LIKE filter (large parquet, symbol required)
app.get('/api/news', async (req, res) => {
  const { symbol, limit: lim } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  const limit = Math.min(parseInt(lim) || 20, 50);
  try {
    const rows = await query(
      `SELECT uuid, related_symbols, title, publisher, report_date, type, link
       FROM '${HF_BASE}/stock_news.parquet'
       WHERE related_symbols LIKE ?
       ORDER BY report_date DESC
       LIMIT ?`,
      [`%${symbol.toUpperCase()}%`, limit]
    );
    res.json({ data: rows, symbol, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Earnings calendar
app.get('/api/earnings', async (req, res) => {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  try {
    const rows = await query(
      `SELECT * FROM '${HF_BASE}/stock_earning_calendar.parquet'
       WHERE symbol = ?
       ORDER BY report_date DESC
       LIMIT 20`,
      [symbol.toUpperCase()]
    );
    res.json({ data: rows, symbol, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Dividends
app.get('/api/dividends', async (req, res) => {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  try {
    const rows = await query(
      `SELECT * FROM '${HF_BASE}/stock_dividend_events.parquet'
       WHERE symbol = ?
       ORDER BY report_date DESC
       LIMIT 50`,
      [symbol.toUpperCase()]
    );
    res.json({ data: rows, symbol, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Stock splits
app.get('/api/splits', async (req, res) => {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  try {
    const rows = await query(
      `SELECT * FROM '${HF_BASE}/stock_split_events.parquet'
       WHERE symbol = ?
       ORDER BY report_date DESC`,
      [symbol.toUpperCase()]
    );
    res.json({ data: rows, symbol, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Company officers
app.get('/api/officers', async (req, res) => {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  try {
    const rows = await query(
      `SELECT * FROM '${HF_BASE}/stock_officers.parquet' WHERE symbol = ?`,
      [symbol.toUpperCase()]
    );
    res.json({ data: rows, symbol, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Shares outstanding
app.get('/api/shares', async (req, res) => {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  try {
    const rows = await query(
      `SELECT * FROM '${HF_BASE}/stock_shares_outstanding.parquet'
       WHERE symbol = ?
       ORDER BY report_date DESC
       LIMIT 20`,
      [symbol.toUpperCase()]
    );
    res.json({ data: rows, symbol, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Earnings call transcripts
app.get('/api/transcripts', async (req, res) => {
  const { symbol, limit: lim } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  const limit = Math.min(parseInt(lim) || 4, 20);
  try {
    const rows = await query(
      `SELECT * FROM '${HF_BASE}/stock_earning_call_transcripts.parquet'
       WHERE symbol = ?
       ORDER BY report_date DESC
       LIMIT ?`,
      [symbol.toUpperCase(), limit]
    );
    res.json({ data: rows, symbol, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Revenue breakdown (by segment, geography, product)
app.get('/api/revenue-breakdown', async (req, res) => {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  try {
    const rows = await query(
      `SELECT * FROM '${HF_BASE}/stock_revenue_breakdown.parquet'
       WHERE symbol = ?
       ORDER BY report_date DESC
       LIMIT 40`,
      [symbol.toUpperCase()]
    );
    res.json({ data: rows, symbol, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SEC filings
app.get('/api/sec-filings', async (req, res) => {
  const { symbol, type } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  try {
    let sql = `SELECT * FROM '${HF_BASE}/stock_sec_filing.parquet' WHERE symbol = ?`;
    const params = [symbol.toUpperCase()];
    if (type) {
      sql += ` AND lower(form_type) = ?`;
      params.push(type.toLowerCase());
    }
    sql += ` ORDER BY filing_date DESC LIMIT 30`;
    const rows = await query(sql, params);
    res.json({ data: rows, symbol, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Trailing EPS
app.get('/api/trailing-eps', async (req, res) => {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  try {
    const rows = await query(
      `SELECT * FROM '${HF_BASE}/stock_tailing_eps.parquet'
       WHERE symbol = ?
       ORDER BY report_date DESC
       LIMIT 20`,
      [symbol.toUpperCase()]
    );
    res.json({ data: rows, symbol, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Treasury yield curve
app.get('/api/treasury-yields', async (req, res) => {
  const { days } = req.query;
  const limit = Math.min(parseInt(days) || 30, 365);
  try {
    const rows = await query(
      `SELECT * FROM '${HF_BASE}/daily_treasury_yield.parquet'
       ORDER BY report_date DESC
       LIMIT ?`,
      [limit]
    );
    res.json({ data: rows.reverse(), count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Exchange rates — data uses symbol like 'EURUSD=X', 'GBPUSD=X'
app.get('/api/exchange-rates', async (req, res) => {
  const { symbol, from, to } = req.query;
  try {
    let sql = `SELECT * FROM '${HF_BASE}/exchange_rate.parquet'`;
    const params = [];
    if (symbol) {
      sql += ` WHERE symbol = ?`;
      params.push(String(symbol).toUpperCase());
    } else if (from && to) {
      // Try both conventions: FROMUSD=X and USDTO=X
      sql += ` WHERE symbol = ? OR symbol = ?`;
      const f = String(from).toUpperCase();
      const t = String(to).toUpperCase();
      params.push(`${f}${t}=X`, `${t}${f}=X`);
    }
    sql += ` ORDER BY report_date DESC LIMIT 30`;
    const rows = await query(sql, params);
    res.json({ data: rows, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Start server ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  DefeatBeta API backend running on http://localhost:${PORT}`);
  console.log(`  Data source: HuggingFace defeatbeta/yahoo-finance-data`);
  console.log(`  Engine: DuckDB with httpfs (remote parquet queries)\n`);
  console.log(`  Endpoints:`);
  console.log(`    GET /api/health`);
  console.log(`    GET /api/profile?symbol=AAPL`);
  console.log(`    GET /api/financials?symbol=AAPL&type=income&period=quarterly`);
  console.log(`    GET /api/prices?symbol=AAPL&days=365`);
  console.log(`    GET /api/news?symbol=AAPL`);
  console.log(`    GET /api/earnings?symbol=AAPL`);
  console.log(`    GET /api/dividends?symbol=AAPL`);
  console.log(`    GET /api/splits?symbol=AAPL`);
  console.log(`    GET /api/officers?symbol=AAPL`);
  console.log(`    GET /api/shares?symbol=AAPL`);
  console.log(`    GET /api/transcripts?symbol=AAPL`);
  console.log(`    GET /api/revenue-breakdown?symbol=AAPL`);
  console.log(`    GET /api/sec-filings?symbol=AAPL&type=10-K`);
  console.log(`    GET /api/trailing-eps?symbol=AAPL`);
  console.log(`    GET /api/treasury-yields?days=30`);
  console.log(`    GET /api/exchange-rates?from=usd&to=eur`);
  console.log('');
});
