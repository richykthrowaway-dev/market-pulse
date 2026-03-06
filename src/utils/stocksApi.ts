export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  lastUpdated: Date;
}

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  region: string;
  lastUpdated: Date;
}

export interface CurrencyPair {
  symbol: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  change: number;
  changePercent: number;
  lastUpdated: Date;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  imageUrl?: string;
  publishedAt: Date;
  relatedSymbols?: string[];
}

export interface Cryptocurrency {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
  volume: number;
  supply: number;
  lastUpdated: Date;
}

export function formatNumber(num: number, currencyCode: string = 'USD'): string {
  // Pick a currency symbol prefix
  const sym = currencySymbol(currencyCode);
  if (num >= 1000000000000) {
    return `${sym}${(num / 1000000000000).toFixed(2)}T`;
  }
  if (num >= 1000000000) {
    return `${sym}${(num / 1000000000).toFixed(2)}B`;
  }
  if (num >= 1000000) {
    return `${sym}${(num / 1000000).toFixed(2)}M`;
  }
  if (num >= 1000) {
    return `${sym}${(num / 1000).toFixed(2)}K`;
  }
  return `${sym}${num.toFixed(2)}`;
}

/** Get a short currency symbol for display */
function currencySymbol(code: string): string {
  try {
    // Use Intl to resolve the symbol
    const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).formatToParts(0);
    return parts.find(p => p.type === 'currency')?.value || '$';
  } catch {
    return '$';
  }
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    // Fallback for unknown currency codes
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
}

export function formatPercentage(num: number): string {
  return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;
}

export function formatDate(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInSec = Math.floor(diffInMs / 1000);
  const diffInMin = Math.floor(diffInSec / 60);
  const diffInHour = Math.floor(diffInMin / 60);
  
  if (diffInSec < 60) {
    return 'Just now';
  } else if (diffInMin < 60) {
    return `${diffInMin}m ago`;
  } else if (diffInHour < 24) {
    return `${diffInHour}h ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
