/**
 * Maps ISO2 codes → TradingView screener widget `market` identifiers.
 * Only 11 country markets are confirmed working in the embeddable Screener widget.
 */
export const ISO2_TO_TV_MARKET: Record<string, string> = {
  US: "america",
  CA: "canada",
  DE: "germany",
  IT: "italy",
  PL: "poland",
  TR: "turkey",
  IL: "israel",
  EG: "egypt",
  IN: "india",
  AU: "australia",
  VN: "vietnam",
};

/**
 * Maps ISO2 codes → TradingView Stock Market (hotlists) widget `exchange` identifiers.
 * Used as fallback for countries not supported by the Screener widget.
 *
 * Tested: only exchanges listed here produce country-specific data.
 * UK (LON), Japan (TSE/TYO), Hong Kong (HKEX) all fall back to US — excluded.
 */
export const ISO2_TO_TV_EXCHANGE: Record<string, string> = {
  // Already covered by Screener — listed here so hotlists can also be used
  US: "US",
  DE: "XETR",
  IT: "MIL",
  IN: "BSE",

  // NEW countries only available via hotlists widget
  CN: "SSE",
  KR: "KRX",
  BR: "BMFBOVESPA",
  CH: "SIX",
  FR: "EURONEXT",
  AR: "BCBA",
};

/**
 * Maps ISO2 codes → TradingView Stock Heatmap widget `dataSource` identifiers.
 * Uses index codes (e.g. ASX200, NIFTY50) — NOT "All{Country}" pattern which
 * silently falls back to US data.
 *
 * Verified: each entry shows genuinely different sector structure from SPX500.
 * Invalid values silently render US stocks — only confirmed entries listed.
 */
export const ISO2_TO_TV_HEATMAP: Record<string, string> = {
  US: "SPX500",
  AU: "ASX200",
  IN: "NIFTY50",
  SE: "OMXS30",
  ES: "IBEX35",
  DE: "DAX",
  CA: "TSX",
  BR: "IBOV",
  HK: "HSCEI",
  IL: "TA35",
};
