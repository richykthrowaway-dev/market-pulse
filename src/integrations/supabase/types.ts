export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      balance_sheets: {
        Row: {
          cash_and_equivalents: number | null
          created_at: string
          currency: string
          fiscal_quarter: number | null
          fiscal_year: number
          id: string
          long_term_debt: number | null
          period: string
          reported_at: string | null
          short_term_debt: number | null
          symbol_id: string
          total_assets: number | null
          total_equity: number | null
          total_liabilities: number | null
        }
        Insert: {
          cash_and_equivalents?: number | null
          created_at?: string
          currency: string
          fiscal_quarter?: number | null
          fiscal_year: number
          id?: string
          long_term_debt?: number | null
          period: string
          reported_at?: string | null
          short_term_debt?: number | null
          symbol_id: string
          total_assets?: number | null
          total_equity?: number | null
          total_liabilities?: number | null
        }
        Update: {
          cash_and_equivalents?: number | null
          created_at?: string
          currency?: string
          fiscal_quarter?: number | null
          fiscal_year?: number
          id?: string
          long_term_debt?: number | null
          period?: string
          reported_at?: string | null
          short_term_debt?: number | null
          symbol_id?: string
          total_assets?: number | null
          total_equity?: number | null
          total_liabilities?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "balance_sheets_symbol_id_fkey"
            columns: ["symbol_id"]
            isOneToOne: false
            referencedRelation: "symbols"
            referencedColumns: ["id"]
          },
        ]
      }
      benchmark_bars: {
        Row: {
          benchmark_id: string
          close: number
          created_at: string
          high: number
          id: string
          low: number
          open: number
          source: string | null
          timeframe_id: string
          ts: string
          volume: number | null
        }
        Insert: {
          benchmark_id: string
          close: number
          created_at?: string
          high: number
          id?: string
          low: number
          open: number
          source?: string | null
          timeframe_id: string
          ts: string
          volume?: number | null
        }
        Update: {
          benchmark_id?: string
          close?: number
          created_at?: string
          high?: number
          id?: string
          low?: number
          open?: number
          source?: string | null
          timeframe_id?: string
          ts?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "benchmark_bars_benchmark_id_fkey"
            columns: ["benchmark_id"]
            isOneToOne: false
            referencedRelation: "benchmarks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benchmark_bars_timeframe_id_fkey"
            columns: ["timeframe_id"]
            isOneToOne: false
            referencedRelation: "timeframes"
            referencedColumns: ["id"]
          },
        ]
      }
      benchmarks: {
        Row: {
          code: string
          created_at: string
          currency: string
          id: string
          name: string
          symbol_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency: string
          id?: string
          name: string
          symbol_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          id?: string
          name?: string
          symbol_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "benchmarks_symbol_id_fkey"
            columns: ["symbol_id"]
            isOneToOne: false
            referencedRelation: "symbols"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_flow_statements: {
        Row: {
          created_at: string
          currency: string
          financing_cf: number | null
          fiscal_quarter: number | null
          fiscal_year: number
          free_cash_flow: number | null
          id: string
          investing_cf: number | null
          operating_cf: number | null
          period: string
          reported_at: string | null
          symbol_id: string
        }
        Insert: {
          created_at?: string
          currency: string
          financing_cf?: number | null
          fiscal_quarter?: number | null
          fiscal_year: number
          free_cash_flow?: number | null
          id?: string
          investing_cf?: number | null
          operating_cf?: number | null
          period: string
          reported_at?: string | null
          symbol_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          financing_cf?: number | null
          fiscal_quarter?: number | null
          fiscal_year?: number
          free_cash_flow?: number | null
          id?: string
          investing_cf?: number | null
          operating_cf?: number | null
          period?: string
          reported_at?: string | null
          symbol_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_flow_statements_symbol_id_fkey"
            columns: ["symbol_id"]
            isOneToOne: false
            referencedRelation: "symbols"
            referencedColumns: ["id"]
          },
        ]
      }
      corporate_actions: {
        Row: {
          action_type: string
          cash_dividend: number | null
          created_at: string
          dividend_currency: string | null
          effective_date: string
          id: string
          listing_id: string
          notes: string | null
          split_ratio: number | null
        }
        Insert: {
          action_type: string
          cash_dividend?: number | null
          created_at?: string
          dividend_currency?: string | null
          effective_date: string
          id?: string
          listing_id: string
          notes?: string | null
          split_ratio?: number | null
        }
        Update: {
          action_type?: string
          cash_dividend?: number | null
          created_at?: string
          dividend_currency?: string | null
          effective_date?: string
          id?: string
          listing_id?: string
          notes?: string | null
          split_ratio?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "corporate_actions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      currency_pairs: {
        Row: {
          change: number
          change_percent: number
          from_currency: string
          id: string
          last_updated: string
          rate: number
          symbol: string
          to_currency: string
        }
        Insert: {
          change?: number
          change_percent?: number
          from_currency: string
          id?: string
          last_updated?: string
          rate?: number
          symbol: string
          to_currency: string
        }
        Update: {
          change?: number
          change_percent?: number
          from_currency?: string
          id?: string
          last_updated?: string
          rate?: number
          symbol?: string
          to_currency?: string
        }
        Relationships: []
      }
      exchanges: {
        Row: {
          close_time: string
          code: string
          country: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          mic: string | null
          name: string
          open_time: string
          timezone: string
          updated_at: string
        }
        Insert: {
          close_time: string
          code: string
          country: string
          created_at?: string
          currency: string
          id?: string
          is_active?: boolean
          mic?: string | null
          name: string
          open_time: string
          timezone: string
          updated_at?: string
        }
        Update: {
          close_time?: string
          code?: string
          country?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          mic?: string | null
          name?: string
          open_time?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      income_statements: {
        Row: {
          created_at: string
          currency: string
          ebitda: number | null
          eps_basic: number | null
          eps_diluted: number | null
          fiscal_quarter: number | null
          fiscal_year: number
          gross_profit: number | null
          id: string
          net_income: number | null
          operating_income: number | null
          period: string
          reported_at: string | null
          revenue: number | null
          shares_basic: number | null
          shares_diluted: number | null
          symbol_id: string
        }
        Insert: {
          created_at?: string
          currency: string
          ebitda?: number | null
          eps_basic?: number | null
          eps_diluted?: number | null
          fiscal_quarter?: number | null
          fiscal_year: number
          gross_profit?: number | null
          id?: string
          net_income?: number | null
          operating_income?: number | null
          period: string
          reported_at?: string | null
          revenue?: number | null
          shares_basic?: number | null
          shares_diluted?: number | null
          symbol_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          ebitda?: number | null
          eps_basic?: number | null
          eps_diluted?: number | null
          fiscal_quarter?: number | null
          fiscal_year?: number
          gross_profit?: number | null
          id?: string
          net_income?: number | null
          operating_income?: number | null
          period?: string
          reported_at?: string | null
          revenue?: number | null
          shares_basic?: number | null
          shares_diluted?: number | null
          symbol_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_statements_symbol_id_fkey"
            columns: ["symbol_id"]
            isOneToOne: false
            referencedRelation: "symbols"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          created_at: string
          currency: string
          exchange_id: string
          id: string
          is_active: boolean
          listing_type: string
          local_ticker: string
          primary_listing: boolean
          symbol_id: string
        }
        Insert: {
          created_at?: string
          currency: string
          exchange_id: string
          id?: string
          is_active?: boolean
          listing_type?: string
          local_ticker: string
          primary_listing?: boolean
          symbol_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          exchange_id?: string
          id?: string
          is_active?: boolean
          listing_type?: string
          local_ticker?: string
          primary_listing?: boolean
          symbol_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_exchange_id_fkey"
            columns: ["exchange_id"]
            isOneToOne: false
            referencedRelation: "exchanges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_symbol_id_fkey"
            columns: ["symbol_id"]
            isOneToOne: false
            referencedRelation: "symbols"
            referencedColumns: ["id"]
          },
        ]
      }
      market_indices: {
        Row: {
          change: number
          change_percent: number
          id: string
          last_updated: string
          name: string
          region: string
          symbol: string
          value: number
        }
        Insert: {
          change?: number
          change_percent?: number
          id?: string
          last_updated?: string
          name: string
          region: string
          symbol: string
          value?: number
        }
        Update: {
          change?: number
          change_percent?: number
          id?: string
          last_updated?: string
          name?: string
          region?: string
          symbol?: string
          value?: number
        }
        Relationships: []
      }
      news: {
        Row: {
          id: string
          image_url: string | null
          published_at: string
          related_symbols: string[] | null
          source: string
          summary: string
          title: string
          url: string
        }
        Insert: {
          id?: string
          image_url?: string | null
          published_at?: string
          related_symbols?: string[] | null
          source: string
          summary: string
          title: string
          url?: string
        }
        Update: {
          id?: string
          image_url?: string | null
          published_at?: string
          related_symbols?: string[] | null
          source?: string
          summary?: string
          title?: string
          url?: string
        }
        Relationships: []
      }
      ohlcv_bars: {
        Row: {
          close: number
          created_at: string
          high: number
          id: string
          listing_id: string
          low: number
          open: number
          source: string | null
          timeframe_id: string
          trades: number | null
          ts: string
          volume: number
          vwap: number | null
        }
        Insert: {
          close: number
          created_at?: string
          high: number
          id?: string
          listing_id: string
          low: number
          open: number
          source?: string | null
          timeframe_id: string
          trades?: number | null
          ts: string
          volume?: number
          vwap?: number | null
        }
        Update: {
          close?: number
          created_at?: string
          high?: number
          id?: string
          listing_id?: string
          low?: number
          open?: number
          source?: string | null
          timeframe_id?: string
          trades?: number | null
          ts?: string
          volume?: number
          vwap?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ohlcv_bars_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ohlcv_bars_timeframe_id_fkey"
            columns: ["timeframe_id"]
            isOneToOne: false
            referencedRelation: "timeframes"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_holdings: {
        Row: {
          avg_cost_basis: number
          created_at: string
          id: string
          listing_id: string
          notes: string | null
          purchase_date: string
          shares: number
          user_id: string
        }
        Insert: {
          avg_cost_basis: number
          created_at?: string
          id?: string
          listing_id: string
          notes?: string | null
          purchase_date: string
          shares: number
          user_id: string
        }
        Update: {
          avg_cost_basis?: number
          created_at?: string
          id?: string
          listing_id?: string
          notes?: string | null
          purchase_date?: string
          shares?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_holdings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      stocks: {
        Row: {
          change: number
          change_percent: number
          id: string
          last_updated: string
          market_cap: number
          name: string
          price: number
          symbol: string
          volume: number
        }
        Insert: {
          change?: number
          change_percent?: number
          id?: string
          last_updated?: string
          market_cap?: number
          name: string
          price?: number
          symbol: string
          volume?: number
        }
        Update: {
          change?: number
          change_percent?: number
          id?: string
          last_updated?: string
          market_cap?: number
          name?: string
          price?: number
          symbol?: string
          volume?: number
        }
        Relationships: []
      }
      symbols: {
        Row: {
          canonical_ticker: string
          country: string | null
          created_at: string
          currency: string | null
          figi: string | null
          gics_industry: string | null
          gics_industry_group: string | null
          gics_sector: string | null
          gics_sub_industry: string | null
          id: string
          industry: string | null
          isin: string | null
          name: string
          sector: string | null
          type: string
          updated_at: string
        }
        Insert: {
          canonical_ticker: string
          country?: string | null
          created_at?: string
          currency?: string | null
          figi?: string | null
          gics_industry?: string | null
          gics_industry_group?: string | null
          gics_sector?: string | null
          gics_sub_industry?: string | null
          id?: string
          industry?: string | null
          isin?: string | null
          name: string
          sector?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          canonical_ticker?: string
          country?: string | null
          created_at?: string
          currency?: string | null
          figi?: string | null
          gics_industry?: string | null
          gics_industry_group?: string | null
          gics_sector?: string | null
          gics_sub_industry?: string | null
          id?: string
          industry?: string | null
          isin?: string | null
          name?: string
          sector?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      timeframes: {
        Row: {
          bar_seconds: number
          code: string
          created_at: string
          description: string
          id: string
        }
        Insert: {
          bar_seconds: number
          code: string
          created_at?: string
          description: string
          id?: string
        }
        Update: {
          bar_seconds?: number
          code?: string
          created_at?: string
          description?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
