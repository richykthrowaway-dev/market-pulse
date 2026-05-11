/**
 * Shape of the pre-built bilateral trade dataset served from
 * /public/bilateral/{version}/{reporterISO2}.json.
 *
 * The dataset is generated annually by scripts/fetch-bilateral.mjs hitting
 * the UN Comtrade preview API, then committed to git so Vercel ships it
 * as a static CDN asset.  This means hover lookups are CDN-fast (~40 ms
 * first time, ~0 ms cached) and survive Comtrade outages at runtime.
 *
 * Versioned URLs (`/bilateral/v2022/...`) are immutable — when a new
 * year ships we publish `v2023/...` and bump the manifest pointer.
 * Browsers and CDN edge caches keep the old version forever, so existing
 * sessions never see a "broken" URL during a refresh.
 */

/** One HS 2-digit chapter row inside a bilateral partner entry. */
export interface BilateralChapter {
  /** HS 2-digit chapter code, zero-padded (`"01"` – `"99"`). */
  code:     string;
  /** Trade value in USD for this chapter in the bilateral relationship. */
  valueUsd: number;
  /** Share of total bilateral trade, 0–1.  Sum of top chapters + Other ≈ 1.0. */
  share:    number;
}

/** Bilateral entry for one (reporter, partner, direction) triple. */
export interface BilateralPartnerEntry {
  /**
   * Data year — may differ per partner because Comtrade publishes annually
   * with a 1–2 year lag and country coverage isn't uniform.  We record
   * the actual year used so the UI can show "as of 2022" honestly.
   */
  year:        number;
  /** Sum of all chapter values for this bilateral pair in USD. */
  totalUsd:    number;
  /** Top HS chapters by value, sorted descending. Capped at 10. */
  topChapters: BilateralChapter[];
}

/** Per-reporter dataset combining both flow directions. */
export interface BilateralReporterData {
  /** Reporter country ISO 3166-1 alpha-2 code. */
  reporter: string;
  /**
   * Map keyed by partner ISO2.  Values present only for partners we
   * successfully fetched (top ~8 per direction).  Missing partner = the
   * frontend falls through to the live `api-wits` bilateral endpoint.
   */
  exports:  Record<string, BilateralPartnerEntry>;
  imports:  Record<string, BilateralPartnerEntry>;
}

/** Top-level manifest at /public/bilateral/manifest.json. */
export interface BilateralManifest {
  /** Dataset version slug, e.g. "v2022".  Used in the URL prefix. */
  version:   string;
  /** Most-recent data year covered by the dataset. */
  year:      number;
  /** ISO timestamp of the ingest run that produced this dataset. */
  generated: string;
  /** ISO2 codes of countries we have static data for. */
  reporters: string[];
}
