import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { snaptradeFetch, corsHeaders, getCallerUserId } from "../_shared/snaptrade.ts";

/**
 * api-snaptrade-sync
 *
 * Pulls all holdings for the calling user across every connected brokerage
 * account and upserts the canonical snapshot into
 *   - snaptrade_connections
 *   - snaptrade_accounts
 *   - snaptrade_holdings
 *
 * Strategy: call /accounts (list accounts) + /accounts/{id}/holdings per
 * account. SnapTrade also offers /holdings (aggregate) but per-account
 * gives us cleaner account metadata in the same payload.
 *
 * Response: { accounts: N, holdings: M }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const caller = await getCallerUserId(req);
    if (!caller) return json({ error: "not authenticated — anonymous users cannot sync" }, 401);
    const userId = caller.userId;

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: stUser } = await supa
      .from("snaptrade_users")
      .select("user_secret")
      .eq("user_id", userId)
      .maybeSingle();

    if (!stUser) return json({ error: "user not registered with SnapTrade" }, 400);

    // 1. List brokerage authorizations (connections)
    type Authorization = {
      id: string;
      brokerage?: { name?: string; slug?: string };
      disabled?: boolean;
    };
    const auths = (await snaptradeFetch(
      "GET",
      "/authorizations",
      { userId, userSecret: stUser.user_secret },
    )) as Authorization[];

    for (const a of auths ?? []) {
      await supa.from("snaptrade_connections").upsert({
        user_id:          userId,
        authorization_id: a.id,
        brokerage_name:   a.brokerage?.name ?? null,
        brokerage_slug:   a.brokerage?.slug ?? null,
        disabled:         !!a.disabled,
        last_synced_at:   new Date().toISOString(),
      }, { onConflict: "user_id,authorization_id" });
    }

    // 2. List accounts
    type Account = {
      id: string;
      number?: string;
      name?: string;
      meta?: { type?: string };
      institution_name?: string;
      balance?: { total?: { amount?: number; currency?: string }; cash?: number };
    };
    const accounts = (await snaptradeFetch(
      "GET",
      "/accounts",
      { userId, userSecret: stUser.user_secret },
    )) as Account[];

    let holdingsCount = 0;

    for (const acc of accounts ?? []) {
      await supa.from("snaptrade_accounts").upsert({
        user_id:               userId,
        account_id:            acc.id,
        account_number_masked: acc.number ?? null,
        account_name:          acc.name ?? null,
        account_type:          acc.meta?.type ?? null,
        institution_name:      acc.institution_name ?? null,
        currency:              acc.balance?.total?.currency ?? null,
        total_value:           acc.balance?.total?.amount ?? null,
        cash_balance:          acc.balance?.cash ?? null,
        last_synced_at:        new Date().toISOString(),
      }, { onConflict: "user_id,account_id" });

      // 3. Holdings for this account
      type Holding = {
        symbol?: { symbol?: { symbol?: string; description?: string }; description?: string };
        units?: number;
        price?: number;
        average_purchase_price?: number;
        open_pnl?: number;
        currency?: { code?: string };
      };

      // SnapTrade: GET /accounts/{accountId}/positions
      const positions = (await snaptradeFetch(
        "GET",
        `/accounts/${acc.id}/positions`,
        { userId, userSecret: stUser.user_secret },
      )) as Holding[];

      // Replace snapshot for this account (delete + insert)
      await supa
        .from("snaptrade_holdings")
        .delete()
        .eq("user_id", userId)
        .eq("account_id", acc.id);

      const rows = (positions ?? []).map((p) => {
        const ticker = p.symbol?.symbol?.symbol ?? "";
        const qty    = p.units ?? 0;
        const price  = p.price ?? 0;
        return {
          user_id:            userId,
          account_id:         acc.id,
          symbol:             ticker,
          description:        p.symbol?.symbol?.description ?? p.symbol?.description ?? null,
          quantity:           qty,
          avg_purchase_price: p.average_purchase_price ?? null,
          current_price:      price,
          market_value:       qty * price,
          open_pnl:           p.open_pnl ?? null,
          currency:           p.currency?.code ?? null,
          asset_type:         null,
          synced_at:          new Date().toISOString(),
        };
      }).filter((r) => r.symbol);

      if (rows.length > 0) {
        const { error } = await supa.from("snaptrade_holdings").insert(rows);
        if (error) console.error(`insert holdings for ${acc.id} failed:`, error.message);
        else holdingsCount += rows.length;
      }
    }

    return json({
      accounts: accounts?.length ?? 0,
      holdings: holdingsCount,
      connections: auths?.length ?? 0,
    });
  } catch (err) {
    console.error("api-snaptrade-sync error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
