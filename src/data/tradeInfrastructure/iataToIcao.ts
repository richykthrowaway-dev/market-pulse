/**
 * IATA → ICAO code mapping for every airport in airports.ts.
 *
 * AirportDB's REST API is keyed by ICAO (4-letter), while our static
 * airport data carries IATA (3-letter) codes that are more familiar in
 * a trade-intelligence context. This map bridges the two.
 *
 * Covering all ~100 airports in the curated list; values sourced from
 * the OurAirports public-domain database (CC0).
 */
export const IATA_TO_ICAO: Record<string, string> = {
  // ── Curated tier ──────────────────────────────────────────────────────
  HKG: 'VHHH',
  MEM: 'KMEM',
  PVG: 'ZSPD',
  ICN: 'RKSI',
  DXB: 'OMDB',
  DOH: 'OTHH',
  FRA: 'EDDF',
  AMS: 'EHAM',
  LHR: 'EGLL',
  CGN: 'EDDK',
  LUX: 'ELLX',
  ANC: 'PANC',
  ORD: 'KORD',
  SDF: 'KSDF',
  LAX: 'KLAX',
  SIN: 'WSSS',

  // ── East Asia ─────────────────────────────────────────────────────────
  NRT: 'RJAA',
  HND: 'RJTT',
  KIX: 'RJBB',
  CTS: 'RJCC',
  FUK: 'RJFF',
  TPE: 'RCTP',
  PEK: 'ZBAA',
  PKX: 'ZBAD',
  CAN: 'ZGGG',
  CTU: 'ZUUU',
  PUS: 'RKPK',
  SHA: 'ZSSS',
  UBN: 'ZMCK',

  // ── Southeast Asia ────────────────────────────────────────────────────
  BKK: 'VTBS',
  CGK: 'WIII',
  KUL: 'WMKK',
  MNL: 'RPLL',
  SGN: 'VVTS',
  HAN: 'VVNB',
  DPS: 'WADD',
  RGN: 'VYYY',
  PNH: 'VDPP',

  // ── South Asia ────────────────────────────────────────────────────────
  DEL: 'VIDP',
  BOM: 'VABB',
  BLR: 'VOBL',
  MAA: 'VOMM',
  CCU: 'VECC',
  HYD: 'VOHS',
  ISB: 'OPIS',
  KHI: 'OPKC',
  KTM: 'VNKT',
  CMB: 'VCBI',
  DAC: 'VGHS',

  // ── Middle East ───────────────────────────────────────────────────────
  AUH: 'OMAA',
  RUH: 'OERK',
  JED: 'OEJN',
  KWI: 'OKBK',
  AMM: 'OJAI',
  BEY: 'OLBA',
  IST: 'LTFM',
  TLV: 'LLBG',
  MCT: 'OOMS',
  BAH: 'OBBI',

  // ── Europe ────────────────────────────────────────────────────────────
  CDG: 'LFPG',
  MAD: 'LEMD',
  MUC: 'EDDM',
  ZRH: 'LSZH',
  VIE: 'LOWW',
  BRU: 'EBBR',
  LIS: 'LPPT',
  OSL: 'ENGM',
  ARN: 'ESSA',
  HEL: 'EFHK',
  DUB: 'EIDW',
  FCO: 'LIRF',
  MXP: 'LIMC',
  ATH: 'LGAV',
  BUD: 'LHBP',
  WAW: 'EPWA',
  PRG: 'LKPR',
  BEG: 'LYBE',
  SVO: 'UUEE',
  LED: 'ULLI',

  // ── Africa ────────────────────────────────────────────────────────────
  JNB: 'FAOR',
  CAI: 'HECA',
  NBO: 'HKJK',
  ADD: 'HAAB',
  LOS: 'DNMM',
  ACC: 'DGAA',
  CMN: 'GMMN',
  TUN: 'DTTA',
  DAR: 'HTDA',
  EBB: 'HUEN',

  // ── North America ─────────────────────────────────────────────────────
  JFK: 'KJFK',
  ATL: 'KATL',
  DFW: 'KDFW',
  MIA: 'KMIA',
  SFO: 'KSFO',
  SEA: 'KSEA',
  IAH: 'KIAH',
  YYZ: 'CYYZ',
  YVR: 'CYVR',
  YUL: 'CYUL',
  MEX: 'MMMX',
  PTY: 'MPTO',
  GUA: 'MGGT',
  HAV: 'MUHA',

  // ── South America ─────────────────────────────────────────────────────
  GRU: 'SBGR',
  EZE: 'SAEZ',
  BOG: 'SKBO',
  SCL: 'SCEL',
  LIM: 'SPJC',
  GIG: 'SBGL',
  UIO: 'SEQM',
  CCS: 'SVMI',

  // ── Oceania ───────────────────────────────────────────────────────────
  SYD: 'YSSY',
  MEL: 'YMML',
  BNE: 'YBBN',
  PER: 'YPPH',
  AKL: 'NZAA',
  POM: 'AYPY',
  NAN: 'NFFN',

  // ── Central Asia ──────────────────────────────────────────────────────
  ALA: 'UAAA',
  TBS: 'UGTB',
  TAS: 'UTTT',
};
