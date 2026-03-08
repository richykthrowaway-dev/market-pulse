# Logo Fetching System

## Overview

The logo system uses intelligent fallback to display company logos for stocks, with caching to minimize API calls.

## Fallback Chain

1. **logo.dev** (Primary)
   - Instant, cached by browser
   - Covers ~95% of major stocks
   - Falls back to monogram letters for unknown stocks

2. **Cache** (localStorage)
   - 30-day TTL
   - Instant on repeat visits
   - Stored in `logo-cache-v1`

3. **Finnhub** (Recommended fallback)
   - Comprehensive company data including logos
   - Deployed via: `npx supabase deploy api-finnhub`
   - **Status**: Not yet deployed (requires `npx supabase login`)

4. **DuckDuckGo** (Secondary fallback)
   - Free API
   - Works for some public companies (limited coverage)

5. **Building Icon** (Last resort)
   - Shows when no logo is available from any source

## How It Works

### Initial Load (logo.dev)
```
User views Portfolio
  ↓
LogoImg renders with logo.dev URL
  ↓
Image loads (either real logo or monogram)
  ↓
Hook queues background Finnhub fetch
```

### On Load Error (logo.dev fails)
```
LogoImg onError fires
  ↓
Hook calls getLogoUrl() to fetch from Finnhub/DuckDuckGo
  ↓
Result cached in localStorage
  ↓
Image updated to show fallback logo
```

### On Repeat Visits
```
User views same stock again
  ↓
Cache hit (if within 30 days)
  ↓
Logo URL returned instantly
  ↓
No API call needed
```

## Implementation Details

### Components
- **LogoImg.tsx** — Renders logo with multi-source fallback
- **useLogoWithFallback.ts** — Hook managing load/error handlers and fallback fetching
- **logoService.ts** — Core logic: cache management, API calls, fallback chain

### Caching
- **Key**: `logo-cache-v1` in localStorage
- **Format**: `{ [ticker]: { url, source, timestamp } }`
- **TTL**: 30 days per entry
- **Storage**: ~1-2KB per 100 stocks

## Deployment Requirements

### For Finnhub Fallback (Recommended)
```bash
# 1. Login to Supabase
npx supabase login

# 2. Deploy the api-finnhub edge function
npx supabase functions deploy api-finnhub --project-ref fzokumkbgvwsyftwwprx

# 3. Set the Finnhub API key
npx supabase secrets set FINNHUB_API_KEY=<your_key> --project-ref fzokumkbgvwsyftwwprx
```

Once deployed, the system automatically uses Finnhub for logos without real branding on logo.dev.

## Testing

### Manual Test
1. Navigate to Portfolio page
2. Upload IBKR CSV with holdings
3. Observe logos loading:
   - Major stocks (AAPL, TSLA) — logo.dev instant
   - Lesser-known stocks (HGRAF) — may show monogram initially, then Finnhub logo after ~2s
4. Check browser DevTools > Application > LocalStorage > `logo-cache-v1` to verify caching

### Clear Cache
```javascript
localStorage.removeItem('logo-cache-v1')
```

## Performance Notes

- **logo.dev**: ~50-100ms (cached by browser)
- **Finnhub fallback**: ~500-1000ms (async, won't block render)
- **DuckDuckGo**: ~500ms (as backup for Finnhub)
- **Cache hit**: <1ms

## Future Enhancements

1. Pre-fetch logos for all holdings on portfolio load
2. Sync cache with Supabase DB (persists across devices)
3. Add more fallback sources (Wikipedia, CIK lookup, etc.)
4. Batch Finnhub requests to reduce API calls
