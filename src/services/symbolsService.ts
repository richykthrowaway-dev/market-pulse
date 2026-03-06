import { supabase } from '@/integrations/supabase/client';

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

  const { data, error } = await supabase
    .from('symbols')
    .select(`
      id, canonical_ticker, name, type, sector, industry, country,
      listings!inner ( id, local_ticker, primary_listing, exchange_id,
        exchanges ( code )
      )
    `)
    .or(`canonical_ticker.ilike.${pattern},name.ilike.${pattern}`)
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((s: any) => {
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
