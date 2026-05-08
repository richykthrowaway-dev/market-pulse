// ── Country → Major Stock Indices ─────────────────────────────────────────
// Curated mapping of ISO 3166-1 alpha-2 codes to the major stock indices for
// each country, identified by their Yahoo Finance symbols (e.g. ^GSPC = S&P 500).
//
// Larger markets get 3–4 indices; smaller markets get 1–2.
// All symbols verified against Yahoo Finance — symbols starting with `^` are
// indices, with `.SS`/`.SZ` are mainland China, etc.

export interface CountryIndex {
  /** Yahoo Finance ticker (e.g. "^GSPC", "000001.SS") */
  symbol: string;
  /** Short human-readable name (e.g. "S&P 500") */
  name: string;
  /** Optional category for sectioning if needed */
  category?: "broad" | "tech" | "small-cap" | "mid-cap" | "blue-chip";
}

export const COUNTRY_INDICES: Record<string, CountryIndex[]> = {
  // ── Americas ───────────────────────────────────────────────────────────
  US: [
    { symbol: "^GSPC", name: "S&P 500",        category: "broad" },
    { symbol: "^IXIC", name: "Nasdaq Composite", category: "tech" },
    { symbol: "^DJI",  name: "Dow Jones",      category: "blue-chip" },
    { symbol: "^RUT",  name: "Russell 2000",   category: "small-cap" },
  ],
  CA: [
    { symbol: "^GSPTSE", name: "S&P/TSX Composite", category: "broad" },
  ],
  MX: [
    { symbol: "^MXX",  name: "IPC Mexico",     category: "broad" },
  ],
  BR: [
    { symbol: "^BVSP", name: "Bovespa",        category: "broad" },
  ],
  AR: [
    { symbol: "^MERV", name: "Merval",         category: "broad" },
  ],
  CO: [
    { symbol: "^COLCAP", name: "COLCAP",       category: "broad" },
  ],
  CL: [
    { symbol: "^IPSA", name: "IPSA",           category: "broad" },
  ],
  PE: [
    { symbol: "^SPBLPGPT", name: "S&P/BVL Peru General", category: "broad" },
  ],

  // ── Europe ─────────────────────────────────────────────────────────────
  GB: [
    { symbol: "^FTSE", name: "FTSE 100",       category: "blue-chip" },
    { symbol: "^FTMC", name: "FTSE 250",       category: "mid-cap" },
  ],
  DE: [
    { symbol: "^GDAXI",  name: "DAX",          category: "blue-chip" },
    { symbol: "^MDAXI",  name: "MDAX",         category: "mid-cap" },
    { symbol: "^SDAXI",  name: "SDAX",         category: "small-cap" },
  ],
  FR: [
    { symbol: "^FCHI",  name: "CAC 40",        category: "blue-chip" },
  ],
  IT: [
    { symbol: "FTSEMIB.MI", name: "FTSE MIB",  category: "blue-chip" },
  ],
  ES: [
    { symbol: "^IBEX",  name: "IBEX 35",       category: "blue-chip" },
  ],
  NL: [
    { symbol: "^AEX",   name: "AEX",           category: "blue-chip" },
  ],
  BE: [
    { symbol: "^BFX",   name: "BEL 20",        category: "blue-chip" },
  ],
  PT: [
    { symbol: "^PSI20", name: "PSI 20",        category: "blue-chip" },
  ],
  IE: [
    { symbol: "^ISEQ",  name: "ISEQ Overall",  category: "broad" },
  ],
  CH: [
    { symbol: "^SSMI",  name: "SMI",           category: "blue-chip" },
  ],
  AT: [
    { symbol: "^ATX",   name: "ATX",           category: "broad" },
  ],
  SE: [
    { symbol: "^OMX",   name: "OMX Stockholm 30", category: "blue-chip" },
  ],
  NO: [
    { symbol: "OSEAX.OL", name: "OSEAX",       category: "broad" },
  ],
  DK: [
    { symbol: "^OMXC25", name: "OMX Copenhagen 25", category: "blue-chip" },
  ],
  FI: [
    { symbol: "^OMXH25", name: "OMX Helsinki 25",   category: "blue-chip" },
  ],
  PL: [
    { symbol: "^WIG20", name: "WIG 20",        category: "blue-chip" },
  ],
  GR: [
    { symbol: "GD.AT",  name: "Athens Composite", category: "broad" },
  ],
  CZ: [
    { symbol: "^PX",    name: "PX",            category: "broad" },
  ],
  HU: [
    { symbol: "^BUX",   name: "BUX",           category: "broad" },
  ],
  TR: [
    { symbol: "XU100.IS", name: "BIST 100",    category: "broad" },
  ],

  // ── Asia-Pacific ───────────────────────────────────────────────────────
  JP: [
    { symbol: "^N225",  name: "Nikkei 225",    category: "blue-chip" },
    { symbol: "^TPX",   name: "TOPIX",         category: "broad" },
  ],
  CN: [
    { symbol: "000001.SS", name: "Shanghai Composite", category: "broad" },
    { symbol: "399001.SZ", name: "Shenzhen Component", category: "broad" },
    { symbol: "000300.SS", name: "CSI 300",            category: "blue-chip" },
  ],
  HK: [
    { symbol: "^HSI",   name: "Hang Seng",     category: "blue-chip" },
    { symbol: "^HSCE",  name: "Hang Seng China Enterprises", category: "blue-chip" },
  ],
  KR: [
    { symbol: "^KS11",  name: "KOSPI",         category: "broad" },
    { symbol: "^KQ11",  name: "KOSDAQ",        category: "tech" },
  ],
  TW: [
    { symbol: "^TWII",  name: "TAIEX",         category: "broad" },
  ],
  IN: [
    { symbol: "^NSEI",  name: "NIFTY 50",      category: "blue-chip" },
    { symbol: "^BSESN", name: "SENSEX",        category: "blue-chip" },
  ],
  SG: [
    { symbol: "^STI",   name: "Straits Times", category: "broad" },
  ],
  ID: [
    { symbol: "^JKSE",  name: "Jakarta Composite", category: "broad" },
  ],
  TH: [
    { symbol: "^SET.BK", name: "SET",          category: "broad" },
  ],
  MY: [
    { symbol: "^KLSE",  name: "FTSE Bursa Malaysia KLCI", category: "broad" },
  ],
  PH: [
    { symbol: "PSEI.PS", name: "PSEi Composite", category: "broad" },
  ],
  VN: [
    { symbol: "^VNINDEX", name: "VN-Index",    category: "broad" },
  ],
  AU: [
    { symbol: "^AXJO",  name: "S&P/ASX 200",   category: "blue-chip" },
    { symbol: "^AORD",  name: "All Ordinaries", category: "broad" },
  ],
  NZ: [
    { symbol: "^NZ50",  name: "NZX 50",        category: "broad" },
  ],
  PK: [
    { symbol: "^KSE",   name: "KSE 100",       category: "broad" },
  ],

  // ── Middle East & Africa ───────────────────────────────────────────────
  IL: [
    { symbol: "TA35.TA", name: "TA-35",        category: "blue-chip" },
  ],
  SA: [
    { symbol: "^TASI.SR", name: "Tadawul All Share", category: "broad" },
  ],
  AE: [
    { symbol: "^DFMGI", name: "DFM General",   category: "broad" },
  ],
  QA: [
    { symbol: "^QSI",   name: "QE Index",      category: "broad" },
  ],
  KW: [
    { symbol: "^BKP",   name: "Kuwait Premier", category: "broad" },
  ],
  ZA: [
    { symbol: "^J203.JO", name: "JSE All Share", category: "broad" },
    { symbol: "JTOPI.JO", name: "JSE Top 40",  category: "blue-chip" },
  ],
  EG: [
    { symbol: "^CASE30", name: "EGX 30",       category: "broad" },
  ],
  NG: [
    { symbol: "^NGX",   name: "NGX All-Share", category: "broad" },
  ],
  MA: [
    { symbol: "^MASI",  name: "MASI",          category: "broad" },
  ],
  KE: [
    { symbol: "^NSE20", name: "NSE 20",        category: "broad" },
  ],
};

/** Get indices for a country, returning an empty array if none defined. */
export function getCountryIndices(iso2: string): CountryIndex[] {
  return COUNTRY_INDICES[iso2] ?? [];
}
