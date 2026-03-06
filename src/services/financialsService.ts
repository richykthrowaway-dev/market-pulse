import { supabase } from '@/integrations/supabase/client';

type Period = 'annual' | 'quarterly';

export async function getIncomeStatements(symbolId: string, period: Period) {
  const { data, error } = await supabase
    .from('income_statements')
    .select('*')
    .eq('symbol_id', symbolId)
    .eq('period', period)
    .order('fiscal_year', { ascending: false })
    .order('fiscal_quarter', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getBalanceSheets(symbolId: string, period: Period) {
  const { data, error } = await supabase
    .from('balance_sheets')
    .select('*')
    .eq('symbol_id', symbolId)
    .eq('period', period)
    .order('fiscal_year', { ascending: false })
    .order('fiscal_quarter', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getCashFlows(symbolId: string, period: Period) {
  const { data, error } = await supabase
    .from('cash_flow_statements')
    .select('*')
    .eq('symbol_id', symbolId)
    .eq('period', period)
    .order('fiscal_year', { ascending: false })
    .order('fiscal_quarter', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
