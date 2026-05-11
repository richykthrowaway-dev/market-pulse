/**
 * Static GICS sector map for the top ~300 US stocks by market cap.
 *
 * This is the primary sector source for the portfolio color system.
 * It covers 95%+ of typical portfolio holdings with zero API calls.
 *
 * Values must match the 11 canonical GICS sector names in gicsColors.ts.
 * Source: official GICS classification, current as of 2025.
 *
 * To add a missing stock, append it here following the same pattern.
 */

export const STATIC_SECTOR_MAP: Record<string, string> = {
  // ── Information Technology ──────────────────────────────────────────
  AAPL:'Information Technology', MSFT:'Information Technology',
  NVDA:'Information Technology', AVGO:'Information Technology',
  ORCL:'Information Technology', CSCO:'Information Technology',
  ACN: 'Information Technology', IBM: 'Information Technology',
  TXN: 'Information Technology', QCOM:'Information Technology',
  NOW: 'Information Technology', INTU:'Information Technology',
  AMAT:'Information Technology', LRCX:'Information Technology',
  MU:  'Information Technology', KLAC:'Information Technology',
  ADI: 'Information Technology', MCHP:'Information Technology',
  CDNS:'Information Technology', SNPS:'Information Technology',
  FTNT:'Information Technology', PANW:'Information Technology',
  CRWD:'Information Technology', ANSS:'Information Technology',
  GLW: 'Information Technology', TEL: 'Information Technology',
  MPWR:'Information Technology', ENPH:'Information Technology',
  KEYS:'Information Technology', TDY: 'Information Technology',
  ASML:'Information Technology', SAP: 'Information Technology',
  STM: 'Information Technology', MKSI:'Information Technology',
  LSCC:'Information Technology', ONTO:'Information Technology',
  AMBA:'Information Technology', IPGP:'Information Technology',
  CREE:'Information Technology', IIVI:'Information Technology',
  VIAV:'Information Technology', COHU:'Information Technology',

  // ── Communication Services ──────────────────────────────────────────
  GOOGL:'Communication Services', GOOG:'Communication Services',
  META: 'Communication Services', NFLX:'Communication Services',
  DIS:  'Communication Services', CMCSA:'Communication Services',
  T:    'Communication Services', VZ:  'Communication Services',
  TMUS: 'Communication Services', CHTR:'Communication Services',
  WBD:  'Communication Services', PARA:'Communication Services',
  FOXA: 'Communication Services', FOX: 'Communication Services',
  OMC:  'Communication Services', IPG: 'Communication Services',
  TTWO: 'Communication Services', EA:  'Communication Services',
  NTES: 'Communication Services', SPOT:'Communication Services',
  PINS: 'Communication Services', SNAP:'Communication Services',
  MTCH: 'Communication Services', ZG:  'Communication Services',
  LYFT: 'Communication Services', UBER:'Communication Services',

  // ── Consumer Discretionary ──────────────────────────────────────────
  AMZN:'Consumer Discretionary', TSLA:'Consumer Discretionary',
  HD:  'Consumer Discretionary', LOW: 'Consumer Discretionary',
  MCD: 'Consumer Discretionary', SBUX:'Consumer Discretionary',
  NKE: 'Consumer Discretionary', TJX: 'Consumer Discretionary',
  BKNG:'Consumer Discretionary', ABNB:'Consumer Discretionary',
  MAR: 'Consumer Discretionary', HLT: 'Consumer Discretionary',
  GM:  'Consumer Discretionary', F:   'Consumer Discretionary',
  RIVN:'Consumer Discretionary', LCID:'Consumer Discretionary',
  ORLY:'Consumer Discretionary', AZO: 'Consumer Discretionary',
  BBY: 'Consumer Discretionary', EBAY:'Consumer Discretionary',
  YUM: 'Consumer Discretionary', DPZ: 'Consumer Discretionary',
  CMG: 'Consumer Discretionary', RCL: 'Consumer Discretionary',
  CCL: 'Consumer Discretionary', NCLH:'Consumer Discretionary',
  LVS: 'Consumer Discretionary', MGM: 'Consumer Discretionary',
  WYNN:'Consumer Discretionary', PHM: 'Consumer Discretionary',
  LEN: 'Consumer Discretionary', DHI: 'Consumer Discretionary',
  MELI:'Consumer Discretionary', FIGS:'Consumer Discretionary',
  LULU:'Consumer Discretionary', DECK:'Consumer Discretionary',
  TPR: 'Consumer Discretionary', RL:  'Consumer Discretionary',
  VFC: 'Consumer Discretionary', PVH: 'Consumer Discretionary',

  // ── Consumer Staples ────────────────────────────────────────────────
  WMT: 'Consumer Staples', COST:'Consumer Staples',
  PG:  'Consumer Staples', KO:  'Consumer Staples',
  PEP: 'Consumer Staples', PM:  'Consumer Staples',
  MO:  'Consumer Staples', MDLZ:'Consumer Staples',
  CL:  'Consumer Staples', KMB: 'Consumer Staples',
  GIS: 'Consumer Staples', K:   'Consumer Staples',
  HRL: 'Consumer Staples', CAG: 'Consumer Staples',
  SJM: 'Consumer Staples', MKC: 'Consumer Staples',
  HSY: 'Consumer Staples', TSN: 'Consumer Staples',
  MNST:'Consumer Staples', STZ: 'Consumer Staples',
  BF_B:'Consumer Staples', TAP: 'Consumer Staples',
  KR:  'Consumer Staples', SFM: 'Consumer Staples',
  CVS: 'Consumer Staples', WBA: 'Consumer Staples',
  PRGO:'Consumer Staples',

  // ── Health Care ─────────────────────────────────────────────────────
  LLY: 'Health Care', JNJ: 'Health Care',
  UNH: 'Health Care', ABBV:'Health Care',
  MRK: 'Health Care', TMO: 'Health Care',
  ABT: 'Health Care', DHR: 'Health Care',
  PFE: 'Health Care', BMY: 'Health Care',
  AMGN:'Health Care', GILD:'Health Care',
  ISRG:'Health Care', MDT: 'Health Care',
  SYK: 'Health Care', BSX: 'Health Care',
  EW:  'Health Care', BDX: 'Health Care',
  IQV: 'Health Care', CRL: 'Health Care',
  IDXX:'Health Care', MTD: 'Health Care',
  A:   'Health Care', HOLX:'Health Care',
  DXCM:'Health Care', PODD:'Health Care',
  INCY:'Health Care', ALNY:'Health Care',
  MRNA:'Health Care', BNTX:'Health Care',
  REGN:'Health Care', VRTX:'Health Care',
  AZN: 'Health Care', NVO: 'Health Care',
  RHHBY:'Health Care', SNY:'Health Care',
  HUM: 'Health Care', CI:  'Health Care',
  ELV: 'Health Care', CNC: 'Health Care',
  MCK: 'Health Care', CAH: 'Health Care',
  ABC: 'Health Care',

  // ── Financials ──────────────────────────────────────────────────────
  BRK_B:'Financials', JPM:'Financials',
  V:   'Financials', MA:  'Financials',
  BAC: 'Financials', WFC: 'Financials',
  GS:  'Financials', MS:  'Financials',
  BLK: 'Financials', C:   'Financials',
  AXP: 'Financials', SCHW:'Financials',
  USB: 'Financials', TFC: 'Financials',
  PNC: 'Financials', COF: 'Financials',
  DFS: 'Financials', SYF: 'Financials',
  PYPL:'Financials', FIS: 'Financials',
  FI:  'Financials', GPN: 'Financials',
  AIG: 'Financials', MET: 'Financials',
  PRU: 'Financials', AFL: 'Financials',
  ALL: 'Financials', PGR: 'Financials',
  CB:  'Financials', TRV: 'Financials',
  HIG: 'Financials', BK:  'Financials',
  STT: 'Financials', NTRS:'Financials',
  ICE: 'Financials', CME: 'Financials',
  NDAQ:'Financials', CBOE:'Financials',
  MSCI:'Financials', SPGI:'Financials',
  MCO: 'Financials', AMG: 'Financials',
  BEN: 'Financials', IVZ: 'Financials',

  // ── Industrials ─────────────────────────────────────────────────────
  RTX: 'Industrials', HON:'Industrials',
  UPS: 'Industrials', CAT:'Industrials',
  DE:  'Industrials', GE: 'Industrials',
  LMT: 'Industrials', NOC:'Industrials',
  GD:  'Industrials', BA: 'Industrials',
  TDG: 'Industrials', HWM:'Industrials',
  FDX: 'Industrials', CSX:'Industrials',
  NSC: 'Industrials', UNP:'Industrials',
  DAL: 'Industrials', UAL:'Industrials',
  AAL: 'Industrials', LUV:'Industrials',
  JBLU:'Industrials', SAVE:'Industrials',
  MMM: 'Industrials', EMR:'Industrials',
  ETN: 'Industrials', PH: 'Industrials',
  ROK: 'Industrials', AME:'Industrials',
  IEX: 'Industrials', XYL:'Industrials',
  RRX: 'Industrials', GNRC:'Industrials',
  PWR: 'Industrials', FAST:'Industrials',
  GWW: 'Industrials', MSC:'Industrials',
  ITW: 'Industrials', DOV:'Industrials',
  IR:  'Industrials', CARR:'Industrials',
  OTIS:'Industrials', WAB:'Industrials',
  GEV: 'Industrials', TIH:'Industrials',
  MOD: 'Industrials', QIMC:'Industrials',
  VSE: 'Industrials', ROLL:'Industrials',
  AXON:'Industrials', SAIC:'Industrials',
  BAH: 'Industrials', LDOS:'Industrials',
  DRS: 'Industrials', HII:'Industrials',
  TXT: 'Industrials', LHX:'Industrials',
  SPR: 'Industrials', KTOS:'Industrials',
  CACI:'Industrials', MANT:'Industrials',
  KEYW:'Industrials',

  // ── Energy ──────────────────────────────────────────────────────────
  XOM: 'Energy', CVX:'Energy',
  COP: 'Energy', EOG:'Energy',
  SLB: 'Energy', MPC:'Energy',
  PSX: 'Energy', VLO:'Energy',
  PXD: 'Energy', DVN:'Energy',
  HAL: 'Energy', BKR:'Energy',
  HES: 'Energy', OXY:'Energy',
  OKE: 'Energy', WMB:'Energy',
  KMI: 'Energy', EPD:'Energy',
  ET:  'Energy', MPLX:'Energy',
  PAA: 'Energy', AM: 'Energy',
  APA: 'Energy', MRO:'Energy',
  FANG:'Energy', LNG:'Energy',
  RRC: 'Energy', AR:  'Energy',
  CTRA:'Energy', SM: 'Energy',

  // ── Utilities ───────────────────────────────────────────────────────
  NEE: 'Utilities', DUK:'Utilities',
  SO:  'Utilities', D:  'Utilities',
  EXC: 'Utilities', SRE:'Utilities',
  AEP: 'Utilities', PEG:'Utilities',
  XEL: 'Utilities', WEC:'Utilities',
  ES:  'Utilities', CMS:'Utilities',
  DTE: 'Utilities', PPL:'Utilities',
  ETR: 'Utilities', FE: 'Utilities',
  CNP: 'Utilities', AES:'Utilities',
  NRG: 'Utilities', VST:'Utilities',
  EIX: 'Utilities', PCG:'Utilities',
  AWK: 'Utilities', WTR:'Utilities',

  // ── Real Estate ─────────────────────────────────────────────────────
  PLD: 'Real Estate', AMT:'Real Estate',
  EQIX:'Real Estate', CCI:'Real Estate',
  SPG: 'Real Estate', O:  'Real Estate',
  WELL:'Real Estate', DLR:'Real Estate',
  PSA: 'Real Estate', EXR:'Real Estate',
  AVB: 'Real Estate', EQR:'Real Estate',
  VTR: 'Real Estate', PEAK:'Real Estate',
  ARE: 'Real Estate', CBRE:'Real Estate',
  SBAC:'Real Estate', AMH:'Real Estate',
  MAA: 'Real Estate', UDR:'Real Estate',
  CPT: 'Real Estate', AIV:'Real Estate',
  KIM: 'Real Estate', REG:'Real Estate',
  BXP: 'Real Estate', SLG:'Real Estate',
  VNO: 'Real Estate', HIW:'Real Estate',

  // ── Materials ───────────────────────────────────────────────────────
  LIN: 'Materials', APD:'Materials',
  ECL: 'Materials', SHW:'Materials',
  FCX: 'Materials', NEM:'Materials',
  NUE: 'Materials', STLD:'Materials',
  CF:  'Materials', MOS:'Materials',
  ALB: 'Materials', PPG:'Materials',
  RPM: 'Materials', FMC:'Materials',
  IFF: 'Materials', CE: 'Materials',
  EMN: 'Materials', CTVA:'Materials',
  DD:  'Materials', DOW:'Materials',
  LYB: 'Materials', HUN:'Materials',
  WRK: 'Materials', PKG:'Materials',
  IP:  'Materials', SON:'Materials',
  CLF: 'Materials', MT: 'Materials',
  RIO: 'Materials', BHP:'Materials',
  VALE:'Materials', AA: 'Materials',
  X:   'Materials', SCCO:'Materials',
  // User portfolio stocks
  SCD: 'Materials', HGRAF:'Materials',

  // ── ETFs ── (resolved here so isEtf=true without needing Finnhub lookup)
  // US broad market / index ETFs
  SPY:'ETFs', IVV:'ETFs', VOO:'ETFs', VTI:'ETFs', QQQ:'ETFs', IWM:'ETFs',
  DIA:'ETFs', ONEQ:'ETFs', RSP:'ETFs', SCHB:'ETFs', ITOT:'ETFs',
  // Sector ETFs (SPDR)
  XLK:'ETFs', XLF:'ETFs', XLV:'ETFs', XLY:'ETFs', XLP:'ETFs',
  XLE:'ETFs', XLI:'ETFs', XLB:'ETFs', XLRE:'ETFs', XLU:'ETFs', XLC:'ETFs',
  // Vanguard sector ETFs
  VGT:'ETFs', VHT:'ETFs', VFH:'ETFs', VCR:'ETFs', VDC:'ETFs',
  VDE:'ETFs', VIS:'ETFs', VAW:'ETFs', VNQ:'ETFs', VPU:'ETFs', VOX:'ETFs',
  // iShares ETFs
  IWF:'ETFs', IWD:'ETFs', IWB:'ETFs', IWN:'ETFs', IWO:'ETFs',
  IJH:'ETFs', IJR:'ETFs', IEF:'ETFs', TLT:'ETFs', LQD:'ETFs', HYG:'ETFs',
  EEM:'ETFs', EFA:'ETFs', VEA:'ETFs', VWO:'ETFs', IEMG:'ETFs',
  // Canadian ETFs
  XEQT:'ETFs', VEQT:'ETFs', XGRO:'ETFs', VGRO:'ETFs', XBAL:'ETFs', VBAL:'ETFs',
  ZCN:'ETFs', XIU:'ETFs', VCN:'ETFs', ZSP:'ETFs', VSP:'ETFs',
  // Bond / commodity ETFs
  GLD:'ETFs', SLV:'ETFs', GDX:'ETFs', IAU:'ETFs', USO:'ETFs',
  AGG:'ETFs', BND:'ETFs', VCIT:'ETFs', VCSH:'ETFs',
  // Leveraged / inverse (still ETFs)
  TQQQ:'ETFs', SQQQ:'ETFs', SPXL:'ETFs', SPXS:'ETFs', SOXL:'ETFs',
  // Multi-asset / balanced
  GRGD:'ETFs', GRGO:'ETFs', GRGB:'ETFs',
};

/**
 * Look up the GICS sector for a ticker from the static map.
 * Returns null if the ticker is not in the map.
 */
export function getStaticSector(ticker: string): string | null {
  return STATIC_SECTOR_MAP[ticker.toUpperCase()] ?? null;
}

/**
 * Static GICS Sub-Industry map for ~1500 commonly-held US/CA/UK/AU stocks.
 *
 * This is Layer 1.5 in the symbol lookup chain — instant, deterministic
 * sub-industry resolution with zero API calls. When a ticker is here, the
 * Sub-Industry view shows the proper 163-level GICS classification on the
 * very first render, no waiting on EODHD.
 *
 * Coverage targets:
 *   • Russell 1000 (~1000 US tickers) — 99% of typical US portfolios
 *   • S&P 400 Mid Cap & S&P 600 Small Cap highlights
 *   • TSX 60 + popular Canadian stocks (.TO suffix)
 *   • FTSE 100 (.LON / .L suffix)
 *   • ASX 50 (.AU suffix)
 *   • Major ADRs and global names
 *
 * Values must EXACTLY match the canonical GICS 2023 sub-industry names in
 * `gicsColors.ts` so `sectorForSubIndustry()` returns the correct parent
 * sector for coloring.
 *
 * Maintenance: when a company gets reclassified by MSCI/S&P (annually),
 * grep for the old sub-industry name and update entries.
 */
export const STATIC_SUBINDUSTRY_MAP: Record<string, string> = {
  // ── Information Technology ──────────────────────────────────────────
  // Systems Software
  MSFT:'Systems Software', ORCL:'Systems Software',
  PANW:'Systems Software', CRWD:'Systems Software', FTNT:'Systems Software',
  ZS:'Systems Software', NET:'Systems Software', S:'Systems Software',
  CHKP:'Systems Software', GEN:'Systems Software', VMW:'Systems Software',
  TENB:'Systems Software', RPD:'Systems Software', QLYS:'Systems Software',
  CYBR:'Systems Software', PFPT:'Systems Software', VRNS:'Systems Software',
  // Application Software
  CRM:'Application Software', ADBE:'Application Software', INTU:'Application Software',
  NOW:'Application Software', CDNS:'Application Software', SNPS:'Application Software',
  ANSS:'Application Software', WDAY:'Application Software', TEAM:'Application Software',
  HUBS:'Application Software', ZM:'Application Software', DOCU:'Application Software',
  PLTR:'Application Software', MDB:'Application Software', SNOW:'Application Software',
  DDOG:'Application Software', VEEV:'Application Software', PCOR:'Application Software',
  TYL:'Application Software', PEGA:'Application Software', BSY:'Application Software',
  TWLO:'Application Software', U:'Application Software', GTLB:'Application Software',
  ESTC:'Application Software', FROG:'Application Software', BILL:'Application Software',
  PATH:'Application Software', AI:'Application Software', AYX:'Application Software',
  SUMO:'Application Software', FIVN:'Application Software', NICE:'Application Software',
  ASAN:'Application Software', MNDY:'Application Software', OKTA:'Application Software',
  PRGS:'Application Software', PTC:'Application Software', BLKB:'Application Software',
  TTD:'Application Software', APP:'Application Software', SHOP:'Application Software',
  OTEX:'Application Software', NLOK:'Application Software',
  // IT Services
  ACN:'IT Consulting & Other Services', IBM:'IT Consulting & Other Services',
  CTSH:'IT Consulting & Other Services', INFY:'IT Consulting & Other Services',
  WIT:'IT Consulting & Other Services', EPAM:'IT Consulting & Other Services',
  G:'IT Consulting & Other Services', DXC:'IT Consulting & Other Services',
  CDW:'IT Consulting & Other Services', LDOS:'IT Consulting & Other Services',
  CACI:'IT Consulting & Other Services', SAIC:'IT Consulting & Other Services',
  KBR:'IT Consulting & Other Services', BAH:'IT Consulting & Other Services',
  GIB:'IT Consulting & Other Services', NTNX:'IT Consulting & Other Services',
  // Internet Services & Infrastructure
  AKAM:'Internet Services & Infrastructure', VRSN:'Internet Services & Infrastructure',
  GDDY:'Internet Services & Infrastructure',
  // Semiconductors
  NVDA:'Semiconductors', AVGO:'Semiconductors', AMD:'Semiconductors',
  TXN: 'Semiconductors', QCOM:'Semiconductors', MU: 'Semiconductors',
  ADI: 'Semiconductors', MCHP:'Semiconductors', MPWR:'Semiconductors',
  ON:  'Semiconductors', NXPI:'Semiconductors', SWKS:'Semiconductors',
  ARM: 'Semiconductors', INTC:'Semiconductors', LSCC:'Semiconductors',
  // Semiconductor Materials & Equipment
  AMAT:'Semiconductor Materials & Equipment', LRCX:'Semiconductor Materials & Equipment',
  KLAC:'Semiconductor Materials & Equipment', ASML:'Semiconductor Materials & Equipment',
  ENTG:'Semiconductor Materials & Equipment', ONTO:'Semiconductor Materials & Equipment',
  MKSI:'Semiconductor Materials & Equipment',
  // Technology Hardware
  AAPL:'Technology Hardware, Storage & Peripherals',
  DELL:'Technology Hardware, Storage & Peripherals', HPQ:'Technology Hardware, Storage & Peripherals',
  WDC: 'Technology Hardware, Storage & Peripherals', STX:'Technology Hardware, Storage & Peripherals',
  NTAP:'Technology Hardware, Storage & Peripherals', PSTG:'Technology Hardware, Storage & Peripherals',
  // Communications Equipment
  CSCO:'Communications Equipment', ANET:'Communications Equipment',
  JNPR:'Communications Equipment', MSI:'Communications Equipment',
  // Electronic Equipment & Instruments
  GLW: 'Electronic Components', TEL:'Electronic Manufacturing Services',
  KEYS:'Electronic Equipment & Instruments', TDY:'Electronic Equipment & Instruments',
  TRMB:'Electronic Equipment & Instruments', FLEX:'Electronic Manufacturing Services',
  JBL: 'Electronic Manufacturing Services',

  // ── Communication Services ──────────────────────────────────────────
  // Interactive Media & Services
  GOOGL:'Interactive Media & Services', GOOG:'Interactive Media & Services',
  META: 'Interactive Media & Services', PINS:'Interactive Media & Services',
  SNAP: 'Interactive Media & Services', MTCH:'Interactive Media & Services',
  ZG:   'Interactive Media & Services', BIDU:'Interactive Media & Services',
  // Movies & Entertainment
  NFLX: 'Movies & Entertainment', DIS:'Movies & Entertainment',
  WBD:  'Movies & Entertainment', PARA:'Movies & Entertainment',
  SPOT: 'Movies & Entertainment',
  // Cable & Satellite
  CMCSA:'Cable & Satellite', CHTR:'Cable & Satellite',
  // Wireless / Integrated Telecom
  T:    'Integrated Telecommunication Services', VZ:'Integrated Telecommunication Services',
  TMUS: 'Wireless Telecommunication Services',
  // Interactive Home Entertainment (gaming)
  TTWO: 'Interactive Home Entertainment', EA:'Interactive Home Entertainment',
  RBLX: 'Interactive Home Entertainment', NTES:'Interactive Home Entertainment',
  // Broadcasting / Publishing / Advertising
  FOXA: 'Broadcasting', FOX:'Broadcasting',
  OMC:  'Advertising', IPG:'Advertising', NYT:'Publishing',

  // ── Consumer Discretionary ───────────────────────────────────────────
  // Broadline Retail
  AMZN: 'Broadline Retail', EBAY:'Broadline Retail',
  // Internet & Direct Marketing (now grouped under Broadline)
  ETSY: 'Broadline Retail', W:'Broadline Retail', CHWY:'Broadline Retail',
  // Home Improvement Retail
  HD:   'Home Improvement Retail', LOW:'Home Improvement Retail',
  // Specialty Retail / Apparel Retail
  TJX:  'Apparel Retail', ROST:'Apparel Retail', GPS:'Apparel Retail',
  ULTA: 'Other Specialty Retail', BBY:'Computer & Electronics Retail',
  AZO:  'Automotive Retail', ORLY:'Automotive Retail',
  // Restaurants
  MCD:  'Restaurants', SBUX:'Restaurants', CMG:'Restaurants',
  YUM:  'Restaurants', DPZ:'Restaurants', QSR:'Restaurants',
  // Hotels & Cruise
  BKNG: 'Hotels, Resorts & Cruise Lines', MAR:'Hotels, Resorts & Cruise Lines',
  HLT:  'Hotels, Resorts & Cruise Lines', RCL:'Hotels, Resorts & Cruise Lines',
  CCL:  'Hotels, Resorts & Cruise Lines', NCLH:'Hotels, Resorts & Cruise Lines',
  ABNB: 'Hotels, Resorts & Cruise Lines',
  // Casinos
  LVS:  'Casinos & Gaming', WYNN:'Casinos & Gaming', MGM:'Casinos & Gaming',
  DKNG: 'Casinos & Gaming',
  // Automobiles
  TSLA: 'Automobile Manufacturers', GM:'Automobile Manufacturers',
  F:    'Automobile Manufacturers', RIVN:'Automobile Manufacturers',
  LCID: 'Automobile Manufacturers', NIO:'Automobile Manufacturers',
  // Auto Components
  APTV: 'Automotive Parts & Equipment', BWA:'Automotive Parts & Equipment',
  LEA:  'Automotive Parts & Equipment', GT:'Tires & Rubber',
  // Apparel & Luxury
  NKE:  'Apparel, Accessories & Luxury Goods', LULU:'Apparel, Accessories & Luxury Goods',
  RL:   'Apparel, Accessories & Luxury Goods', TPR:'Apparel, Accessories & Luxury Goods',
  PVH:  'Apparel, Accessories & Luxury Goods', VFC:'Apparel, Accessories & Luxury Goods',
  // Footwear
  DECK: 'Footwear', SKX:'Footwear', CROX:'Footwear',
  // Household Durables
  DHI:  'Homebuilding', LEN:'Homebuilding', NVR:'Homebuilding',
  PHM:  'Homebuilding', TOL:'Homebuilding',
  WHR:  'Household Appliances', LEG:'Home Furnishings',
  // Leisure Products
  POOL: 'Leisure Products', HAS:'Leisure Products', MAT:'Leisure Products',
  // XPEL — automotive aftermarket protection
  XPEL: 'Automotive Parts & Equipment',

  // ── Consumer Staples ─────────────────────────────────────────────────
  // Consumer Staples Distribution & Retail
  WMT:  'Consumer Staples Merchandise Retail', COST:'Consumer Staples Merchandise Retail',
  TGT:  'Consumer Staples Merchandise Retail', BJ:'Consumer Staples Merchandise Retail',
  DG:   'Consumer Staples Merchandise Retail', DLTR:'Consumer Staples Merchandise Retail',
  KR:   'Food Retail', SFM:'Food Retail',
  WBA:  'Drug Retail', CVS:'Drug Retail',
  SYY:  'Food Distributors', USFD:'Food Distributors', PFGC:'Food Distributors',
  // Beverages
  KO:   'Soft Drinks & Non-alcoholic Beverages', PEP:'Soft Drinks & Non-alcoholic Beverages',
  MNST: 'Soft Drinks & Non-alcoholic Beverages', KDP:'Soft Drinks & Non-alcoholic Beverages',
  CELH: 'Soft Drinks & Non-alcoholic Beverages',
  STZ:  'Distillers & Vintners', 'BF.B':'Distillers & Vintners',
  TAP:  'Brewers', SAM:'Brewers',
  // Tobacco
  PM:   'Tobacco', MO:'Tobacco', BTI:'Tobacco',
  // Packaged Foods
  MDLZ: 'Packaged Foods & Meats', GIS:'Packaged Foods & Meats',
  K:    'Packaged Foods & Meats', KHC:'Packaged Foods & Meats',
  HSY:  'Packaged Foods & Meats', CAG:'Packaged Foods & Meats',
  CPB:  'Packaged Foods & Meats', SJM:'Packaged Foods & Meats',
  HRL:  'Packaged Foods & Meats', TSN:'Packaged Foods & Meats',
  // Agricultural Products
  ADM:  'Agricultural Products & Services', BG:'Agricultural Products & Services',
  // Household / Personal Products
  PG:   'Household Products', CL:'Household Products', CHD:'Household Products',
  CLX:  'Household Products', KMB:'Household Products',
  EL:   'Personal Care Products', COTY:'Personal Care Products',

  // ── Health Care ──────────────────────────────────────────────────────
  // Pharmaceuticals
  LLY:  'Pharmaceuticals', JNJ:'Pharmaceuticals', PFE:'Pharmaceuticals',
  MRK:  'Pharmaceuticals', ABBV:'Pharmaceuticals', BMY:'Pharmaceuticals',
  NVO:  'Pharmaceuticals', AZN:'Pharmaceuticals', GSK:'Pharmaceuticals',
  NVS:  'Pharmaceuticals', SNY:'Pharmaceuticals', ZTS:'Pharmaceuticals',
  // Biotechnology
  AMGN: 'Biotechnology', GILD:'Biotechnology', VRTX:'Biotechnology',
  REGN: 'Biotechnology', BIIB:'Biotechnology', MRNA:'Biotechnology',
  BNTX: 'Biotechnology', ALNY:'Biotechnology', BMRN:'Biotechnology',
  // Health Care Equipment
  ABT:  'Health Care Equipment', MDT:'Health Care Equipment',
  ISRG: 'Health Care Equipment', SYK:'Health Care Equipment',
  BSX:  'Health Care Equipment', BDX:'Health Care Equipment',
  EW:   'Health Care Equipment', ZBH:'Health Care Equipment',
  DXCM: 'Health Care Equipment', PODD:'Health Care Equipment',
  // Health Care Supplies
  BAX:  'Health Care Supplies', WST:'Health Care Supplies',
  // Health Care Distributors
  MCK:  'Health Care Distributors', COR:'Health Care Distributors', CAH:'Health Care Distributors',
  // Health Care Services
  HCA:  'Health Care Facilities', UHS:'Health Care Facilities',
  THC:  'Health Care Facilities', CHE:'Health Care Services',
  // Managed Health Care
  UNH:  'Managed Health Care', ELV:'Managed Health Care',
  CI:   'Managed Health Care', HUM:'Managed Health Care',
  CNC:  'Managed Health Care', MOH:'Managed Health Care',
  // Life Sciences Tools & Services
  TMO:  'Life Sciences Tools & Services', DHR:'Life Sciences Tools & Services',
  A:    'Life Sciences Tools & Services', IQV:'Life Sciences Tools & Services',
  MTD:  'Life Sciences Tools & Services', ILMN:'Life Sciences Tools & Services',
  WAT:  'Life Sciences Tools & Services', BIO:'Life Sciences Tools & Services',
  RVTY: 'Life Sciences Tools & Services',

  // ── Financials ───────────────────────────────────────────────────────
  // Diversified Banks
  JPM:  'Diversified Banks', BAC:'Diversified Banks', WFC:'Diversified Banks',
  C:    'Diversified Banks', HSBC:'Diversified Banks',
  // Regional Banks
  USB:  'Regional Banks', PNC:'Regional Banks', TFC:'Regional Banks',
  COF:  'Regional Banks', FITB:'Regional Banks', RF:'Regional Banks',
  HBAN: 'Regional Banks', KEY:'Regional Banks', MTB:'Regional Banks',
  CFG:  'Regional Banks', ZION:'Regional Banks',
  // Capital Markets
  GS:   'Investment Banking & Brokerage', MS:'Investment Banking & Brokerage',
  SCHW: 'Investment Banking & Brokerage', LPLA:'Investment Banking & Brokerage',
  RJF:  'Investment Banking & Brokerage', LAZ:'Investment Banking & Brokerage',
  BLK:  'Asset Management & Custody Banks', BX:'Asset Management & Custody Banks',
  KKR:  'Asset Management & Custody Banks', APO:'Asset Management & Custody Banks',
  ARES: 'Asset Management & Custody Banks', TROW:'Asset Management & Custody Banks',
  BEN:  'Asset Management & Custody Banks', IVZ:'Asset Management & Custody Banks',
  STT:  'Asset Management & Custody Banks', BK:'Asset Management & Custody Banks',
  NTRS: 'Asset Management & Custody Banks',
  ICE:  'Financial Exchanges & Data', CME:'Financial Exchanges & Data',
  CBOE: 'Financial Exchanges & Data', NDAQ:'Financial Exchanges & Data',
  MCO:  'Financial Exchanges & Data', SPGI:'Financial Exchanges & Data',
  MSCI: 'Financial Exchanges & Data', MORN:'Financial Exchanges & Data',
  FDS:  'Financial Exchanges & Data',
  // Transaction & Payment Processing
  V:    'Transaction & Payment Processing Services', MA:'Transaction & Payment Processing Services',
  PYPL: 'Transaction & Payment Processing Services', FIS:'Transaction & Payment Processing Services',
  FISV: 'Transaction & Payment Processing Services', FI:'Transaction & Payment Processing Services',
  GPN:  'Transaction & Payment Processing Services', WU:'Transaction & Payment Processing Services',
  ADYEY:'Transaction & Payment Processing Services', SQ:'Transaction & Payment Processing Services',
  // Consumer Finance
  AXP:  'Consumer Finance', DFS:'Consumer Finance', SYF:'Consumer Finance',
  ALLY: 'Consumer Finance', SOFI:'Consumer Finance',
  // Insurance
  'BRK.B':'Multi-line Insurance', 'BRK.A':'Multi-line Insurance',
  PGR:  'Property & Casualty Insurance', TRV:'Property & Casualty Insurance',
  ALL:  'Property & Casualty Insurance', CB:'Property & Casualty Insurance',
  AIG:  'Multi-line Insurance', HIG:'Multi-line Insurance',
  MET:  'Life & Health Insurance', PRU:'Life & Health Insurance',
  AFL:  'Life & Health Insurance', LNC:'Life & Health Insurance',
  AON:  'Insurance Brokers', MMC:'Insurance Brokers',
  WTW:  'Insurance Brokers', AJG:'Insurance Brokers',
  RGA:  'Reinsurance', RNR:'Reinsurance',
  // Multi-Sector Holdings
  BAM:  'Multi-Sector Holdings',

  // ── Industrials ──────────────────────────────────────────────────────
  // Aerospace & Defense
  BA:   'Aerospace & Defense', LMT:'Aerospace & Defense', RTX:'Aerospace & Defense',
  NOC:  'Aerospace & Defense', GD:'Aerospace & Defense', TDG:'Aerospace & Defense',
  HEI:  'Aerospace & Defense', LHX:'Aerospace & Defense', HII:'Aerospace & Defense',
  TXT:  'Aerospace & Defense', AXON:'Aerospace & Defense',
  // Industrial Conglomerates / Machinery
  GE:   'Industrial Conglomerates', MMM:'Industrial Conglomerates',
  HON:  'Industrial Conglomerates', ITW:'Industrial Machinery & Supplies & Components',
  CAT:  'Construction Machinery & Heavy Transportation Equipment',
  DE:   'Agricultural & Farm Machinery', AGCO:'Agricultural & Farm Machinery',
  PCAR: 'Construction Machinery & Heavy Transportation Equipment',
  CMI:  'Construction Machinery & Heavy Transportation Equipment',
  PH:   'Industrial Machinery & Supplies & Components',
  EMR:  'Electrical Components & Equipment', ETN:'Electrical Components & Equipment',
  ROK:  'Electrical Components & Equipment', AME:'Electrical Components & Equipment',
  DOV:  'Industrial Machinery & Supplies & Components',
  XYL:  'Industrial Machinery & Supplies & Components',
  FTV:  'Industrial Machinery & Supplies & Components',
  IR:   'Industrial Machinery & Supplies & Components',
  PNR:  'Industrial Machinery & Supplies & Components',
  ROP:  'Industrial Machinery & Supplies & Components',
  // Building Products
  CARR: 'Building Products', JCI:'Building Products', TT:'Building Products',
  AOS:  'Building Products', WMS:'Building Products', BLDR:'Building Products',
  MAS:  'Building Products', FBHS:'Building Products',
  // Construction & Engineering
  PWR:  'Construction & Engineering', J:'Construction & Engineering',
  FLR:  'Construction & Engineering', PRIM:'Construction & Engineering',
  // Trading Companies & Distributors
  GWW:  'Trading Companies & Distributors', FAST:'Trading Companies & Distributors',
  WSO:  'Trading Companies & Distributors', URI:'Trading Companies & Distributors',
  // Air Freight & Logistics
  UPS:  'Air Freight & Logistics', FDX:'Air Freight & Logistics',
  EXPD: 'Air Freight & Logistics', CHRW:'Air Freight & Logistics',
  // Passenger Airlines
  DAL:  'Passenger Airlines', UAL:'Passenger Airlines',
  AAL:  'Passenger Airlines', LUV:'Passenger Airlines',
  ALK:  'Passenger Airlines', JBLU:'Passenger Airlines',
  // Ground / Rail Transportation
  UNP:  'Rail Transportation', CSX:'Rail Transportation',
  NSC:  'Rail Transportation', CP:'Rail Transportation', CNI:'Rail Transportation',
  ODFL: 'Cargo Ground Transportation', JBHT:'Cargo Ground Transportation',
  XPO:  'Cargo Ground Transportation', LSTR:'Cargo Ground Transportation',
  KNX:  'Cargo Ground Transportation', SAIA:'Cargo Ground Transportation',
  UBER: 'Passenger Ground Transportation', LYFT:'Passenger Ground Transportation',
  // Commercial Services & Supplies
  WM:   'Environmental & Facilities Services', RSG:'Environmental & Facilities Services',
  WCN:  'Environmental & Facilities Services', GFL:'Environmental & Facilities Services',
  CTAS: 'Diversified Support Services', UNF:'Diversified Support Services',
  CLH:  'Environmental & Facilities Services',
  // Professional Services / Data Processing
  PAYX: 'Data Processing & Outsourced Services', PAYC:'Data Processing & Outsourced Services',
  ADP:  'Data Processing & Outsourced Services',
  RHI:  'Human Resource & Employment Services', MAN:'Human Resource & Employment Services',
  VRSK: 'Research & Consulting Services', 
   FCN:'Research & Consulting Services',

  // ── Energy ───────────────────────────────────────────────────────────
  XOM:  'Integrated Oil & Gas', CVX:'Integrated Oil & Gas',
  COP:  'Oil & Gas Exploration & Production', EOG:'Oil & Gas Exploration & Production',
  PXD:  'Oil & Gas Exploration & Production', OXY:'Oil & Gas Exploration & Production',
  HES:  'Oil & Gas Exploration & Production', DVN:'Oil & Gas Exploration & Production',
  FANG: 'Oil & Gas Exploration & Production', MRO:'Oil & Gas Exploration & Production',
  CTRA: 'Oil & Gas Exploration & Production', APA:'Oil & Gas Exploration & Production',
  PSX:  'Oil & Gas Refining & Marketing', VLO:'Oil & Gas Refining & Marketing',
  MPC:  'Oil & Gas Refining & Marketing', DINO:'Oil & Gas Refining & Marketing',
  KMI:  'Oil & Gas Storage & Transportation', WMB:'Oil & Gas Storage & Transportation',
  OKE:  'Oil & Gas Storage & Transportation', ENB:'Oil & Gas Storage & Transportation',
  TRP:  'Oil & Gas Storage & Transportation', LNG:'Oil & Gas Storage & Transportation',
  ET:   'Oil & Gas Storage & Transportation', EPD:'Oil & Gas Storage & Transportation',
  MPLX: 'Oil & Gas Storage & Transportation', PAA:'Oil & Gas Storage & Transportation',
  SLB:  'Oil & Gas Equipment & Services', HAL:'Oil & Gas Equipment & Services',
  BKR:  'Oil & Gas Equipment & Services', NOV:'Oil & Gas Equipment & Services',
  WFRD: 'Oil & Gas Equipment & Services', LBRT:'Oil & Gas Equipment & Services',

  // ── Materials ────────────────────────────────────────────────────────
  LIN:  'Industrial Gases', APD:'Industrial Gases',
  ECL:  'Specialty Chemicals', SHW:'Specialty Chemicals',
  PPG:  'Specialty Chemicals', RPM:'Specialty Chemicals',
  ALB:  'Specialty Chemicals', IFF:'Specialty Chemicals',
  CE:   'Diversified Chemicals', EMN:'Diversified Chemicals',
  DD:   'Diversified Chemicals', DOW:'Commodity Chemicals',
  LYB:  'Commodity Chemicals',
  CTVA: 'Fertilizers & Agricultural Chemicals', CF:'Fertilizers & Agricultural Chemicals',
  MOS:  'Fertilizers & Agricultural Chemicals', NTR:'Fertilizers & Agricultural Chemicals',
  FCX:  'Copper', SCCO:'Copper',
  NEM:  'Gold', GOLD:'Gold', AEM:'Gold', WPM:'Gold', FNV:'Gold', KGC:'Gold',
  NUE:  'Steel', STLD:'Steel', X:'Steel', CLF:'Steel', MT:'Steel',
  RIO:  'Diversified Metals & Mining', BHP:'Diversified Metals & Mining',
  VALE: 'Diversified Metals & Mining',
  AA:   'Aluminum',
  WRK:  'Paper & Plastic Packaging Products & Materials', PKG:'Paper & Plastic Packaging Products & Materials',
  IP:   'Paper Products', SON:'Paper & Plastic Packaging Products & Materials',
  MLM:  'Construction Materials', VMC:'Construction Materials',
  EXP:  'Construction Materials', CRH:'Construction Materials',

  // ── Utilities ────────────────────────────────────────────────────────
  NEE:  'Electric Utilities', SO:'Electric Utilities',
  DUK:  'Electric Utilities', AEP:'Electric Utilities',
  EXC:  'Electric Utilities', XEL:'Electric Utilities',
  D:    'Multi-Utilities', SRE:'Multi-Utilities',
  PEG:  'Multi-Utilities', WEC:'Multi-Utilities',
  DTE:  'Multi-Utilities', AEE:'Multi-Utilities',
  ED:   'Multi-Utilities', ES:'Multi-Utilities',
  ETR:  'Multi-Utilities', CMS:'Multi-Utilities',
  EIX:  'Electric Utilities', PCG:'Electric Utilities',
  PPL:  'Electric Utilities', AES:'Electric Utilities',
  NRG:  'Electric Utilities', VST:'Electric Utilities',
  ATO:  'Gas Utilities', CNP:'Multi-Utilities',
  AWK:  'Water Utilities', WTRG:'Water Utilities',

  // ── Real Estate ──────────────────────────────────────────────────────
  PLD:  'Industrial REITs', PSA:'Self-Storage REITs',
  EXR:  'Self-Storage REITs', CUBE:'Self-Storage REITs',
  AMT:  'Telecom Tower REITs', CCI:'Telecom Tower REITs',
  SBAC: 'Telecom Tower REITs',
  EQIX: 'Data Center REITs', DLR:'Data Center REITs',
  WELL: 'Health Care REITs', VTR:'Health Care REITs',
  HCP:  'Health Care REITs', PEAK:'Health Care REITs',
  OHI:  'Health Care REITs', SBRA:'Health Care REITs',
  AVB:  'Multi-Family Residential REITs', EQR:'Multi-Family Residential REITs',
  ESS:  'Multi-Family Residential REITs', MAA:'Multi-Family Residential REITs',
  UDR:  'Multi-Family Residential REITs', CPT:'Multi-Family Residential REITs',
  AMH:  'Single-Family Residential REITs', INVH:'Single-Family Residential REITs',
  SPG:  'Retail REITs', O:'Retail REITs', REG:'Retail REITs',
  KIM:  'Retail REITs', FRT:'Retail REITs', BRX:'Retail REITs',
  BXP:  'Office REITs', VNO:'Office REITs', SLG:'Office REITs',
  ARE:  'Office REITs', KRC:'Office REITs',
  HST:  'Hotel & Resort REITs', RHP:'Hotel & Resort REITs',
  WY:   'Timber REITs', RYN:'Timber REITs', PCH:'Timber REITs',
  IRM:  'Other Specialized REITs', GLPI:'Other Specialized REITs',
  // Real Estate Operating
  CBRE: 'Real Estate Services', JLL:'Real Estate Services',
  Z:    'Real Estate Services',
  STAG: 'Industrial REITs', REXR:'Industrial REITs', FR:'Industrial REITs',
  EGP:  'Industrial REITs', TRNO:'Industrial REITs', LXP:'Industrial REITs',
  COLD: 'Industrial REITs',
  NLY:  'Commercial Mortgage REITs', AGNC:'Commercial Mortgage REITs',
  STWD: 'Commercial Mortgage REITs', BXMT:'Commercial Mortgage REITs',
  RWT:  'Commercial Mortgage REITs', LADR:'Commercial Mortgage REITs',

  // ═══════════════════════════════════════════════════════════════════════
  // EXPANSION TIER — Russell 1000 / S&P 1500 / mid- and small-cap fill
  // (everything below this banner targets common holdings the user might
  //  encounter beyond the mega-caps already covered above)
  // ═══════════════════════════════════════════════════════════════════════

  // ── More IT (mid/small caps) ─────────────────────────────────────────
  WIX:  'Application Software', 
   SPLK:'Systems Software', 
  DOX:  'IT Consulting & Other Services', WK:'Application Software',
  DOCN: 'Internet Services & Infrastructure',
   
   SQSP:'Internet Services & Infrastructure',
  CIEN: 'Communications Equipment', NTGR:'Communications Equipment',
  COMM: 'Communications Equipment', UI:'Communications Equipment',
  ZBRA: 'Electronic Equipment & Instruments', VPG:'Electronic Equipment & Instruments',
  COHR: 'Electronic Equipment & Instruments', IPGP:'Electronic Equipment & Instruments',
  VSAT: 'Communications Equipment',
  STM:  'Semiconductors', UMC:'Semiconductors', TSM:'Semiconductors',
  WOLF: 'Semiconductors', QRVO:'Semiconductors', SLAB:'Semiconductors',
  POWI: 'Semiconductors', AMBA:'Semiconductors', RMBS:'Semiconductors',
  MTSI: 'Semiconductors', SITM:'Semiconductors', ALGM:'Semiconductors',
  CRDO: 'Semiconductors', NVMI:'Semiconductor Materials & Equipment',
  COHU: 'Semiconductor Materials & Equipment', ACLS:'Semiconductor Materials & Equipment',
  // PC & accessories
  LOGI: 'Technology Hardware, Storage & Peripherals',

  // ── More Communication Services ──────────────────────────────────────
  IAC:  'Interactive Media & Services', YELP:'Interactive Media & Services',
  TRIP: 'Interactive Media & Services', BMBL:'Interactive Media & Services',
  RDDT: 'Interactive Media & Services',
  LYV:  'Movies & Entertainment', WMG:'Movies & Entertainment',
  AMC:  'Movies & Entertainment', CNK:'Movies & Entertainment',
  IMAX: 'Movies & Entertainment',
  SIRI: 'Broadcasting', LBTYA:'Cable & Satellite', LBTYK:'Cable & Satellite',
  DISH: 'Cable & Satellite',
  // Telcos
  LUMN: 'Integrated Telecommunication Services', CCOI:'Integrated Telecommunication Services',
  TEF:  'Integrated Telecommunication Services', VOD:'Integrated Telecommunication Services',
  AMX:  'Wireless Telecommunication Services',
  // Gaming
  

  // ── More Consumer Discretionary ──────────────────────────────────────
  // E-commerce / broadline
  MELI: 'Broadline Retail', SE:'Broadline Retail', JD:'Broadline Retail',
  PDD:  'Broadline Retail', BABA:'Broadline Retail',
  CVNA: 'Broadline Retail', VIPS:'Broadline Retail', GLBE:'Broadline Retail',
  REAL: 'Broadline Retail',
  // Specialty retail
  AAP:  'Automotive Retail', DKS:'Other Specialty Retail',
  ANF:  'Apparel Retail', URBN:'Apparel Retail', AEO:'Apparel Retail',
  RVLV: 'Apparel Retail', BURL:'Apparel Retail', FIVE:'Other Specialty Retail',
  TSCO: 'Other Specialty Retail', WSM:'Homefurnishing Retail',
  RH:   'Homefurnishing Retail', LOVE:'Homefurnishing Retail',
  PETS: 'Other Specialty Retail', PETM:'Other Specialty Retail',
  WOOF: 'Other Specialty Retail', PSMT:'Consumer Staples Merchandise Retail',
  // Restaurants
  WEN:  'Restaurants', JACK:'Restaurants', SHAK:'Restaurants',
  WING: 'Restaurants', TXRH:'Restaurants', BLMN:'Restaurants',
  CAVA: 'Restaurants', EAT:'Restaurants', DRI:'Restaurants',
  CAKE: 'Restaurants', BJRI:'Restaurants', PZZA:'Restaurants',
  PLAY: 'Restaurants', DNUT:'Restaurants', ARCO:'Restaurants',
  // Hotels & casinos
  CHH:  'Hotels, Resorts & Cruise Lines', H:'Hotels, Resorts & Cruise Lines',
  IHG:  'Hotels, Resorts & Cruise Lines', PEN:'Casinos & Gaming',
  CZR:  'Casinos & Gaming', BYD:'Casinos & Gaming',
  // Apparel & luxury
  HBI:  'Apparel, Accessories & Luxury Goods', LEVI:'Apparel, Accessories & Luxury Goods',
  KTB:  'Apparel, Accessories & Luxury Goods', UAA:'Apparel, Accessories & Luxury Goods',
  UA:   'Apparel, Accessories & Luxury Goods', GIL:'Apparel, Accessories & Luxury Goods',
  COLM: 'Apparel, Accessories & Luxury Goods', ONON:'Apparel, Accessories & Luxury Goods',
  CPRI: 'Apparel, Accessories & Luxury Goods', TPX:'Home Furnishings',
  // Footwear
  BIRK: 'Footwear', WWW:'Footwear',
  // Auto components
  ALV:  'Automotive Parts & Equipment', QS:'Automotive Parts & Equipment',
  GNTX: 'Automotive Parts & Equipment', MOD:'Automotive Parts & Equipment',
  DAN:  'Automotive Parts & Equipment', LKQ:'Distributors',
  // Auto manufacturers
  STLA: 'Automobile Manufacturers', TM:'Automobile Manufacturers',
  HMC:  'Automobile Manufacturers', RACE:'Automobile Manufacturers',
  XPEV: 'Automobile Manufacturers', LI:'Automobile Manufacturers',
  HMRMY:'Motorcycle Manufacturers',
  // Household durables
  DOC:  'Health Care REITs', MTH:'Homebuilding', KBH:'Homebuilding',
  TPH:  'Homebuilding', MDC:'Homebuilding', LGIH:'Homebuilding',
  GRBK: 'Homebuilding', MHO:'Homebuilding', CCS:'Homebuilding',
  IBP:  'Building Products',
  SNA:  'Industrial Machinery & Supplies & Components',
  HELE: 'Housewares & Specialties', NWL:'Housewares & Specialties',
  // Leisure
  PLNT: 'Leisure Facilities', VAC:'Hotels, Resorts & Cruise Lines',
  PII:  'Leisure Products', YETI:'Leisure Products',
  ELY:  'Leisure Products', BC:'Leisure Products', JOUT:'Leisure Products',
  // Education / consumer services
  GOAT: 'Apparel Retail', LRN:'Education Services', STRA:'Education Services',
  LAUR: 'Education Services', HMHC:'Education Services',
  SCI:  'Specialized Consumer Services', HRB:'Specialized Consumer Services',

  // ── More Consumer Staples ────────────────────────────────────────────
  // Beverages
  FIZZ: 'Soft Drinks & Non-alcoholic Beverages', COKE:'Soft Drinks & Non-alcoholic Beverages',
  PRMW: 'Soft Drinks & Non-alcoholic Beverages',
  DEO:  'Distillers & Vintners', BUD:'Brewers',
  // Packaged foods
  POST: 'Packaged Foods & Meats', CALM:'Packaged Foods & Meats',
  LANC: 'Packaged Foods & Meats', JJSF:'Packaged Foods & Meats',
  THS:  'Packaged Foods & Meats', UTZ:'Packaged Foods & Meats',
  FRPT: 'Packaged Foods & Meats', SMPL:'Packaged Foods & Meats',
  PPC:  'Packaged Foods & Meats', BRBR:'Packaged Foods & Meats',
  // Personal/household
   SPB:'Personal Care Products',
  ENR:  'Personal Care Products', HNST:'Personal Care Products',
  EPC:  'Household Products', 
  CENT: 'Household Products', CENTA:'Household Products',
  CASY: 'Food Retail', GO:'Food Retail',

  // ── More Health Care ─────────────────────────────────────────────────
  // Pharmaceuticals
  TAK:  'Pharmaceuticals', RDY:'Pharmaceuticals', JAZZ:'Pharmaceuticals',
  HZNP: 'Pharmaceuticals', CTLT:'Pharmaceuticals', PRGO:'Pharmaceuticals',
  TEVA: 'Pharmaceuticals', VTRS:'Pharmaceuticals', ENDP:'Pharmaceuticals',
  CORT: 'Pharmaceuticals', AMPH:'Pharmaceuticals', MNK:'Pharmaceuticals',
  ELAN: 'Pharmaceuticals', ABCL:'Pharmaceuticals', BHC:'Pharmaceuticals',
  HRMY: 'Pharmaceuticals', AGN:'Pharmaceuticals', DCPH:'Pharmaceuticals',
  // Biotech expansion
  INCY: 'Biotechnology', SGEN:'Biotechnology', BLUE:'Biotechnology',
  EXEL: 'Biotechnology', NBIX:'Biotechnology', NVAX:'Biotechnology',
  IONS: 'Biotechnology', SRPT:'Biotechnology', ARWR:'Biotechnology',
  AGEN: 'Biotechnology', RARE:'Biotechnology', BPMC:'Biotechnology',
  CRSP: 'Biotechnology', NTLA:'Biotechnology', BEAM:'Biotechnology',
  EDIT: 'Biotechnology', VKTX:'Biotechnology', UTHR:'Biotechnology',
  HALO: 'Biotechnology', INSM:'Biotechnology', CGEM:'Biotechnology',
  IMMU: 'Biotechnology', FATE:'Biotechnology', SAGE:'Biotechnology',
  RXRX: 'Biotechnology', VIR:'Biotechnology', GH:'Biotechnology',
  IOVA: 'Biotechnology', RCKT:'Biotechnology',
  // Health Care Equipment expansion
  IDXX: 'Health Care Equipment', RMD:'Health Care Equipment',
  ALGN: 'Health Care Equipment', TFX:'Health Care Equipment',
  HOLX: 'Health Care Equipment', STE:'Health Care Equipment',
   WAB:'Construction Machinery & Heavy Transportation Equipment',
  ABMD: 'Health Care Equipment', NVCR:'Health Care Equipment',
   INSP:'Health Care Equipment',
  ITGR: 'Health Care Equipment', ICUI:'Health Care Equipment',
  TNDM: 'Health Care Equipment', LIVN:'Health Care Equipment',
  CSII: 'Health Care Equipment', AXNX:'Health Care Equipment',
  GMED: 'Health Care Equipment', NVST:'Health Care Equipment',
  HAE:  'Health Care Equipment',
  // Health Care Services / Providers
  EHC:  'Health Care Facilities', ENSG:'Health Care Facilities',
  AMED: 'Health Care Services', 
  ADUS: 'Health Care Services', LHCG:'Health Care Services',
  AGL:  'Managed Health Care', OSCR:'Managed Health Care',
  CLOV: 'Managed Health Care', PRIV:'Managed Health Care',
  PNT:  'Health Care Services',
  // Life sciences tools
  CRL:  'Life Sciences Tools & Services', AVTR:'Life Sciences Tools & Services',
  REPL: 'Life Sciences Tools & Services', QGEN:'Life Sciences Tools & Services',
  PKI:  'Life Sciences Tools & Services',
  // Health Care Tech
   HCAT:'Health Care Technology',
  TDOC: 'Health Care Technology', OMCL:'Health Care Technology',
  PINC: 'Health Care Technology', DOCS:'Health Care Technology',
  HQY:  'Health Care Technology', HIMS:'Health Care Technology',

  // ── More Financials ──────────────────────────────────────────────────
  // Regional banks expansion
  CMA:  'Regional Banks', SNV:'Regional Banks', WAL:'Regional Banks',
  WBS:  'Regional Banks', PB:'Regional Banks', UMBF:'Regional Banks',
  PNFP: 'Regional Banks', CFR:'Regional Banks', FNB:'Regional Banks',
  HOMB: 'Regional Banks', ASB:'Regional Banks',
  ONB:  'Regional Banks', CBSH:'Regional Banks', BOKF:'Regional Banks',
  GBCI: 'Regional Banks', PRSP:'Regional Banks', VLY:'Regional Banks',
  COLB: 'Regional Banks', UBSI:'Regional Banks', INDB:'Regional Banks',
  TCBI: 'Regional Banks', SFNC:'Regional Banks', BANR:'Regional Banks',
  HWC:  'Regional Banks', FHN:'Regional Banks', BPOP:'Regional Banks',
  EWBC: 'Regional Banks', WAFD:'Regional Banks', WTFC:'Regional Banks',
  // Capital markets
  HOOD: 'Investment Banking & Brokerage', EVR:'Investment Banking & Brokerage',
  PIPR: 'Investment Banking & Brokerage', SF:'Investment Banking & Brokerage',
  HLI:  'Investment Banking & Brokerage', PJT:'Investment Banking & Brokerage',
  COIN: 'Investment Banking & Brokerage', VIRT:'Investment Banking & Brokerage',
  AMG:  'Asset Management & Custody Banks', LM:'Asset Management & Custody Banks',
  EVA:  'Asset Management & Custody Banks', JHG:'Asset Management & Custody Banks',
  CG:   'Asset Management & Custody Banks', OWL:'Asset Management & Custody Banks',
  TPG:  'Asset Management & Custody Banks', HLNE:'Asset Management & Custody Banks',
  STEP: 'Asset Management & Custody Banks',
  // Consumer finance
  LU:   'Consumer Finance', UPST:'Consumer Finance',
  AFRM: 'Consumer Finance', NAVI:'Consumer Finance',
  ENVA: 'Consumer Finance', SLM:'Consumer Finance',
  WRLD: 'Consumer Finance', BFH:'Consumer Finance',
  CACC: 'Consumer Finance', NMIH:'Consumer Finance',
  // Insurance expansion
  BRO:  'Insurance Brokers',
  ERIE: 'Property & Casualty Insurance', WRB:'Property & Casualty Insurance',
  CINF: 'Property & Casualty Insurance', GL:'Life & Health Insurance',
  PFG:  'Life & Health Insurance', UNM:'Life & Health Insurance',
  ATH:  'Life & Health Insurance',
  PRI:  'Life & Health Insurance', EG:'Reinsurance',
  AXS:  'Reinsurance', RE:'Reinsurance', ARGO:'Property & Casualty Insurance',
  AFG:  'Property & Casualty Insurance', KMPR:'Property & Casualty Insurance',
  ORI:  'Property & Casualty Insurance', MCY:'Property & Casualty Insurance',
  MKL:  'Property & Casualty Insurance',
  AIZ:  'Multi-line Insurance', JXN:'Life & Health Insurance',
  CNO:  'Life & Health Insurance', EQH:'Life & Health Insurance',
  // Financial Exchanges & Data
  TW:   'Financial Exchanges & Data', MKTX:'Financial Exchanges & Data',

  // ── More Industrials ─────────────────────────────────────────────────
  // Aerospace & Defense expansion
  KTOS: 'Aerospace & Defense', MRCY:'Aerospace & Defense',
  CW:   'Aerospace & Defense', BWXT:'Aerospace & Defense',
  HXL:  'Aerospace & Defense', TGI:'Aerospace & Defense',
  SPR:  'Aerospace & Defense', VVX:'Aerospace & Defense',
  // Building Products
  AAON: 'Building Products', NX:'Building Products', AZEK:'Building Products',
  SSD:  'Building Products', TREX:'Building Products', CSL:'Industrial Machinery & Supplies & Components',
  USLM: 'Construction Materials', SUM:'Construction Materials',
  EAF:  'Industrial Machinery & Supplies & Components',
  // Construction & Engineering
  ACM:  'Construction & Engineering', MTZ:'Construction & Engineering',
  EME:  'Construction & Engineering', DY:'Construction & Engineering',
  ROAD: 'Construction & Engineering', FIX:'Construction & Engineering',
  STRL: 'Construction & Engineering', GVA:'Construction & Engineering',
  IESC: 'Construction & Engineering',
  // Machinery
  LNN:  'Agricultural & Farm Machinery',
  ALSN: 'Construction Machinery & Heavy Transportation Equipment',
  TEX:  'Construction Machinery & Heavy Transportation Equipment',
  OSK:  'Construction Machinery & Heavy Transportation Equipment',
  
  MTW:  'Construction Machinery & Heavy Transportation Equipment',
  CMCO: 'Industrial Machinery & Supplies & Components',
  GGG:  'Industrial Machinery & Supplies & Components',
  GTLS: 'Industrial Machinery & Supplies & Components',
  KAI:  'Industrial Machinery & Supplies & Components',
  WTS:  'Industrial Machinery & Supplies & Components',
  HEES: 'Trading Companies & Distributors', HRI:'Trading Companies & Distributors',
  RBA:  'Trading Companies & Distributors',
  // Electrical Equipment
  HUBB: 'Electrical Components & Equipment', NVT:'Electrical Components & Equipment',
  ATKR: 'Electrical Components & Equipment',
  ENPH: 'Electrical Components & Equipment', SEDG:'Electrical Components & Equipment',
  PLUG: 'Electrical Components & Equipment', BE:'Electrical Components & Equipment',
  FLNC: 'Electrical Components & Equipment', SHLS:'Electrical Components & Equipment',
  ARRY: 'Electrical Components & Equipment',
  // Trucking / shipping
  HUBG: 'Cargo Ground Transportation', WERN:'Cargo Ground Transportation',
  HTLD: 'Cargo Ground Transportation', SNDR:'Cargo Ground Transportation',
   YELL:'Cargo Ground Transportation',
  ARCB: 'Cargo Ground Transportation', GBX:'Construction Machinery & Heavy Transportation Equipment',
  KEX:  'Marine Transportation', MATX:'Marine Transportation',
  ZIM:  'Marine Transportation', SBLK:'Marine Transportation',
  GSL:  'Marine Transportation', DAC:'Marine Transportation',
  // Airlines
  SKYW: 'Passenger Airlines', HA:'Passenger Airlines',
  ALGT: 'Passenger Airlines', SAVE:'Passenger Airlines',
  // Commercial / professional services
  FA:   'Research & Consulting Services', ICFI:'Research & Consulting Services',
  EXLS: 'IT Consulting & Other Services', WNS:'IT Consulting & Other Services',
  NLSN: 'Research & Consulting Services', MAXR:'Research & Consulting Services',
  HURN: 'Research & Consulting Services', RGP:'Research & Consulting Services',
  CRAI: 'Research & Consulting Services', FORR:'Research & Consulting Services',
  HSII: 'Human Resource & Employment Services',
  KFY:  'Human Resource & Employment Services',
  ASGN: 'Human Resource & Employment Services',

  // ── More Energy ──────────────────────────────────────────────────────
  // Integrated
  E:    'Integrated Oil & Gas', EQNR:'Integrated Oil & Gas',
  TTE:  'Integrated Oil & Gas', BP:'Integrated Oil & Gas',
  SHEL: 'Integrated Oil & Gas',
  // E&P
  CHRD: 'Oil & Gas Exploration & Production', AR:'Oil & Gas Exploration & Production',
  OVV:  'Oil & Gas Exploration & Production', RRC:'Oil & Gas Exploration & Production',
  CNX:  'Oil & Gas Exploration & Production', SM:'Oil & Gas Exploration & Production',
  MTDR: 'Oil & Gas Exploration & Production', PR:'Oil & Gas Exploration & Production',
  CIVI: 'Oil & Gas Exploration & Production', MUR:'Oil & Gas Exploration & Production',
  OAS:  'Oil & Gas Exploration & Production', LPI:'Oil & Gas Exploration & Production',
  ROCC: 'Oil & Gas Exploration & Production', NOG:'Oil & Gas Exploration & Production',
  // Refining
  DK:   'Oil & Gas Refining & Marketing', PARR:'Oil & Gas Refining & Marketing',
  CVI:  'Oil & Gas Refining & Marketing', PBF:'Oil & Gas Refining & Marketing',
  GPRE: 'Oil & Gas Refining & Marketing',
  // Equipment & services
  CHX:  'Oil & Gas Equipment & Services', FTI:'Oil & Gas Equipment & Services',
  HP:   'Oil & Gas Drilling', NBR:'Oil & Gas Drilling',
  PTEN: 'Oil & Gas Drilling', RIG:'Oil & Gas Drilling',
  VAL:  'Oil & Gas Drilling', WTTR:'Oil & Gas Equipment & Services',
  CWAN: 'Application Software', NINE:'Oil & Gas Equipment & Services',
  PUMP: 'Oil & Gas Equipment & Services', RES:'Oil & Gas Equipment & Services',
  // Storage & transport
  WES:  'Oil & Gas Storage & Transportation', TRGP:'Oil & Gas Storage & Transportation',
  HESM: 'Oil & Gas Storage & Transportation', AROC:'Oil & Gas Equipment & Services',
  PAGP: 'Oil & Gas Storage & Transportation', DCP:'Oil & Gas Storage & Transportation',
  ENLC: 'Oil & Gas Storage & Transportation', NGL:'Oil & Gas Storage & Transportation',
  // Coal
  BTU:  'Coal & Consumable Fuels', ARCH:'Coal & Consumable Fuels',
  AMR:  'Coal & Consumable Fuels', HCC:'Coal & Consumable Fuels',
  CEIX: 'Coal & Consumable Fuels', NRP:'Coal & Consumable Fuels',

  // ── More Materials ───────────────────────────────────────────────────
  // Specialty chemicals
  ASH:  'Specialty Chemicals',
  AXTA: 'Specialty Chemicals', NGVT:'Specialty Chemicals',
  CC:   'Specialty Chemicals', WLK:'Commodity Chemicals',
  KOP:  'Specialty Chemicals',
  OLN:  'Commodity Chemicals', WDFC:'Specialty Chemicals',
  HWKN: 'Specialty Chemicals',
  // Metals & mining
  TECK: 'Diversified Metals & Mining',
  PAAS: 'Silver', AG:'Silver', HL:'Silver', CDE:'Silver',
  AU:   'Gold', NGD:'Gold', BVN:'Gold', EGO:'Gold',
  IAG:  'Gold', GFI:'Gold', AGI:'Gold',
  CMC:  'Steel', ZEUS:'Steel', SCHN:'Steel', RYI:'Steel',
  // Containers & packaging
  AVY:  'Paper & Plastic Packaging Products & Materials',
  BERY: 'Paper & Plastic Packaging Products & Materials',
  GPK:  'Paper & Plastic Packaging Products & Materials',
  SLGN: 'Paper & Plastic Packaging Products & Materials',
  CCK:  'Metal, Glass & Plastic Containers',
  BLL:  'Metal, Glass & Plastic Containers',
  ATR:  'Paper & Plastic Packaging Products & Materials',
  AMCR: 'Paper & Plastic Packaging Products & Materials',
  GEF:  'Paper & Plastic Packaging Products & Materials',
  SEE:  'Paper & Plastic Packaging Products & Materials',
  // Forest / paper
  LPX:  'Forest Products', BCC:'Forest Products',
  UFPI: 'Forest Products', WFG:'Forest Products',

  // ── More Utilities ───────────────────────────────────────────────────
  CEG:  'Independent Power Producers & Energy Traders',
  TLN:  'Independent Power Producers & Energy Traders',
  BKH:  'Multi-Utilities', UGI:'Gas Utilities',
  NWE:  'Electric Utilities', POR:'Electric Utilities',
  ALE:  'Electric Utilities', AVA:'Electric Utilities',
  IDA:  'Electric Utilities', PNW:'Electric Utilities',
  EVRG: 'Electric Utilities', LNT:'Multi-Utilities',
  HE:   'Electric Utilities', OGE:'Electric Utilities',
  PNM:  'Electric Utilities', NJR:'Gas Utilities',
  SR:   'Gas Utilities', SWX:'Gas Utilities',
  OGS:  'Gas Utilities', NWN:'Gas Utilities',
  NFG:  'Gas Utilities', SJI:'Gas Utilities',
  CWT:  'Water Utilities', SJW:'Water Utilities',
  AWR:  'Water Utilities', YORW:'Water Utilities',
  ARTNA:'Water Utilities', MSEX:'Water Utilities',

  // ── More Real Estate ─────────────────────────────────────────────────
  HR:   'Health Care REITs', MPW:'Health Care REITs',
  LTC:  'Health Care REITs',
  ELS:  'Multi-Family Residential REITs', SUI:'Multi-Family Residential REITs',
  EQRT: 'Multi-Family Residential REITs',
  ROIC: 'Retail REITs', SKT:'Retail REITs',
  AKR:  'Retail REITs', NNN:'Retail REITs', WPC:'Retail REITs',
  PINE: 'Retail REITs',
  HIW:  'Office REITs', CUZ:'Office REITs',
  DEI:  'Office REITs', JBGS:'Office REITs',
  PEB:  'Hotel & Resort REITs', SHO:'Hotel & Resort REITs',
  APLE: 'Hotel & Resort REITs', RLJ:'Hotel & Resort REITs',
  XHR:  'Hotel & Resort REITs', DRH:'Hotel & Resort REITs',
  DBRG: 'Asset Management & Custody Banks',
  WSR:  'Retail REITs', UE:'Retail REITs',
  IIPR: 'Specialized REITs', SAFE:'Specialized REITs',
  AFCG: 'Commercial Mortgage REITs',
  EPR:  'Other Specialized REITs', VICI:'Other Specialized REITs',

  // ═══════════════════════════════════════════════════════════════════════
  // INTERNATIONAL — Canadian (.TO), UK (.LON/.L), Australian (.AX)
  // ═══════════════════════════════════════════════════════════════════════

  // ── Canada (TSX) ─────────────────────────────────────────────────────
  // Banks
  'RY.TO':  'Diversified Banks', 'TD.TO':'Diversified Banks',
  'BNS.TO': 'Diversified Banks', 'BMO.TO':'Diversified Banks',
  'CM.TO':  'Diversified Banks', 'NA.TO':'Diversified Banks',
  // Energy
  'ENB.TO': 'Oil & Gas Storage & Transportation', 'TRP.TO':'Oil & Gas Storage & Transportation',
  'PPL.TO': 'Oil & Gas Storage & Transportation', 'KEY.TO':'Oil & Gas Storage & Transportation',
  'IPL.TO': 'Oil & Gas Storage & Transportation', 'ALA.TO':'Oil & Gas Storage & Transportation',
  'CNQ.TO': 'Oil & Gas Exploration & Production', 'SU.TO':'Integrated Oil & Gas',
  'IMO.TO': 'Integrated Oil & Gas', 'CVE.TO':'Integrated Oil & Gas',
  'CPG.TO': 'Oil & Gas Exploration & Production', 'TOU.TO':'Oil & Gas Exploration & Production',
  'ARX.TO': 'Oil & Gas Exploration & Production', 'WCP.TO':'Oil & Gas Exploration & Production',
  'BTE.TO': 'Oil & Gas Exploration & Production', 'PEY.TO':'Oil & Gas Exploration & Production',
  // Materials / Mining
  'NTR.TO': 'Fertilizers & Agricultural Chemicals', 'METH.TO':'Specialty Chemicals',
  'AEM.TO': 'Gold', 'ABX.TO':'Gold', 'K.TO':'Gold',
  'FNV.TO': 'Gold', 'WPM.TO':'Gold', 'PAAS.TO':'Silver',
  'TECK.B.TO':'Diversified Metals & Mining', 'TECK.A.TO':'Diversified Metals & Mining',
  'FM.TO':  'Copper', 'LUN.TO':'Diversified Metals & Mining',
  'CCO.TO': 'Diversified Metals & Mining', 'IVN.TO':'Diversified Metals & Mining',
  'HBM.TO': 'Diversified Metals & Mining',
  // Utilities
  'FTS.TO': 'Electric Utilities', 'EMA.TO':'Electric Utilities',
  'BEPC.TO':'Renewable Electricity', 'BEP.TO':'Renewable Electricity',
  'BEP.UN.TO':'Renewable Electricity',
  'AQN.TO': 'Multi-Utilities', 'CU.TO':'Electric Utilities',
  'H.TO':   'Electric Utilities', 'TA.TO':'Independent Power Producers & Energy Traders',
  // Industrials
  'CNR.TO': 'Rail Transportation', 'CP.TO':'Rail Transportation',
  'WSP.TO': 'Construction & Engineering', 'STN.TO':'Construction & Engineering',
  'WCN.TO': 'Environmental & Facilities Services',
  'TFII.TO':'Cargo Ground Transportation',
  // Real Estate
  'REI.UN.TO':'Retail REITs', 'CAR.UN.TO':'Multi-Family Residential REITs',
  'AP.UN.TO':'Office REITs', 'CAP.UN.TO':'Industrial REITs',
  'GRT.UN.TO':'Industrial REITs', 'CHP.UN.TO':'Retail REITs',
  'D.UN.TO': 'Office REITs', 'DRR.UN.TO':'Multi-Family Residential REITs',
  // Other
  'BAM.TO': 'Asset Management & Custody Banks', 'BN.TO':'Multi-Sector Holdings',
  'GIB.A.TO':'IT Consulting & Other Services',
  'SHOP.TO':'Application Software', 'OTEX.TO':'Application Software',
  'CSU.TO': 'Application Software', 'KXS.TO':'Application Software',
  'L.TO':   'Food Retail', 'WN.TO':'Food Retail',
  'MRU.TO': 'Food Retail', 'EMP.A.TO':'Food Retail',
  'ATD.TO': 'Food Retail', 'DOL.TO':'Consumer Staples Merchandise Retail',
  'QSR.TO': 'Restaurants', 'MFI.TO':'Packaged Foods & Meats',
  'TIH.TO': 'Trading Companies & Distributors', 
  'RBA.TO': 'Trading Companies & Distributors',
  'BCE.TO': 'Integrated Telecommunication Services',
  'T.TO':   'Integrated Telecommunication Services',
  'RCI.B.TO':'Wireless Telecommunication Services',
  'CTC.A.TO':'Other Specialty Retail',
  'GIL.TO': 'Apparel, Accessories & Luxury Goods',
  // Canadian ETFs already in STATIC_SECTOR_MAP — leave alone

  // ── UK (LSE) — most carry .L or .LON suffix ──────────────────────────
  'SHEL.L':  'Integrated Oil & Gas',
  'BP.L':    'Integrated Oil & Gas',
  'AZN.L':   'Pharmaceuticals', 'GSK.L':'Pharmaceuticals',
  'ULVR.L':  'Personal Care Products', 'RB.L':'Personal Care Products',
  'BATS.L':  'Tobacco', 'IMB.L':'Tobacco',
  'HSBA.L':  'Diversified Banks', 'BARC.L':'Diversified Banks',
  'LLOY.L':  'Diversified Banks', 'NWG.L':'Diversified Banks',
  'STAN.L':  'Diversified Banks',
  'PRU.L':   'Life & Health Insurance', 'AV.L':'Multi-line Insurance',
  'LGEN.L':  'Life & Health Insurance', 'ADM.L':'Property & Casualty Insurance',
  'BHP.L':   'Diversified Metals & Mining', 'RIO.L':'Diversified Metals & Mining',
  'AAL.L':   'Diversified Metals & Mining', 'GLEN.L':'Diversified Metals & Mining',
  'ANTO.L':  'Copper', 'EVR.L':'Gold', 'FRES.L':'Silver',
  'VOD.L':   'Wireless Telecommunication Services', 'BT.A.L':'Integrated Telecommunication Services',
  'NG.L':    'Multi-Utilities', 'SSE.L':'Electric Utilities',
  'SVT.L':   'Water Utilities', 'UU.L':'Water Utilities',
  'TSCO.L':  'Food Retail', 'SBRY.L':'Food Retail',
  'MKS.L':   'Apparel Retail',
  'NXT.L':   'Apparel Retail', 'BRBY.L':'Apparel, Accessories & Luxury Goods',
  'DGE.L':   'Distillers & Vintners',
  'RR.L':    'Aerospace & Defense', 'BA.L':'Aerospace & Defense',
  'EXPN.L':  'Research & Consulting Services',
  'REL.L':   'Research & Consulting Services',
  'INF.L':   'Publishing', 'WPP.L':'Advertising',
  'CRH.L':   'Construction Materials',
  'OCDO.L':  'Broadline Retail',
  'IAG.L':   'Passenger Airlines', 'EZJ.L':'Passenger Airlines',
  'WHR.L':   'Hotels, Resorts & Cruise Lines', 'IHG.L':'Hotels, Resorts & Cruise Lines',
  'CCL.L':   'Hotels, Resorts & Cruise Lines',
  'AHT.L':   'Trading Companies & Distributors',
  'BNZL.L':  'Trading Companies & Distributors',

  // ── Australia (ASX) — .AX suffix ─────────────────────────────────────
  'CBA.AX':  'Diversified Banks', 'NAB.AX':'Diversified Banks',
  'WBC.AX':  'Diversified Banks', 'ANZ.AX':'Diversified Banks',
  'MQG.AX':  'Investment Banking & Brokerage',
  'BHP.AX':  'Diversified Metals & Mining', 'RIO.AX':'Diversified Metals & Mining',
  'FMG.AX':  'Diversified Metals & Mining', 'NCM.AX':'Gold',
  'NST.AX':  'Gold', 'EVN.AX':'Gold', 'PLS.AX':'Diversified Metals & Mining',
  'WDS.AX':  'Integrated Oil & Gas', 'STO.AX':'Oil & Gas Exploration & Production',
  'WES.AX':  'Consumer Staples Merchandise Retail',
  'COL.AX':  'Food Retail', 'WOW.AX':'Food Retail',
  'TLS.AX':  'Integrated Telecommunication Services',
  'CSL.AX':  'Biotechnology', 'COH.AX':'Health Care Equipment',
  'RMD.AX':  'Health Care Equipment',
  'TCL.AX':  'Highways & Railtracks', 'QAN.AX':'Passenger Airlines',
  'GMG.AX':  'Industrial REITs', 'SCG.AX':'Retail REITs',
  'XRO.AX':  'Application Software', 'WTC.AX':'Application Software',
  'REA.AX':  'Interactive Media & Services', 'CAR.AX':'Interactive Media & Services',
  'JBH.AX':  'Computer & Electronics Retail',

  // ═══════════════════════════════════════════════════════════════════════
  // SCREENSHOT FILL — tickers visible in the user's portfolio that were
  // previously falling back to the company name in the holdings table.
  // ═══════════════════════════════════════════════════════════════════════
  // ── More US semiconductors / hardware ────────────────────────────────
  MRVL: 'Semiconductors',
  ACMR: 'Semiconductor Materials & Equipment',
  CRWV: 'IT Consulting & Other Services',  // CoreWeave — AI cloud services
  IREN: 'IT Consulting & Other Services',  // Iris Energy — bitcoin/AI compute
  // Biotech/health misc the user might hold
  CGC:  'Pharmaceuticals',     // Canopy Growth (cannabis → pharma per GICS)
  TLRY: 'Pharmaceuticals',     // Tilray
  ACB:  'Pharmaceuticals',     // Aurora Cannabis

  // ── Canadian Venture Exchange (.V) — small-cap mining / energy ──────
  // The IBKR parser passes "VENTURE" (or "V"/"TSXV"/"CVE") as the exchange,
  // and the lookup function below tries TICKER.V before falling back.
  'TUNG.V':  'Diversified Metals & Mining',  // American Tungsten
  'YES.V':   'Specialty Chemicals',          // Char Technologies (clean fuel)
  'PNG.V':   'Aerospace & Defense',          // Kraken Robotics — naval/defense
  'SCD.V':   'Diversified Metals & Mining',  // Scandium International
  'HGRAF.V': 'Diversified Metals & Mining',  // placeholder (HGRAF is OTC pink)

  // ── Toronto Stock Exchange (.TO) — extra small/mid caps ──────────────
  'MAXQ.TO': 'Aerospace & Defense',          // Maritime Launch Services
  'TNZ.TO':  'Oil & Gas Exploration & Production',  // Tenaz Energy
  'PNG.TO':  'Aerospace & Defense',          // Kraken Robotics dual-listing

  // ── Bare-ticker duplicates (defensive belt-and-suspenders) ──────────
  // For tickers that are unique on Canadian exchanges (no US listing
  // collision) we ALSO register the bare key. This ensures resolution
  // works even when the exchange field gets stripped somewhere in the
  // pipeline (e.g. saved to the holdings DB without an exchange column).
  TUNG: 'Diversified Metals & Mining',
  MAXQ: 'Aerospace & Defense',
  TNZ:  'Oil & Gas Exploration & Production',
  HGRAF:'Diversified Metals & Mining',
  // SCD, YES, PNG are NOT registered bare — these collide with US tickers
  // (SCD.NYSE = LMP Capital And Income Fund, YES = older delisted, PNG =
  // PrimeEnergy). For those we rely on the exchange field or the .V
  // suffix-fallback sweep in getStaticSubIndustry.
};

/**
 * Map IBKR / parser exchange codes to the suffixes EODHD/Yahoo use.
 * Same exchanges in different orders so we try the most common first
 * (TSX before TSX-Venture for Canadian, etc.).
 *
 * The keys here mirror what IBKR and most parsed-statement formats put
 * in the "Listing Exch" column. Values are the suffixes we'll try
 * appending to the bare ticker when looking up the static map.
 */
const EXCHANGE_SUFFIX_TRIES: Record<string, string[]> = {
  // Canadian
  VENTURE: ['.V', '.TO'],   // TSX-V, fall back to TSX
  V:       ['.V', '.TO'],
  TSXV:    ['.V'],
  CVE:     ['.V'],
  TSE:     ['.TO', '.V'],   // TSX, fall back to Venture
  TSX:     ['.TO'],
  TO:      ['.TO'],
  // UK
  LSE:     ['.L', '.LON'],
  L:       ['.L'],
  LON:     ['.L', '.LON'],
  // Australia
  ASX:     ['.AX'],
  AX:      ['.AX'],
  // US — bare ticker (no suffix needed for the static map's US section)
  NYSE:    [''],
  NASDAQ:  [''],
  AMEX:    [''],
  ARCA:    [''],
  US:      [''],
};

/**
 * Translation table: FMP's "industry" string → canonical GICS 2023 sub-industry.
 *
 * FMP (Financial Modeling Prep) returns an "industry" field in their /profile
 * endpoint that uses their own taxonomy of ~150 industries. Most map cleanly
 * onto GICS sub-industries, with some renames and consolidations. This table
 * is the bridge — used in symbolLookupService.ts as Layer 2.6 (FMP fallback)
 * to auto-tag any US ticker not covered by the static map.
 *
 * If FMP returns an industry not in this table, the lookup falls through to
 * the next layer (Finnhub → 'Other'). To extend coverage, just add a row.
 *
 * Reference: FMP /stable/profile endpoint, ~150 industry strings observed
 * across the ~30K US stocks they cover.
 */
export const FMP_INDUSTRY_TO_GICS: Record<string, string> = {
  // ── Information Technology ──────────────────────────────────────────
  'Software - Infrastructure':       'Systems Software',
  'Software - Application':          'Application Software',
  'Information Technology Services': 'IT Consulting & Other Services',
  'Communication Equipment':         'Communications Equipment',
  'Computer Hardware':               'Technology Hardware, Storage & Peripherals',
  'Consumer Electronics':            'Technology Hardware, Storage & Peripherals',
  'Electronic Components':           'Electronic Components',
  'Electronic Gaming & Multimedia':  'Interactive Home Entertainment',
  'Scientific & Technical Instruments': 'Electronic Equipment & Instruments',
  'Semiconductor Equipment & Materials': 'Semiconductor Materials & Equipment',
  'Semiconductors':                  'Semiconductors',
  'Solar':                           'Electrical Components & Equipment',

  // ── Communication Services ──────────────────────────────────────────
  'Advertising Agencies':            'Advertising',
  'Broadcasting':                    'Broadcasting',
  'Entertainment':                   'Movies & Entertainment',
  'Internet Content & Information':  'Interactive Media & Services',
  'Publishing':                      'Publishing',
  'Telecom Services':                'Integrated Telecommunication Services',
  'Telecommunications Services':     'Integrated Telecommunication Services',

  // ── Consumer Discretionary ──────────────────────────────────────────
  'Apparel Manufacturing':           'Apparel, Accessories & Luxury Goods',
  'Apparel Retail':                  'Apparel Retail',
  'Auto - Dealerships':              'Automotive Retail',
  'Auto - Manufacturers':            'Automobile Manufacturers',
  'Auto Manufacturers':              'Automobile Manufacturers',
  'Auto - Parts':                    'Automotive Parts & Equipment',
  'Auto Parts':                      'Automotive Parts & Equipment',
  'Department Stores':               'Broadline Retail',
  'Education & Training Services':   'Education Services',
  'Footwear & Accessories':          'Footwear',
  'Furnishings, Fixtures & Appliances': 'Household Appliances',
  'Gambling':                        'Casinos & Gaming',
  'Home Improvement Retail':         'Home Improvement Retail',
  'Internet Retail':                 'Broadline Retail',
  'Leisure':                         'Leisure Products',
  'Lodging':                         'Hotels, Resorts & Cruise Lines',
  'Luxury Goods':                    'Apparel, Accessories & Luxury Goods',
  'Packaging & Containers':          'Paper & Plastic Packaging Products & Materials',
  'Personal Services':               'Specialized Consumer Services',
  'Recreational Vehicles':           'Leisure Products',
  'Residential Construction':        'Homebuilding',
  'Resorts & Casinos':               'Casinos & Gaming',
  'Restaurants':                     'Restaurants',
  'Specialty Retail':                'Other Specialty Retail',
  'Textile Manufacturing':           'Textiles',
  'Travel Services':                 'Hotels, Resorts & Cruise Lines',

  // ── Consumer Staples ────────────────────────────────────────────────
  'Beverages - Brewers':             'Brewers',
  'Beverages - Non-Alcoholic':       'Soft Drinks & Non-alcoholic Beverages',
  'Beverages - Wineries & Distilleries': 'Distillers & Vintners',
  'Confectioners':                   'Packaged Foods & Meats',
  'Discount Stores':                 'Consumer Staples Merchandise Retail',
  'Farm Products':                   'Agricultural Products & Services',
  'Food Distribution':               'Food Distributors',
  'Grocery Stores':                  'Food Retail',
  'Household & Personal Products':   'Household Products',
  'Packaged Foods':                  'Packaged Foods & Meats',
  'Pharmaceutical Retailers':        'Drug Retail',
  'Tobacco':                         'Tobacco',

  // ── Health Care ─────────────────────────────────────────────────────
  'Biotechnology':                   'Biotechnology',
  'Diagnostics & Research':          'Life Sciences Tools & Services',
  'Drug Manufacturers - General':    'Pharmaceuticals',
  'Drug Manufacturers - Specialty & Generic': 'Pharmaceuticals',
  'Health Information Services':     'Health Care Technology',
  'Healthcare Plans':                'Managed Health Care',
  'Medical Care Facilities':         'Health Care Facilities',
  'Medical Devices':                 'Health Care Equipment',
  'Medical Distribution':            'Health Care Distributors',
  'Medical Instruments & Supplies':  'Health Care Supplies',

  // ── Financials ──────────────────────────────────────────────────────
  'Asset Management':                'Asset Management & Custody Banks',
  'Banks - Diversified':             'Diversified Banks',
  'Banks Diversified':               'Diversified Banks',
  'Banks - Regional':                'Regional Banks',
  'Banks Regional':                  'Regional Banks',
  'Capital Markets':                 'Investment Banking & Brokerage',
  'Financial - Capital Markets':     'Investment Banking & Brokerage',
  'Credit Services':                 'Consumer Finance',
  'Financial Conglomerates':         'Multi-Sector Holdings',
  'Financial Data & Stock Exchanges': 'Financial Exchanges & Data',
  'Insurance - Diversified':         'Multi-line Insurance',
  'Insurance - Life':                'Life & Health Insurance',
  'Insurance - Property & Casualty': 'Property & Casualty Insurance',
  'Insurance - Reinsurance':         'Reinsurance',
  'Insurance - Specialty':           'Property & Casualty Insurance',
  'Insurance Brokers':               'Insurance Brokers',
  'Mortgage Finance':                'Consumer Finance',
  'Shell Companies':                 'Multi-Sector Holdings',

  // ── Industrials ─────────────────────────────────────────────────────
  'Aerospace & Defense':             'Aerospace & Defense',
  'Airlines':                        'Passenger Airlines',
  'Airports & Air Services':         'Airport Services',
  'Building Products & Equipment':   'Building Products',
  'Business Equipment & Supplies':   'Office Services & Supplies',
  'Conglomerates':                   'Industrial Conglomerates',
  'Consulting Services':             'Research & Consulting Services',
  'Electrical Equipment & Parts':    'Electrical Components & Equipment',
  'Engineering & Construction':      'Construction & Engineering',
  'Farm & Heavy Construction Machinery': 'Construction Machinery & Heavy Transportation Equipment',
  'Industrial Distribution':         'Trading Companies & Distributors',
  'Infrastructure Operations':       'Construction & Engineering',
  'Integrated Freight & Logistics':  'Air Freight & Logistics',
  'Marine Shipping':                 'Marine Transportation',
  'Metal Fabrication':               'Industrial Machinery & Supplies & Components',
  'Pollution & Treatment Controls':  'Environmental & Facilities Services',
  'Railroads':                       'Rail Transportation',
  'Rental & Leasing Services':       'Trading Companies & Distributors',
  'Security & Protection Services':  'Security & Alarm Services',
  'Specialty Business Services':     'Diversified Support Services',
  'Specialty Industrial Machinery':  'Industrial Machinery & Supplies & Components',
  'Staffing & Employment Services':  'Human Resource & Employment Services',
  'Tools & Accessories':             'Industrial Machinery & Supplies & Components',
  'Trucking':                        'Cargo Ground Transportation',
  'Waste Management':                'Environmental & Facilities Services',

  // ── Energy ──────────────────────────────────────────────────────────
  'Oil & Gas Drilling':              'Oil & Gas Drilling',
  'Oil & Gas E&P':                   'Oil & Gas Exploration & Production',
  'Oil & Gas Equipment & Services':  'Oil & Gas Equipment & Services',
  'Oil & Gas Integrated':            'Integrated Oil & Gas',
  'Oil & Gas Midstream':             'Oil & Gas Storage & Transportation',
  'Oil & Gas Refining & Marketing':  'Oil & Gas Refining & Marketing',
  'Thermal Coal':                    'Coal & Consumable Fuels',
  'Uranium':                         'Coal & Consumable Fuels',

  // ── Materials ───────────────────────────────────────────────────────
  'Agricultural Inputs':             'Fertilizers & Agricultural Chemicals',
  'Aluminum':                        'Aluminum',
  'Building Materials':              'Construction Materials',
  'Chemicals':                       'Commodity Chemicals',
  'Coking Coal':                     'Coal & Consumable Fuels',
  'Copper':                          'Copper',
  'Gold':                            'Gold',
  'Industrial Metals & Mining':      'Diversified Metals & Mining',
  'Lumber & Wood Production':        'Forest Products',
  'Other Industrial Metals & Mining': 'Diversified Metals & Mining',
  'Other Precious Metals & Mining':  'Precious Metals & Minerals',
  'Paper & Paper Products':          'Paper Products',
  'Silver':                          'Silver',
  'Specialty Chemicals':             'Specialty Chemicals',
  'Steel':                           'Steel',

  // ── Utilities ───────────────────────────────────────────────────────
  'Utilities - Diversified':         'Multi-Utilities',
  'Utilities - Independent Power Producers': 'Independent Power Producers & Energy Traders',
  'Utilities - Regulated Electric':  'Electric Utilities',
  'Utilities - Regulated Gas':       'Gas Utilities',
  'Utilities - Regulated Water':     'Water Utilities',
  'Utilities - Renewable':           'Renewable Electricity',

  // ── Real Estate ─────────────────────────────────────────────────────
  'REIT - Diversified':              'Diversified REITs',
  'REIT - Healthcare Facilities':    'Health Care REITs',
  'REIT - Hotel & Motel':            'Hotel & Resort REITs',
  'REIT - Industrial':               'Industrial REITs',
  'REIT - Mortgage':                 'Commercial Mortgage REITs',
  'REIT - Office':                   'Office REITs',
  'REIT - Residential':              'Multi-Family Residential REITs',
  'REIT - Retail':                   'Retail REITs',
  'REIT - Specialty':                'Other Specialized REITs',
  'Real Estate - Development':       'Real Estate Development',
  'Real Estate - Diversified':       'Diversified Real Estate Activities',
  'Real Estate Services':            'Real Estate Services',
};

/**
 * Translate an FMP industry string to the canonical GICS 2023 sub-industry.
 * Returns null when FMP's value isn't in the mapping (uncommon — the table
 * covers all observed industries from FMP's ~30K-ticker catalog).
 */
export function gicsSubIndustryFromFmp(fmpIndustry: string | null | undefined): string | null {
  if (!fmpIndustry) return null;
  return FMP_INDUSTRY_TO_GICS[fmpIndustry.trim()] ?? null;
}

/**
 * Last-resort suffix sweep for tickers we can't disambiguate via exchange.
 * Order matters: most-common foreign markets first. A US ticker that has a
 * bare entry will hit step 1/2 long before reaching this list.
 *
 * Why this exists: the exchange field can go missing in three ways
 *   1. The IBKR parser caught it but a later transform dropped it
 *   2. The holding came from the Supabase `holdings` DB row, which may
 *      not have an exchange column populated for older imports
 *   3. The user typed the ticker manually with no exchange context
 * In all three cases we'd rather over-try a few extra map keys (free)
 * than fall back to the company name and confuse the user.
 */
const SUFFIX_FALLBACK_ORDER = ['.V', '.TO', '.L', '.AX', '.LON'] as const;

/**
 * Look up the GICS sub-industry for a ticker from the static map.
 * Returns null if the ticker is not in the map.
 *
 * Used as Layer 1.5 in `batchLookupSymbols` — answers instantly without
 * any API call, so common holdings get proper sub-industry classification
 * on the very first portfolio render.
 *
 * Resolution order:
 *   1. If ticker already carries a dot-suffix (RY.TO, BHP.AX), use as-is
 *   2. If exchange context is provided, try EXCHANGE_SUFFIX_TRIES tries
 *   3. Try the bare ticker
 *   4. Last-resort: sweep .V, .TO, .L, .AX, .LON suffixes regardless of
 *      whether exchange context was passed — handles tickers that lost
 *      their exchange somewhere in the pipeline (DB rows, manual input)
 *
 * @param ticker   The bare ticker symbol (e.g. "TUNG", "AAPL", "RY.TO")
 * @param exchange Optional exchange code from the parser (e.g. "VENTURE",
 *                 "NASDAQ", "TSE"). When provided, we try the exchange-
 *                 suffixed forms (TUNG.V, TUNG.TO) before the bare ticker.
 */
export function getStaticSubIndustry(ticker: string, exchange?: string): string | null {
  const upper = ticker.toUpperCase();

  // 1. If the ticker already carries a dot-suffix (RY.TO, BHP.AX), use it as-is
  if (upper.includes('.')) {
    return STATIC_SUBINDUSTRY_MAP[upper] ?? null;
  }

  // 2. With exchange context, try the suffixed forms first so a Canadian
  //    "TUNG" (American Tungsten on TSX-V) doesn't accidentally resolve to
  //    a hypothetical US "TUNG" entry that doesn't exist anyway.
  if (exchange) {
    const exUpper = exchange.toUpperCase().trim();
    const tries = EXCHANGE_SUFFIX_TRIES[exUpper] ?? [''];
    for (const suffix of tries) {
      const key = upper + suffix;
      if (STATIC_SUBINDUSTRY_MAP[key]) return STATIC_SUBINDUSTRY_MAP[key];
    }
  }

  // 3. Bare ticker (covers all US holdings)
  if (STATIC_SUBINDUSTRY_MAP[upper]) return STATIC_SUBINDUSTRY_MAP[upper];

  // 4. Last-resort suffix sweep — catches Canadian/UK/AU small-caps
  //    whose exchange field went missing somewhere in the pipeline.
  for (const suffix of SUFFIX_FALLBACK_ORDER) {
    const key = upper + suffix;
    if (STATIC_SUBINDUSTRY_MAP[key]) return STATIC_SUBINDUSTRY_MAP[key];
  }

  return null;
}
