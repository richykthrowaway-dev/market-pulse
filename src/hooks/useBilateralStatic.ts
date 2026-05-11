import { useQuery } from '@tanstack/react-query';
import type {
  BilateralManifest,
  BilateralReporterData,
  BilateralPartnerEntry,
} from '@/data/bilateralTypes';

/**
 * Static bilateral trade dataset hooks.
 *
 * The build-time ingest script (`scripts/fetch-bilateral.mjs`) writes:
 *   /public/bilateral/manifest.json                — top-level pointer
 *   /public/bilateral/{version}/{ISO2}.json        — per-reporter dataset
 *
 * Vercel serves these as static CDN assets, so first-hover latency is
 * ~40–80 ms from the user's nearest edge POP and ~5 ms for repeat hovers
 * (browser HTTP cache).  We then look up partners synchronously from the
 * in-memory object — no per-partner network call.
 *
 * Refresh strategy: when Comtrade publishes a new year, we re-run the
 * ingest script with a bumped `VERSION` constant, commit the new files,
 * and ship.  Old `/bilateral/{oldVersion}/*.json` URLs continue to work
 * (immutable Cache-Control), so existing sessions never see a broken
 * fetch during a rollout.
 *
 * Hybrid fallback: if a reporter isn't in the manifest (smaller economy
 * not in our top 50) OR a specific partner isn't in the dataset, the
 * `PartnerBreakdown` component falls through to the live `api-wits`
 * bilateral endpoint.  This gives complete coverage without bloating
 * the static dataset.
 */

/**
 * Fetch the top-level manifest once per session.  The manifest tells us
 * (a) which reporters have static data and (b) what version subdirectory
 * to fetch from.  Cached forever because the manifest is immutable per
 * deploy — any change ships in a new deploy that invalidates this query
 * by tab refresh.
 */
export function useBilateralManifest() {
  return useQuery<BilateralManifest | null>({
    queryKey: ['bilateral-manifest'],
    // Manifest version is pinned per deploy — never goes stale mid-session
    staleTime: Infinity,
    gcTime:    Infinity,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      try {
        const res = await fetch('/bilateral/manifest.json', {
          // Use the browser's HTTP cache aggressively — the file rarely
          // changes and Vercel sets short max-age on the manifest only.
          cache: 'default',
        });
        if (!res.ok) return null;
        return (await res.json()) as BilateralManifest;
      } catch {
        return null;
      }
    },
  });
}

/**
 * Fetch the full bilateral dataset for one reporter country.
 *
 * Returns the parsed JSON or `null` when the reporter isn't in the
 * manifest (caller should fall back to the live API).  The query is
 * disabled until both `reporter` and the manifest are available, so
 * passing `null` reporter or having a yet-loading manifest is safe.
 *
 * @param reporter ISO 3166-1 alpha-2 of the country whose partner data
 *                 to fetch.  Pass null to disable.
 */
export function useBilateralStatic(reporter: string | null) {
  const { data: manifest } = useBilateralManifest();

  const version    = manifest?.version ?? null;
  const inManifest = !!reporter && !!manifest?.reporters.includes(reporter);
  const ready      = !!reporter && !!version && inManifest;

  return useQuery<BilateralReporterData | null>({
    // Version is part of the key so a new deploy with an updated version
    // automatically invalidates the cache — no manual purge needed.
    queryKey: ['bilateral-static', version, reporter],
    enabled:  ready,
    // Each version-pinned URL is immutable; cache forever within session.
    staleTime: Infinity,
    gcTime:    Infinity,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!reporter || !version) return null;
      try {
        const res = await fetch(`/bilateral/${version}/${reporter}.json`, {
          cache: 'default',
        });
        if (!res.ok) return null;
        return (await res.json()) as BilateralReporterData;
      } catch {
        return null;
      }
    },
  });
}

/**
 * Synchronous lookup helper — given a loaded reporter dataset, returns
 * the entry for one (partner, direction) pair or null.
 */
export function lookupBilateral(
  data:      BilateralReporterData | null | undefined,
  partner:   string,
  direction: 'exports' | 'imports',
): BilateralPartnerEntry | null {
  if (!data) return null;
  return data[direction]?.[partner] ?? null;
}
