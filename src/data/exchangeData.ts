// ── Global Stock Exchange Dataset ─────────────────────────────────────────
// City-level coordinates + trading metadata for major stock exchanges worldwide.
// Used for globe pin rendering, CountryExchanges list, and ExchangeDetailDialog.

export interface ExchangeInfo {
  code: string;
  name: string;
  city: string;
  country: string;   // ISO 3166-1 alpha-2
  lat: number;
  lng: number;
  continent: "Americas" | "Europe" | "Asia-Pacific" | "Middle East & Africa";
  openTime: string;   // "HH:MM" local time
  closeTime: string;  // "HH:MM" local time
  timezone: string;   // IANA timezone identifier
  currency: string;   // ISO 4217
  website: string;    // exchange homepage URL
  tradingDays: number[]; // days of week that trade: 0=Sun … 6=Sat
}

export const CONTINENT_COLORS: Record<string, string> = {
  "Americas":            "#3b82f6", // blue
  "Europe":              "#a855f7", // purple
  "Asia-Pacific":        "#f59e0b", // amber
  "Middle East & Africa":"#10b981", // emerald
};

// ── Helper: is an exchange currently open? ─────────────────────────────────
// Uses Intl.DateTimeFormat to get the current local time at the exchange's
// timezone, then compares with open/close windows + trading days.
export function isExchangeOpen(ex: ExchangeInfo): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: ex.timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find(p => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find(p => p.type === "minute")?.value ?? 0);
  const weekdayStr = parts.find(p => p.type === "weekday")?.value ?? "";

  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = dayMap[weekdayStr] ?? -1;

  if (!ex.tradingDays.includes(dayOfWeek)) return false;

  const currentMinutes = hour * 60 + minute;
  const [openH, openM] = ex.openTime.split(":").map(Number);
  const [closeH, closeM] = ex.closeTime.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

// ── Helper: format timezone abbreviation (cached) ─────────────────────────
const _tzAbbrCache = new Map<string, string>();
export function getTimezoneAbbr(tz: string): string {
  const cached = _tzAbbrCache.get(tz);
  if (cached) return cached;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date());
    const abbr = parts.find(p => p.type === "timeZoneName")?.value ?? tz;
    _tzAbbrCache.set(tz, abbr);
    return abbr;
  } catch {
    return tz;
  }
}

// ── Helper: convert exchange local time → user's local time ────────────────
// Takes an "HH:MM" string in the exchange's timezone and returns "HH:MM" in
// the user's local timezone. Uses Intl to handle DST automatically.
export function exchangeTimeToLocal(timeStr: string, exchangeTz: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const now = new Date();

  // Start with a UTC date at the target hours/minutes
  const guess = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0));

  // Check what the exchange timezone reads for this UTC instant
  const readTzMinutes = (date: Date, tz: string): number => {
    const s = date.toLocaleString("en-US", { timeZone: tz, hourCycle: "h23", hour: "2-digit", minute: "2-digit" });
    const [hr, mn] = s.split(":").map(Number);
    return hr * 60 + mn;
  };

  const exchReading = readTzMinutes(guess, exchangeTz);
  const target = h * 60 + m;

  // Shift so the exchange timezone reads exactly h:m
  let shiftMs = (target - exchReading) * 60000;
  if (shiftMs > 12 * 3600000) shiftMs -= 24 * 3600000;
  if (shiftMs < -12 * 3600000) shiftMs += 24 * 3600000;

  const adjusted = new Date(guess.getTime() + shiftMs);

  // Format in the user's local timezone
  return adjusted.toLocaleTimeString("en-US", { hourCycle: "h23", hour: "2-digit", minute: "2-digit" });
}

// ── Helper: user's local timezone abbreviation ─────────────────────────────
let _localTzAbbrCache: string | null = null;
export function getLocalTimezoneAbbr(): string {
  if (_localTzAbbrCache) return _localTzAbbrCache;
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  _localTzAbbrCache = getTimezoneAbbr(localTz);
  return _localTzAbbrCache;
}

const MON_FRI = [1, 2, 3, 4, 5];
const SUN_THU = [0, 1, 2, 3, 4];

export const EXCHANGES: ExchangeInfo[] = [
  // ── Americas ───────────────────────────────────────────────────────────
  { code: "NYSE",    name: "New York Stock Exchange",        city: "New York",      country: "US", lat: 40.7069, lng: -74.0113, continent: "Americas",
    openTime: "09:30", closeTime: "16:00", timezone: "America/New_York",              currency: "USD", website: "https://www.nyse.com",           tradingDays: MON_FRI },
  { code: "NASDAQ",  name: "NASDAQ",                         city: "New York",      country: "US", lat: 40.7570, lng: -73.9720, continent: "Americas",
    openTime: "09:30", closeTime: "16:00", timezone: "America/New_York",              currency: "USD", website: "https://www.nasdaq.com",         tradingDays: MON_FRI },
  { code: "AMEX",    name: "NYSE American",                  city: "New York",      country: "US", lat: 40.7060, lng: -74.0090, continent: "Americas",
    openTime: "09:30", closeTime: "16:00", timezone: "America/New_York",              currency: "USD", website: "https://www.nyse.com/markets/nyse-american", tradingDays: MON_FRI },
  { code: "CBOE",    name: "Cboe Global Markets",            city: "Chicago",       country: "US", lat: 41.8819, lng: -87.6278, continent: "Americas",
    openTime: "08:30", closeTime: "15:15", timezone: "America/Chicago",               currency: "USD", website: "https://www.cboe.com",           tradingDays: MON_FRI },
  { code: "TSX",     name: "Toronto Stock Exchange",         city: "Toronto",       country: "CA", lat: 43.6490, lng: -79.3806, continent: "Americas",
    openTime: "09:30", closeTime: "16:00", timezone: "America/Toronto",               currency: "CAD", website: "https://www.tsx.com",             tradingDays: MON_FRI },
  { code: "TSXV",    name: "TSX Venture Exchange",           city: "Toronto",       country: "CA", lat: 43.6510, lng: -79.3830, continent: "Americas",
    openTime: "09:30", closeTime: "16:00", timezone: "America/Toronto",               currency: "CAD", website: "https://www.tsx.com",             tradingDays: MON_FRI },
  { code: "BMV",     name: "Bolsa Mexicana de Valores",      city: "Mexico City",   country: "MX", lat: 19.4326, lng: -99.1332, continent: "Americas",
    openTime: "08:30", closeTime: "15:00", timezone: "America/Mexico_City",           currency: "MXN", website: "https://www.bmv.com.mx",         tradingDays: MON_FRI },
  { code: "B3",      name: "B3 (Bovespa)",                   city: "São Paulo",     country: "BR", lat: -23.5505, lng: -46.6333, continent: "Americas",
    openTime: "10:00", closeTime: "17:00", timezone: "America/Sao_Paulo",             currency: "BRL", website: "https://www.b3.com.br",          tradingDays: MON_FRI },
  { code: "BCBA",    name: "Buenos Aires Stock Exchange",    city: "Buenos Aires",  country: "AR", lat: -34.6037, lng: -58.3816, continent: "Americas",
    openTime: "11:00", closeTime: "17:00", timezone: "America/Argentina/Buenos_Aires", currency: "ARS", website: "https://www.bcba.sba.com.ar",   tradingDays: MON_FRI },
  { code: "BVC",     name: "Bolsa de Valores de Colombia",   city: "Bogotá",        country: "CO", lat: 4.7110,  lng: -74.0721, continent: "Americas",
    openTime: "09:30", closeTime: "16:00", timezone: "America/Bogota",                currency: "COP", website: "https://www.bvc.com.co",         tradingDays: MON_FRI },
  { code: "BCS",     name: "Santiago Stock Exchange",         city: "Santiago",      country: "CL", lat: -33.4489, lng: -70.6693, continent: "Americas",
    openTime: "09:30", closeTime: "16:00", timezone: "America/Santiago",              currency: "CLP", website: "https://www.bolsadesantiago.com", tradingDays: MON_FRI },
  { code: "BVL",     name: "Lima Stock Exchange",             city: "Lima",          country: "PE", lat: -12.0464, lng: -77.0428, continent: "Americas",
    openTime: "09:00", closeTime: "16:00", timezone: "America/Lima",                  currency: "PEN", website: "https://www.bvl.com.pe",         tradingDays: MON_FRI },

  // ── Europe ─────────────────────────────────────────────────────────────
  { code: "LSE",     name: "London Stock Exchange",          city: "London",        country: "GB", lat: 51.5145, lng: -0.0990,  continent: "Europe",
    openTime: "08:00", closeTime: "16:30", timezone: "Europe/London",                 currency: "GBP", website: "https://www.londonstockexchange.com", tradingDays: MON_FRI },
  { code: "XETRA",   name: "Deutsche Börse (Xetra)",        city: "Frankfurt",     country: "DE", lat: 50.1109, lng: 8.6821,   continent: "Europe",
    openTime: "09:00", closeTime: "17:30", timezone: "Europe/Berlin",                 currency: "EUR", website: "https://www.deutsche-boerse.com", tradingDays: MON_FRI },
  { code: "EPA",     name: "Euronext Paris",                  city: "Paris",         country: "FR", lat: 48.8698, lng: 2.3411,   continent: "Europe",
    openTime: "09:00", closeTime: "17:30", timezone: "Europe/Paris",                  currency: "EUR", website: "https://www.euronext.com/en/markets/paris", tradingDays: MON_FRI },
  { code: "AMS",     name: "Euronext Amsterdam",              city: "Amsterdam",     country: "NL", lat: 52.3676, lng: 4.9041,   continent: "Europe",
    openTime: "09:00", closeTime: "17:30", timezone: "Europe/Amsterdam",              currency: "EUR", website: "https://www.euronext.com/en/markets/amsterdam", tradingDays: MON_FRI },
  { code: "EBR",     name: "Euronext Brussels",               city: "Brussels",      country: "BE", lat: 50.8466, lng: 4.3517,   continent: "Europe",
    openTime: "09:00", closeTime: "17:30", timezone: "Europe/Brussels",               currency: "EUR", website: "https://www.euronext.com/en/markets/brussels", tradingDays: MON_FRI },
  { code: "ELI",     name: "Euronext Lisbon",                 city: "Lisbon",        country: "PT", lat: 38.7223, lng: -9.1393,  continent: "Europe",
    openTime: "08:00", closeTime: "16:30", timezone: "Europe/Lisbon",                 currency: "EUR", website: "https://www.euronext.com/en/markets/lisbon", tradingDays: MON_FRI },
  { code: "EID",     name: "Euronext Dublin",                 city: "Dublin",        country: "IE", lat: 53.3331, lng: -6.2489,  continent: "Europe",
    openTime: "08:00", closeTime: "16:30", timezone: "Europe/Dublin",                 currency: "EUR", website: "https://www.euronext.com/en/markets/dublin", tradingDays: MON_FRI },
  { code: "SIX",     name: "SIX Swiss Exchange",              city: "Zurich",        country: "CH", lat: 47.3769, lng: 8.5417,   continent: "Europe",
    openTime: "09:00", closeTime: "17:30", timezone: "Europe/Zurich",                 currency: "CHF", website: "https://www.six-group.com",      tradingDays: MON_FRI },
  { code: "BIT",     name: "Borsa Italiana",                  city: "Milan",         country: "IT", lat: 45.4642, lng: 9.1900,   continent: "Europe",
    openTime: "09:00", closeTime: "17:30", timezone: "Europe/Rome",                   currency: "EUR", website: "https://www.borsaitaliana.it",   tradingDays: MON_FRI },
  { code: "BME",     name: "Bolsas y Mercados Españoles",    city: "Madrid",        country: "ES", lat: 40.4168, lng: -3.7038,  continent: "Europe",
    openTime: "09:00", closeTime: "17:30", timezone: "Europe/Madrid",                 currency: "EUR", website: "https://www.bolsasymercados.es", tradingDays: MON_FRI },
  { code: "OMX-S",   name: "Nasdaq Stockholm",                city: "Stockholm",     country: "SE", lat: 59.3326, lng: 18.0649,  continent: "Europe",
    openTime: "09:00", closeTime: "17:30", timezone: "Europe/Stockholm",              currency: "SEK", website: "https://www.nasdaq.com/solutions/nasdaq-nordic", tradingDays: MON_FRI },
  { code: "OMX-C",   name: "Nasdaq Copenhagen",               city: "Copenhagen",    country: "DK", lat: 55.6761, lng: 12.5683,  continent: "Europe",
    openTime: "09:00", closeTime: "17:00", timezone: "Europe/Copenhagen",             currency: "DKK", website: "https://www.nasdaq.com/solutions/nasdaq-nordic", tradingDays: MON_FRI },
  { code: "OMX-H",   name: "Nasdaq Helsinki",                 city: "Helsinki",      country: "FI", lat: 60.1699, lng: 24.9384,  continent: "Europe",
    openTime: "10:00", closeTime: "18:30", timezone: "Europe/Helsinki",               currency: "EUR", website: "https://www.nasdaq.com/solutions/nasdaq-nordic", tradingDays: MON_FRI },
  { code: "OSE",     name: "Oslo Børs",                       city: "Oslo",          country: "NO", lat: 59.9139, lng: 10.7522,  continent: "Europe",
    openTime: "09:00", closeTime: "16:20", timezone: "Europe/Oslo",                   currency: "NOK", website: "https://www.euronext.com/en/markets/oslo", tradingDays: MON_FRI },
  { code: "WSE",     name: "Warsaw Stock Exchange",           city: "Warsaw",        country: "PL", lat: 52.2297, lng: 21.0122,  continent: "Europe",
    openTime: "09:00", closeTime: "17:00", timezone: "Europe/Warsaw",                 currency: "PLN", website: "https://www.gpw.pl",             tradingDays: MON_FRI },
  { code: "VSE",     name: "Wiener Börse",                    city: "Vienna",        country: "AT", lat: 48.2082, lng: 16.3738,  continent: "Europe",
    openTime: "09:00", closeTime: "17:30", timezone: "Europe/Vienna",                 currency: "EUR", website: "https://www.wienerborse.at",     tradingDays: MON_FRI },
  { code: "ATHEX",   name: "Athens Stock Exchange",           city: "Athens",        country: "GR", lat: 37.9838, lng: 23.7275,  continent: "Europe",
    openTime: "10:00", closeTime: "17:20", timezone: "Europe/Athens",                 currency: "EUR", website: "https://www.athexgroup.gr",      tradingDays: MON_FRI },
  { code: "PSE",     name: "Prague Stock Exchange",           city: "Prague",        country: "CZ", lat: 50.0755, lng: 14.4378,  continent: "Europe",
    openTime: "09:00", closeTime: "16:30", timezone: "Europe/Prague",                 currency: "CZK", website: "https://www.pse.cz",             tradingDays: MON_FRI },
  { code: "BET",     name: "Bucharest Stock Exchange",        city: "Bucharest",     country: "RO", lat: 44.4268, lng: 26.1025,  continent: "Europe",
    openTime: "10:00", closeTime: "17:45", timezone: "Europe/Bucharest",              currency: "RON", website: "https://www.bvb.ro",             tradingDays: MON_FRI },
  { code: "MOEX",    name: "Moscow Exchange",                 city: "Moscow",        country: "RU", lat: 55.7558, lng: 37.6173,  continent: "Europe",
    openTime: "10:00", closeTime: "18:50", timezone: "Europe/Moscow",                 currency: "RUB", website: "https://www.moex.com",           tradingDays: MON_FRI },
  { code: "ISE",     name: "Nasdaq Iceland",                  city: "Reykjavik",     country: "IS", lat: 64.1466, lng: -21.9426, continent: "Europe",
    openTime: "09:30", closeTime: "15:30", timezone: "Atlantic/Reykjavik",            currency: "ISK", website: "https://www.nasdaq.com/solutions/nasdaq-iceland", tradingDays: MON_FRI },

  // ── Asia-Pacific ───────────────────────────────────────────────────────
  { code: "TSE",     name: "Tokyo Stock Exchange",            city: "Tokyo",         country: "JP", lat: 35.6812, lng: 139.7671, continent: "Asia-Pacific",
    openTime: "09:00", closeTime: "15:30", timezone: "Asia/Tokyo",                    currency: "JPY", website: "https://www.jpx.co.jp",          tradingDays: MON_FRI },
  { code: "OSE-JP",  name: "Osaka Exchange",                  city: "Osaka",         country: "JP", lat: 34.6937, lng: 135.5023, continent: "Asia-Pacific",
    openTime: "08:45", closeTime: "15:15", timezone: "Asia/Tokyo",                    currency: "JPY", website: "https://www.jpx.co.jp",          tradingDays: MON_FRI },
  { code: "SSE",     name: "Shanghai Stock Exchange",         city: "Shanghai",      country: "CN", lat: 31.2304, lng: 121.4737, continent: "Asia-Pacific",
    openTime: "09:30", closeTime: "15:00", timezone: "Asia/Shanghai",                 currency: "CNY", website: "https://www.sse.com.cn",         tradingDays: MON_FRI },
  { code: "SZSE",    name: "Shenzhen Stock Exchange",         city: "Shenzhen",      country: "CN", lat: 22.5431, lng: 114.0579, continent: "Asia-Pacific",
    openTime: "09:30", closeTime: "15:00", timezone: "Asia/Shanghai",                 currency: "CNY", website: "https://www.szse.cn",            tradingDays: MON_FRI },
  { code: "HKEX",    name: "Hong Kong Stock Exchange",        city: "Hong Kong",     country: "HK", lat: 22.2860, lng: 114.1589, continent: "Asia-Pacific",
    openTime: "09:30", closeTime: "16:00", timezone: "Asia/Hong_Kong",                currency: "HKD", website: "https://www.hkex.com.hk",        tradingDays: MON_FRI },
  { code: "KRX",     name: "Korea Exchange",                  city: "Seoul",         country: "KR", lat: 37.5665, lng: 126.9780, continent: "Asia-Pacific",
    openTime: "09:00", closeTime: "15:30", timezone: "Asia/Seoul",                    currency: "KRW", website: "https://www.krx.co.kr",          tradingDays: MON_FRI },
  { code: "TWSE",    name: "Taiwan Stock Exchange",           city: "Taipei",        country: "TW", lat: 25.0330, lng: 121.5654, continent: "Asia-Pacific",
    openTime: "09:00", closeTime: "13:30", timezone: "Asia/Taipei",                   currency: "TWD", website: "https://www.twse.com.tw",        tradingDays: MON_FRI },
  { code: "BSE",     name: "BSE (Bombay Stock Exchange)",     city: "Mumbai",        country: "IN", lat: 18.9281, lng: 72.8334,  continent: "Asia-Pacific",
    openTime: "09:15", closeTime: "15:30", timezone: "Asia/Kolkata",                  currency: "INR", website: "https://www.bseindia.com",       tradingDays: MON_FRI },
  { code: "NSE-IN",  name: "National Stock Exchange of India",city: "Mumbai",        country: "IN", lat: 19.0560, lng: 72.8470,  continent: "Asia-Pacific",
    openTime: "09:15", closeTime: "15:30", timezone: "Asia/Kolkata",                  currency: "INR", website: "https://www.nseindia.com",       tradingDays: MON_FRI },
  { code: "SGX",     name: "Singapore Exchange",              city: "Singapore",     country: "SG", lat: 1.2812,  lng: 103.8503, continent: "Asia-Pacific",
    openTime: "09:00", closeTime: "17:00", timezone: "Asia/Singapore",                currency: "SGD", website: "https://www.sgx.com",            tradingDays: MON_FRI },
  { code: "IDX",     name: "Indonesia Stock Exchange",        city: "Jakarta",       country: "ID", lat: -6.2088, lng: 106.8456, continent: "Asia-Pacific",
    openTime: "09:00", closeTime: "16:15", timezone: "Asia/Jakarta",                  currency: "IDR", website: "https://www.idx.co.id",          tradingDays: MON_FRI },
  { code: "SET",     name: "Stock Exchange of Thailand",      city: "Bangkok",       country: "TH", lat: 13.7563, lng: 100.5018, continent: "Asia-Pacific",
    openTime: "10:00", closeTime: "16:30", timezone: "Asia/Bangkok",                  currency: "THB", website: "https://www.set.or.th",          tradingDays: MON_FRI },
  { code: "BURSA",   name: "Bursa Malaysia",                  city: "Kuala Lumpur",  country: "MY", lat: 3.1390,  lng: 101.6869, continent: "Asia-Pacific",
    openTime: "09:00", closeTime: "17:00", timezone: "Asia/Kuala_Lumpur",             currency: "MYR", website: "https://www.bursamalaysia.com",  tradingDays: MON_FRI },
  { code: "PSEi",    name: "Philippine Stock Exchange",       city: "Manila",        country: "PH", lat: 14.5995, lng: 120.9842, continent: "Asia-Pacific",
    openTime: "09:30", closeTime: "15:30", timezone: "Asia/Manila",                   currency: "PHP", website: "https://www.pse.com.ph",        tradingDays: MON_FRI },
  { code: "HOSE",    name: "Ho Chi Minh Stock Exchange",      city: "Ho Chi Minh",   country: "VN", lat: 10.7769, lng: 106.7009, continent: "Asia-Pacific",
    openTime: "09:00", closeTime: "15:00", timezone: "Asia/Ho_Chi_Minh",              currency: "VND", website: "https://www.hsx.vn",             tradingDays: MON_FRI },
  { code: "CSE",     name: "Colombo Stock Exchange",          city: "Colombo",       country: "LK", lat: 6.9271,  lng: 79.8612,  continent: "Asia-Pacific",
    openTime: "09:30", closeTime: "14:30", timezone: "Asia/Colombo",                  currency: "LKR", website: "https://www.cse.lk",             tradingDays: MON_FRI },
  { code: "DSE",     name: "Dhaka Stock Exchange",            city: "Dhaka",         country: "BD", lat: 23.8103, lng: 90.4125,  continent: "Asia-Pacific",
    openTime: "10:00", closeTime: "14:30", timezone: "Asia/Dhaka",                    currency: "BDT", website: "https://www.dsebd.org",          tradingDays: SUN_THU },
  { code: "PSX",     name: "Pakistan Stock Exchange",         city: "Karachi",       country: "PK", lat: 24.8607, lng: 67.0011,  continent: "Asia-Pacific",
    openTime: "09:30", closeTime: "15:30", timezone: "Asia/Karachi",                  currency: "PKR", website: "https://www.psx.com.pk",         tradingDays: MON_FRI },
  { code: "ASX",     name: "Australian Securities Exchange",  city: "Sydney",        country: "AU", lat: -33.8688, lng: 151.2093, continent: "Asia-Pacific",
    openTime: "10:00", closeTime: "16:00", timezone: "Australia/Sydney",              currency: "AUD", website: "https://www.asx.com.au",         tradingDays: MON_FRI },
  { code: "NZX",     name: "New Zealand Exchange",            city: "Wellington",    country: "NZ", lat: -41.2865, lng: 174.7762, continent: "Asia-Pacific",
    openTime: "10:00", closeTime: "16:45", timezone: "Pacific/Auckland",              currency: "NZD", website: "https://www.nzx.com",            tradingDays: MON_FRI },
  { code: "KASE",    name: "Kazakhstan Stock Exchange",       city: "Almaty",        country: "KZ", lat: 43.2220, lng: 76.8512,  continent: "Asia-Pacific",
    openTime: "11:00", closeTime: "17:00", timezone: "Asia/Almaty",                   currency: "KZT", website: "https://www.kase.kz",            tradingDays: MON_FRI },

  // ── Middle East & Africa ───────────────────────────────────────────────
  { code: "TASE",    name: "Tel Aviv Stock Exchange",         city: "Tel Aviv",      country: "IL", lat: 32.0853, lng: 34.7818,  continent: "Middle East & Africa",
    openTime: "09:59", closeTime: "17:14", timezone: "Asia/Jerusalem",                currency: "ILS", website: "https://www.tase.co.il",         tradingDays: SUN_THU },
  { code: "TADAWUL", name: "Saudi Exchange (Tadawul)",        city: "Riyadh",        country: "SA", lat: 24.7136, lng: 46.6753,  continent: "Middle East & Africa",
    openTime: "10:00", closeTime: "15:00", timezone: "Asia/Riyadh",                   currency: "SAR", website: "https://www.saudiexchange.sa",   tradingDays: SUN_THU },
  { code: "DFM",     name: "Dubai Financial Market",          city: "Dubai",         country: "AE", lat: 25.2048, lng: 55.2708,  continent: "Middle East & Africa",
    openTime: "10:00", closeTime: "14:00", timezone: "Asia/Dubai",                    currency: "AED", website: "https://www.dfm.ae",             tradingDays: [1, 2, 3, 4, 5] },
  { code: "ADX",     name: "Abu Dhabi Securities Exchange",   city: "Abu Dhabi",     country: "AE", lat: 24.4539, lng: 54.3773,  continent: "Middle East & Africa",
    openTime: "10:00", closeTime: "14:00", timezone: "Asia/Dubai",                    currency: "AED", website: "https://www.adx.ae",             tradingDays: [1, 2, 3, 4, 5] },
  { code: "QSE",     name: "Qatar Stock Exchange",            city: "Doha",          country: "QA", lat: 25.2854, lng: 51.5310,  continent: "Middle East & Africa",
    openTime: "09:30", closeTime: "13:15", timezone: "Asia/Qatar",                    currency: "QAR", website: "https://www.qe.com.qa",          tradingDays: SUN_THU },
  { code: "KSE",     name: "Kuwait Stock Exchange",           city: "Kuwait City",   country: "KW", lat: 29.3759, lng: 47.9774,  continent: "Middle East & Africa",
    openTime: "09:30", closeTime: "12:30", timezone: "Asia/Kuwait",                   currency: "KWD", website: "https://www.boursakuwait.com.kw", tradingDays: SUN_THU },
  { code: "BSE-BH",  name: "Bahrain Bourse",                  city: "Manama",        country: "BH", lat: 26.2285, lng: 50.5860,  continent: "Middle East & Africa",
    openTime: "09:30", closeTime: "13:00", timezone: "Asia/Bahrain",                  currency: "BHD", website: "https://www.bahrainbourse.com",  tradingDays: SUN_THU },
  { code: "MSM",     name: "Muscat Securities Market",        city: "Muscat",        country: "OM", lat: 23.5880, lng: 58.3829,  continent: "Middle East & Africa",
    openTime: "10:00", closeTime: "13:00", timezone: "Asia/Muscat",                   currency: "OMR", website: "https://www.msm.gov.om",         tradingDays: SUN_THU },
  { code: "BIST",    name: "Borsa Istanbul",                   city: "Istanbul",      country: "TR", lat: 41.0082, lng: 28.9784,  continent: "Middle East & Africa",
    openTime: "10:00", closeTime: "18:00", timezone: "Europe/Istanbul",               currency: "TRY", website: "https://www.borsaistanbul.com",  tradingDays: MON_FRI },
  { code: "TSE-IR",  name: "Tehran Stock Exchange",           city: "Tehran",        country: "IR", lat: 35.6892, lng: 51.3890,  continent: "Middle East & Africa",
    openTime: "09:00", closeTime: "12:30", timezone: "Asia/Tehran",                   currency: "IRR", website: "https://www.tse.ir",             tradingDays: [0, 1, 2, 3, 4] },
  { code: "JSE",     name: "Johannesburg Stock Exchange",     city: "Johannesburg",  country: "ZA", lat: -26.2041, lng: 28.0473, continent: "Middle East & Africa",
    openTime: "09:00", closeTime: "17:00", timezone: "Africa/Johannesburg",           currency: "ZAR", website: "https://www.jse.co.za",          tradingDays: MON_FRI },
  { code: "EGX",     name: "Egyptian Exchange",               city: "Cairo",         country: "EG", lat: 30.0444, lng: 31.2357,  continent: "Middle East & Africa",
    openTime: "10:00", closeTime: "14:30", timezone: "Africa/Cairo",                  currency: "EGP", website: "https://www.egx.com.eg",         tradingDays: SUN_THU },
  { code: "NSE-NG",  name: "Nigerian Exchange",               city: "Lagos",         country: "NG", lat: 6.5244,  lng: 3.3792,   continent: "Middle East & Africa",
    openTime: "09:30", closeTime: "14:30", timezone: "Africa/Lagos",                  currency: "NGN", website: "https://www.ngxgroup.com",       tradingDays: MON_FRI },
  { code: "CASA",    name: "Casablanca Stock Exchange",       city: "Casablanca",    country: "MA", lat: 33.5731, lng: -7.5898,  continent: "Middle East & Africa",
    openTime: "09:30", closeTime: "15:30", timezone: "Africa/Casablanca",             currency: "MAD", website: "https://www.casablanca-bourse.com", tradingDays: MON_FRI },
  { code: "NSE-KE",  name: "Nairobi Securities Exchange",    city: "Nairobi",       country: "KE", lat: -1.2921, lng: 36.8219,  continent: "Middle East & Africa",
    openTime: "09:00", closeTime: "15:00", timezone: "Africa/Nairobi",                currency: "KES", website: "https://www.nse.co.ke",          tradingDays: MON_FRI },
  { code: "GSE",     name: "Ghana Stock Exchange",            city: "Accra",         country: "GH", lat: 5.6037,  lng: -0.1870,  continent: "Middle East & Africa",
    openTime: "09:30", closeTime: "15:00", timezone: "Africa/Accra",                  currency: "GHS", website: "https://www.gse.com.gh",         tradingDays: MON_FRI },
  { code: "DSE-TZ",  name: "Dar es Salaam Stock Exchange",   city: "Dar es Salaam", country: "TZ", lat: -6.7924, lng: 39.2083,  continent: "Middle East & Africa",
    openTime: "10:00", closeTime: "14:00", timezone: "Africa/Dar_es_Salaam",          currency: "TZS", website: "https://www.dse.co.tz",          tradingDays: MON_FRI },
  { code: "USE",     name: "Uganda Securities Exchange",      city: "Kampala",       country: "UG", lat: 0.3476,  lng: 32.5825,  continent: "Middle East & Africa",
    openTime: "09:30", closeTime: "17:00", timezone: "Africa/Kampala",                currency: "UGX", website: "https://www.use.or.ug",          tradingDays: MON_FRI },
  { code: "BSE-BW",  name: "Botswana Stock Exchange",         city: "Gaborone",      country: "BW", lat: -24.6282, lng: 25.9231, continent: "Middle East & Africa",
    openTime: "09:00", closeTime: "15:30", timezone: "Africa/Gaborone",               currency: "BWP", website: "https://www.bse.co.bw",          tradingDays: MON_FRI },
];

// ── Pre-computed display data (computed once at module load) ───────────────
// Avoids 365+ Intl.DateTimeFormat instantiations per render.
export interface ExchangeDisplayData {
  localOpen: string;
  localClose: string;
  exchTzAbbr: string;
}

let _displayCache: Map<string, ExchangeDisplayData> | null = null;
export function getExchangeDisplayData(code: string): ExchangeDisplayData {
  if (!_displayCache) {
    _displayCache = new Map();
    const localTz = getLocalTimezoneAbbr(); // warm cache
    void localTz;
    for (const ex of EXCHANGES) {
      _displayCache.set(ex.code, {
        localOpen: exchangeTimeToLocal(ex.openTime, ex.timezone),
        localClose: exchangeTimeToLocal(ex.closeTime, ex.timezone),
        exchTzAbbr: getTimezoneAbbr(ex.timezone),
      });
    }
  }
  return _displayCache.get(code) ?? { localOpen: "--:--", localClose: "--:--", exchTzAbbr: "" };
}
