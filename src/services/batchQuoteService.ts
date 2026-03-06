/**
 * Batch Quote Service
 *
 * Collects individual quote requests within a short time window (50ms)
 * and fires them as a single batched API call, distributing results
 * to individual React Query caches.
 *
 * Instead of:  5 stocks × 1 API call each = 5 calls
 * With batch:  1 call with 5 symbols = 1 call
 */

import type { QueryClient } from '@tanstack/react-query';

interface PendingRequest {
  ticker: string;
  exchange: string;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

let pendingRequests: PendingRequest[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let queryClientRef: QueryClient | null = null;

const BATCH_WINDOW_MS = 50;

/**
 * Register the QueryClient so the batch service can populate individual caches.
 */
export function initBatchQuoteService(qc: QueryClient): void {
  queryClientRef = qc;
}

/**
 * Request a quote for a single ticker. The request is batched with other
 * requests within a 50ms window and sent as a single API call.
 */
export function requestQuote(ticker: string, exchange: string): Promise<any> {
  return new Promise((resolve, reject) => {
    pendingRequests.push({ ticker, exchange, resolve, reject });

    if (!flushTimer) {
      flushTimer = setTimeout(flushBatch, BATCH_WINDOW_MS);
    }
  });
}

async function flushBatch(): Promise<void> {
  flushTimer = null;
  const batch = [...pendingRequests];
  pendingRequests = [];

  if (batch.length === 0) return;

  // Deduplicate by ticker+exchange
  const uniqueMap = new Map<string, PendingRequest[]>();
  for (const req of batch) {
    const key = `${req.ticker}:${req.exchange}`;
    if (!uniqueMap.has(key)) uniqueMap.set(key, []);
    uniqueMap.get(key)!.push(req);
  }

  // Build batch request
  const symbols = Array.from(uniqueMap.keys()).map((key) => {
    const [ticker, exchange] = key.split(':');
    return { ticker, exchange };
  });

  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-quote`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ symbols }),
    });

    if (!res.ok) {
      // If batch endpoint doesn't exist, fall back to individual requests
      if (res.status === 404 || res.status === 405) {
        await fallbackIndividual(batch);
        return;
      }
      throw new Error(`Batch quote fetch failed: ${res.status}`);
    }

    const results = await res.json();

    // Distribute results to individual promises and cache
    for (const [key, requests] of uniqueMap.entries()) {
      const [ticker, exchange] = key.split(':');
      const result = Array.isArray(results)
        ? results.find((r: any) => r.ticker === ticker || r.symbol === ticker)
        : results[key] ?? results[ticker];

      if (result) {
        // Populate individual React Query cache entries
        if (queryClientRef) {
          queryClientRef.setQueryData(['quote', ticker, exchange], result);
        }
        requests.forEach((r) => r.resolve(result));
      } else {
        requests.forEach((r) => r.resolve(null));
      }
    }
  } catch (error) {
    // On batch failure, fall back to individual requests
    await fallbackIndividual(batch);
  }
}

/**
 * Fallback: fetch quotes individually if batch endpoint isn't available.
 */
async function fallbackIndividual(batch: PendingRequest[]): Promise<void> {
  const promises = batch.map(async (req) => {
    try {
      const params = new URLSearchParams({
        ticker: req.ticker,
        exchange: req.exchange,
      });
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-quote?${params}`;
      const res = await fetch(url, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      if (!res.ok) throw new Error('Quote fetch failed');
      const data = await res.json();
      req.resolve(data);
    } catch (error) {
      req.reject(error);
    }
  });

  await Promise.allSettled(promises);
}
