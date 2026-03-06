import { supabase } from '@/integrations/supabase/client';

export interface LatestFundamentals {
  incomeStatement: Record<string, any> | null;
  balanceSheet: Record<string, any> | null;
  cashFlow: Record<string, any> | null;
}

export async function getLatestFundamentals(
  symbolId: string
): Promise<LatestFundamentals> {
  const [incomeRes, balanceRes, cashRes] = await Promise.all([
    supabase
      .from('income_statements')
      .select('*')
      .eq('symbol_id', symbolId)
      .eq('period', 'annual')
      .order('fiscal_year', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('balance_sheets')
      .select('*')
      .eq('symbol_id', symbolId)
      .eq('period', 'annual')
      .order('fiscal_year', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('cash_flow_statements')
      .select('*')
      .eq('symbol_id', symbolId)
      .eq('period', 'annual')
      .order('fiscal_year', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (incomeRes.error) throw incomeRes.error;
  if (balanceRes.error) throw balanceRes.error;
  if (cashRes.error) throw cashRes.error;

  return {
    incomeStatement: incomeRes.data,
    balanceSheet: balanceRes.data,
    cashFlow: cashRes.data,
  };
}
