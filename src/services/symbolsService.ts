import { supabase } from '@/integrations/supabase/client';
import { rankSymbols } from '@/lib/symbolRank';

export interface SymbolSearchResult {
  symbolId: string;
  canonicalTicker: string;
  name: string;
  type: string;
  sector: string | null;
  industry: string | null;
  country: string | null;
  primaryListingId: string | null;
  primaryExchangeCode: string | null;
  primaryLocalTicker: string | null;
}

export interface SymbolDetail {
  id: string;
  canonicalTicker: string;
  name: string;
  isin: string | null;
  figi: string | null;
  type: string;
  sector: string | null;
  industry: string | null;
  gicsSector: string | null;
  gicsIndustryGroup: string | null;
  gicsIndustry: string | null;
  gicsSubIndustry: string | null;
  country: string | null;
  currency: string | null;
  createdAt: string;
}

export async function searchSymbols(
  query: string,
  limit = 10
): Promise<SymbolSearchResult[]> {
  const pattern = `%${query}%`;
  const prefix = `${query}%`;
  const pool = Math.max(limit * 5, 50);

  const SELECT = `
    id, canonical_ticker, name, type, sector, industry, country,
    listings!inner ( id, local_ticker, primary_listing, exchange_id,
      exchanges ( code )
    )
  `;

  // Dedicated ticker-prefix query: guarantees exact/prefix-ticker rows are
  // always in the candidate pool, even for short queries where the broad
  // alphabetical pool would otherwise exclude the exact match.
  const tickerQ = supabase
    .from('symbols')
    .select(SELECT)
    .ilike('canonical_ticker', prefix)
    .order('canonical_ticker', { ascending: true })
    .limit(limit * 2);

  // Broad pool: ticker OR company-name substring.
  const broadQ = supabase
    .from('symbols')
    .select(SELECT)
    .or(`canonical_ticker.ilike.${pattern},name.ilike.${pattern}`)
    .order('canonical_ticker', { ascending: true })
    .limit(pool);

  const [tickerRes, broadRes] = await Promise.all([tickerQ, broadQ]);
  if (tickerRes.error) throw tickerRes.error;
  if (broadRes.error) throw broadRes.error;

  // Merge, ticker-prefix rows first, de-duplicated by id.
  const byId = new Map<string, any>();
  for (const s of [...(tickerRes.data ?? []), ...(broadRes.data ?? [])]) {
    if (!byId.has(s.id)) byId.set(s.id, s);
  }

  const mapped: SymbolSearchResult[] = [...byId.values()].map((s: any) => {
    const primary = (s.listings as any[])?.find((l: any) => l.primary_listing) ?? s.listings?.[0];
    return {
      symbolId: s.id,
      canonicalTicker: s.canonical_ticker,
      name: s.name,
      type: s.type,
      sector: s.sector,
      industry: s.industry,
      country: s.country,
      primaryListingId: primary?.id ?? null,
      primaryExchangeCode: primary?.exchanges?.code ?? null,
      primaryLocalTicker: primary?.local_ticker ?? null,
    };
  });

  return rankSymbols(query, mapped).slice(0, limit);
}

export async function getSymbol(symbolId: string): Promise<SymbolDetail | null> {
  const { data, error } = await supabase
    .from('symbols')
    .select('*')
    .eq('id', symbolId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    canonicalTicker: data.canonical_ticker,
    name: data.name,
    isin: data.isin,
    figi: data.figi,
    type: data.type,
    sector: data.sector,
    industry: data.industry,
    gicsSector: data.gics_sector,
    gicsIndustryGroup: data.gics_industry_group,
    gicsIndustry: data.gics_industry,
    gicsSubIndustry: data.gics_sub_industry,
    country: data.country,
    currency: data.currency,
    createdAt: data.created_at,
  };
}
