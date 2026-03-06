
// Maps region/country names and currency codes to ISO 3166-1 alpha-2 country codes
const KEY_TO_COUNTRY: Record<string, string> = {
  'United States': 'us', 'United Kingdom': 'gb', 'Japan': 'jp',
  'Germany': 'de', 'France': 'fr', 'Hong Kong': 'hk',
  'Australia': 'au', 'Canada': 'ca', 'Europe': 'eu',
  'South Korea': 'kr', 'India': 'in', 'Brazil': 'br',
  'China': 'cn', 'Switzerland': 'ch', 'Singapore': 'sg',
  'Mexico': 'mx', 'Taiwan': 'tw', 'Sweden': 'se',
  'Norway': 'no', 'Denmark': 'dk', 'New Zealand': 'nz',
  'South Africa': 'za', 'Russia': 'ru', 'Turkey': 'tr',
  'USD': 'us', 'EUR': 'eu', 'GBP': 'gb', 'JPY': 'jp',
  'CAD': 'ca', 'AUD': 'au', 'CHF': 'ch', 'CNY': 'cn',
  'HKD': 'hk', 'KRW': 'kr', 'INR': 'in', 'BRL': 'br',
  'SGD': 'sg', 'MXN': 'mx', 'TWD': 'tw', 'SEK': 'se',
  'NOK': 'no', 'DKK': 'dk', 'NZD': 'nz', 'ZAR': 'za',
  'RUB': 'ru', 'TRY': 'tr',
};

export function getCountryCode(key: string): string | null {
  return KEY_TO_COUNTRY[key] ?? null;
}

/** Returns a flagcdn.com SVG URL for the given region/currency key */
export function getFlagUrl(key: string, width = 24): string | null {
  const cc = getCountryCode(key);
  if (!cc) return null;
  return `https://flagcdn.com/w${width}/${cc}.png`;
}

/** Legacy emoji flag helper */
export function getFlag(key: string): string {
  const EMOJI: Record<string, string> = {
    'us': '🇺🇸', 'gb': '🇬🇧', 'jp': '🇯🇵', 'de': '🇩🇪', 'fr': '🇫🇷',
    'hk': '🇭🇰', 'au': '🇦🇺', 'ca': '🇨🇦', 'eu': '🇪🇺', 'kr': '🇰🇷',
    'in': '🇮🇳', 'br': '🇧🇷', 'cn': '🇨🇳', 'ch': '🇨🇭', 'sg': '🇸🇬',
  };
  const cc = getCountryCode(key);
  return cc ? (EMOJI[cc] ?? '🏳️') : '🏳️';
}
