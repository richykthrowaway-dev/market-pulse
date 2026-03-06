import { supabase } from '@/integrations/supabase/client';

export interface HoldingRow {
  id: string;
  listingId: string;
  localTicker: string;
  exchangeCode: string;
  symbolName: string;
  currency: string;
  shares: number;
  avgCostBasis: number;
  purchaseDate: string;
  notes: string | null;
}

export async function getHoldings(userId: string): Promise<HoldingRow[]> {
  const { data, error } = await supabase
    .from('portfolio_holdings')
    .select(`
      id, listing_id, shares, avg_cost_basis, purchase_date, notes,
      listings (
        local_ticker, currency,
        exchanges ( code ),
        symbols ( name )
      )
    `)
    .eq('user_id', userId);

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    id: r.id,
    listingId: r.listing_id,
    localTicker: r.listings?.local_ticker ?? '',
    exchangeCode: r.listings?.exchanges?.code ?? '',
    symbolName: r.listings?.symbols?.name ?? '',
    currency: r.listings?.currency ?? '',
    shares: Number(r.shares),
    avgCostBasis: Number(r.avg_cost_basis),
    purchaseDate: r.purchase_date,
    notes: r.notes,
  }));
}

interface UpsertHoldingParams {
  userId: string;
  listingId: string;
  shares: number;
  avgCostBasis: number;
  purchaseDate: string;
  notes?: string | null;
}

export async function upsertHolding(params: UpsertHoldingParams) {
  const { data, error } = await supabase
    .from('portfolio_holdings')
    .upsert(
      {
        user_id: params.userId,
        listing_id: params.listingId,
        shares: params.shares,
        avg_cost_basis: params.avgCostBasis,
        purchase_date: params.purchaseDate,
        notes: params.notes ?? null,
      },
      { onConflict: 'user_id,listing_id,purchase_date' }
    )
    .select('id')
    .single();

  if (error) throw error;
  return data;
}
