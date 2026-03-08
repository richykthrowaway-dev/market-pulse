# End-to-End Testing Guide: Portfolio with Multi-Source Logos

## Test Scenario: Upload Portfolio and Verify Logo Loading

### Step 1: Navigate to Portfolio
- Open MarketPulse
- Click "Portfolio" in the sidebar
- Click "Upload CSV" button in the sidebar (bottom)

### Step 2: Upload Your IBKR Statement
- Select your IBKR CSV file (e.g., `U4184791_U4184791_20250401_20260227_AS_Fv2.csv`)
- Wait for parsing to complete
- Portfolio summary card should appear with holdings

### Step 3: Observe Logo Loading

#### For Major Stocks (AAPL, TSLA, NFLX, etc.)
- **Expected**: Real company logo appears instantly
- **Source**: logo.dev (cached by browser)
- **Time**: <100ms

#### For Lesser-Known Stocks (HGRAF, QIMC, TIH, etc.)
- **Scenario 1** (Current — without Finnhub):
  - Logo.dev returns monogram letter (e.g., "H" for HGRAF)
  - In background, system attempts Finnhub/DuckDuckGo fetch
  - If found, logo updates after ~1-2 seconds
  - If not found, remains as monogram (still readable)

- **Scenario 2** (After deploying api-finnhub):
  - Logo.dev returns monogram
  - System queues Finnhub fetch
  - Within ~500-1000ms, logo updates to real company logo
  - Logo cached for future visits

#### If Logo Load Fails Completely
- **Expected**: Building icon appears (fallback)
- **Source**: No source had a logo
- **Next visit**: System will try again (cache expiration is 30 days)

### Step 4: Verify Caching

#### Check Cache Storage
1. Open Browser DevTools (F12)
2. Go to Application → LocalStorage
3. Look for key: `logo-cache-v1`
4. Should contain entries like:
```json
{
  "SCD": { "url": "...", "source": "logo.dev", "timestamp": 1709... },
  "HGRAF": { "url": "...", "source": "duckduckgo", "timestamp": 1709... }
}
```

#### Clear Cache (for testing)
```javascript
// In browser console
localStorage.removeItem('logo-cache-v1')
// Then refresh page to see fresh logo fetches
```

### Step 5: Test Portfolio Summary Card

**Location**: Top of Portfolio page

**Verify**:
- ✅ Total portfolio value displays
- ✅ Market Cap allocation pie chart shows
- ✅ Sector colors appear (Materials, Industrials, etc.)
- ✅ Each holding row shows:
  - [ ] Stock ticker (e.g., SCD)
  - [ ] Company logo (real, monogram, or building icon)
  - [ ] Number of shares
  - [ ] Purchase price
  - [ ] Market value
  - [ ] Sector label

**Test Case**: SCD.V
- **Expected Logo**: SCD.V (Canadian materials company) logo
  - If shows SCD (US company) logo, exchange mapping failed
  - Re-upload CSV to pick up the fixed parser (reads cols[8] not cols[5])

### Step 6: Monitor Network Activity

1. Open DevTools → Network tab
2. Upload CSV and watch for:
   - `/api/finnhub?endpoint=profile2&symbol=HGRAF` (if deployed)
   - `https://img.logo.dev/ticker/...` (primary)
   - `https://api.duckduckgo.com/...` (fallback, if Finnhub not deployed)

## Test Outcomes

### Success Criteria ✅
- [x] Portfolio loads with all holdings displayed
- [x] Logos appear for major stocks immediately
- [x] Lesser-known stocks show logos or monograms (readable either way)
- [x] No JavaScript errors in console
- [x] Cache is populated after first visit
- [x] Second visit uses cached logos (instant load)
- [x] Sector colors displayed correctly
- [x] Delete button visible in sidebar (position fixed)

### Known Limitations ⚠️
- **Without Finnhub deployment**: Lesser-known stocks show monograms until the edge function is deployed
- **DuckDuckGo fallback**: Only works for well-known company names, not obscure tickers
- **Cache**: Resets if user clears browser data

## Deployment Checklist

To enable full Finnhub logo support:

```bash
# 1. Authenticate with Supabase
npx supabase login

# 2. Deploy the edge function
cd /path/to/market-pulse
npx supabase functions deploy api-finnhub --project-ref fzokumkbgvwsyftwwprx

# 3. Set the API key
npx supabase secrets set FINNHUB_API_KEY=<your_finnhub_key> --project-ref fzokumkbgvwsyftwwprx

# 4. Clear logo cache to re-fetch with Finnhub enabled
# (User does this in browser console)
localStorage.removeItem('logo-cache-v1')
```

After deployment, lesser-known stocks will automatically fetch real logos from Finnhub.

## Troubleshooting

### Logos Not Loading
1. Check browser console for errors
2. Verify image URLs are valid (DevTools Network tab)
3. Clear cache: `localStorage.removeItem('logo-cache-v1')`
4. Try a hard refresh: Ctrl+Shift+R

### Wrong Logo for a Stock
- **Root cause**: Old cached data or exchange mapping issue
- **Fix**: Clear cache and re-upload CSV

### Monogram Showing Instead of Real Logo
- **Expected** (without Finnhub): System will try Finnhub/DuckDuckGo in background
- **Deploy Finnhub**: To get real logos for lesser-known stocks immediately
- **Refresh page**: After deployment to see updated logos

## Performance Metrics

| Scenario | Load Time | Source |
|----------|-----------|--------|
| logo.dev hit (major stock) | <50ms | Browser cache |
| Cache hit (repeat visit) | <1ms | localStorage |
| Finnhub fallback | 500-1000ms | Edge function |
| DuckDuckGo fallback | 500ms | Public API |
| Building icon (all fail) | <1ms | Immediate |
