import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

/**
 * SnapTrade integration hooks.
 *
 * Auth: every call to a SnapTrade edge function passes the user's JWT so
 * the function can scope state to the calling Supabase user. The JWT
 * comes from supabase.auth.getSession() — we don't cache it because
 * Supabase already handles refresh.
 */

async function getAuthHeaders(): Promise<Record<string, string>> {
  // Ensure we have a Supabase session — sign in anonymously if needed so
  // SnapTrade works for users who haven't created an account.
  let { data } = await supabase.auth.getSession()
  if (!data.session) {
    const { error } = await supabase.auth.signInAnonymously()
    if (error) {
      throw new Error(
        `auth setup failed: ${error.message}. ` +
        `Enable anonymous sign-ins in Supabase → Authentication → Providers.`,
      )
    }
    ;({ data } = await supabase.auth.getSession())
  }
  const token = data.session?.access_token
  if (!token) throw new Error('no session token after sign-in')
  const anon = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)?.trim()
  return {
    Authorization: `Bearer ${token}`,
    apikey: anon,
    'Content-Type': 'application/json',
  }
}

function functionUrl(name: string): string {
  const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string)?.trim()
  return `https://${projectId}.supabase.co/functions/v1/${name}`
}

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface SnapTradeAccount {
  account_id: string
  account_name: string | null
  account_type: string | null
  institution_name: string | null
  currency: string | null
  total_value: number | null
  cash_balance: number | null
  last_synced_at: string | null
}

export interface SnapTradeHolding {
  account_id: string
  symbol: string
  description: string | null
  quantity: number
  avg_purchase_price: number | null
  current_price: number | null
  market_value: number | null
  open_pnl: number | null
  currency: string | null
}

export interface SnapTradeConnection {
  authorization_id: string
  brokerage_name: string | null
  disabled: boolean
  last_synced_at: string | null
}

// ─────────────────────────────────────────────────────────────────────
// Queries — read from Supabase tables (RLS scopes to caller)
// ─────────────────────────────────────────────────────────────────────

export function useSnapTradeAccounts() {
  return useQuery({
    queryKey: ['snaptrade', 'accounts'],
    queryFn: async (): Promise<SnapTradeAccount[]> => {
      const { data, error } = await supabase
        .from('snaptrade_accounts')
        .select('*')
        .order('total_value', { ascending: false, nullsFirst: false })
      if (error) throw error
      return (data ?? []) as SnapTradeAccount[]
    },
  })
}

export function useSnapTradeHoldings() {
  return useQuery({
    queryKey: ['snaptrade', 'holdings'],
    queryFn: async (): Promise<SnapTradeHolding[]> => {
      const { data, error } = await supabase
        .from('snaptrade_holdings')
        .select('*')
        .order('market_value', { ascending: false, nullsFirst: false })
      if (error) throw error
      return (data ?? []) as SnapTradeHolding[]
    },
  })
}

export function useSnapTradeConnections() {
  return useQuery({
    queryKey: ['snaptrade', 'connections'],
    queryFn: async (): Promise<SnapTradeConnection[]> => {
      const { data, error } = await supabase
        .from('snaptrade_connections')
        .select('*')
      if (error) throw error
      return (data ?? []) as SnapTradeConnection[]
    },
  })
}

// ─────────────────────────────────────────────────────────────────────
// Mutations — call edge functions
// ─────────────────────────────────────────────────────────────────────

/**
 * One-step "Connect Brokerage" flow:
 *   1. Ensure the Supabase user is registered with SnapTrade
 *   2. Get a Connection Portal URL
 *   3. Open it in a popup; resolve when the popup closes
 *   4. Trigger a sync to pull the new holdings
 */
export function useConnectBrokerage() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (opts?: { broker?: string }) => {
      const headers = await getAuthHeaders()

      // 1. Register (idempotent)
      const regRes = await fetch(functionUrl('api-snaptrade-register'), {
        method: 'POST',
        headers,
      })
      if (!regRes.ok) {
        throw new Error(`register failed: ${await regRes.text()}`)
      }

      // 2. Generate connection portal URL
      const connectUrl = new URL(functionUrl('api-snaptrade-connect'))
      if (opts?.broker) connectUrl.searchParams.set('broker', opts.broker)
      const connRes = await fetch(connectUrl.toString(), {
        method: 'POST',
        headers,
      })
      if (!connRes.ok) {
        throw new Error(`connect failed: ${await connRes.text()}`)
      }
      const { redirectURI } = (await connRes.json()) as { redirectURI?: string }
      if (!redirectURI) throw new Error('SnapTrade returned no redirectURI')

      // 3. Open the portal in a popup and wait for it to close
      const popup = window.open(
        redirectURI,
        'snaptrade-connect',
        'width=520,height=720,menubar=no,toolbar=no',
      )
      if (!popup) throw new Error('popup blocked — allow popups for this site')

      await new Promise<void>((resolve) => {
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer)
            resolve()
          }
        }, 500)
      })

      // 4. Sync — pulls accounts + holdings into our tables
      const syncRes = await fetch(functionUrl('api-snaptrade-sync'), {
        method: 'POST',
        headers,
      })
      if (!syncRes.ok) {
        throw new Error(`sync failed: ${await syncRes.text()}`)
      }
      return (await syncRes.json()) as {
        accounts: number
        holdings: number
        connections: number
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['snaptrade'] })
    },
  })
}

/** Manual re-sync trigger (the "Refresh" button). */
export function useSnapTradeSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const headers = await getAuthHeaders()
      const res = await fetch(functionUrl('api-snaptrade-sync'), {
        method: 'POST',
        headers,
      })
      if (!res.ok) throw new Error(`sync failed: ${await res.text()}`)
      return (await res.json()) as {
        accounts: number
        holdings: number
        connections: number
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['snaptrade'] })
    },
  })
}
