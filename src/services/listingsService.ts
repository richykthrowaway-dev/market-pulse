import { supabase } from '@/integrations/supabase/client';

export interface ListingDetail {
  listingId: string;
  localTicker: string;
  currency: string;
  primaryListing: boolean;
  listingType: string;
  isActive: boolean;
  exchangeId: string;
  exchangeCode: string;
  exchangeName: string;
  symbolId: string;
  canonicalTicker: string;
  symbolName: string;
}

function mapListing(row: any): ListingDetail {
  return {
    listingId: row.id,
    localTicker: row.local_ticker,
    currency: row.currency,
    primaryListing: row.primary_listing,
    listingType: row.listing_type,
    isActive: row.is_active,
    exchangeId: row.exchange_id,
    exchangeCode: row.exchanges?.code ?? '',
    exchangeName: row.exchanges?.name ?? '',
    symbolId: row.symbol_id,
    canonicalTicker: row.symbols?.canonical_ticker ?? '',
    symbolName: row.symbols?.name ?? '',
  };
}

const LISTING_SELECT = `
  id, local_ticker, currency, primary_listing, listing_type, is_active,
  exchange_id, symbol_id,
  exchanges ( code, name ),
  symbols ( canonical_ticker, name )
`;

export async function findListing(
  ticker: string,
  exchangeCode: string
): Promise<ListingDetail | null> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('local_ticker', ticker)
    .eq('exchanges.code', exchangeCode)
    .maybeSingle();

  if (error) throw error;
  return data ? mapListing(data) : null;
}

export async function getListingsForSymbol(
  symbolId: string
): Promise<ListingDetail[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('symbol_id', symbolId);

  if (error) throw error;
  return (data ?? []).map(mapListing);
}

export async function getPrimaryListingForSymbol(
  symbolId: string
): Promise<ListingDetail | null> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('symbol_id', symbolId)
    .eq('primary_listing', true)
    .maybeSingle();

  if (error) throw error;
  return data ? mapListing(data) : null;
}
