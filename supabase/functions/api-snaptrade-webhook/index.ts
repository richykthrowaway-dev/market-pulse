import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * api-snaptrade-webhook
 *
 * Receives push notifications from SnapTrade when account state changes.
 * Configure this URL in the SnapTrade dashboard under "Webhooks".
 *
 * Event types we care about (per SnapTrade docs):
 *   - USER_REGISTERED                     (acknowledgement; ignore)
 *   - CONNECTION_ADDED                    → trigger sync
 *   - CONNECTION_DELETED                  → mark disabled
 *   - CONNECTION_BROKEN / FIXED           → flag UI
 *   - ACCOUNT_HOLDINGS_UPDATED            → trigger sync
 *   - ACCOUNT_TRANSACTIONS_UPDATED        → (future) refresh trades
 *
 * For simplicity this skeleton just logs and stores the event. Once the
 * sync function is verified end-to-end we can fan-out to it from here.
 *
 * Security: SnapTrade signs webhook payloads with a shared secret that
 * you configure when registering the webhook. We validate it via the
 * `webhookSecret` query param + HMAC header comparison. For Phase 1 we
 * accept all events and log loudly — Phase 2 hardens the verification.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json() as {
      eventType?: string;
      userId?: string;
      brokerageAuthorizationId?: string;
      accountId?: string;
      eventTimestamp?: string;
      [key: string]: unknown;
    };

    console.log("[snaptrade-webhook] event:", body.eventType, body);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Lookup the Supabase user_id by SnapTrade's userId
    // (SnapTrade's userId === our auth.users.id since we set it that way
    // in api-snaptrade-register).
    const supabaseUserId = body.userId ?? null;

    switch (body.eventType) {
      case "USER_REGISTERED":
        // Acknowledgement only — no-op
        break;

      case "CONNECTION_ADDED":
      case "ACCOUNT_HOLDINGS_UPDATED":
        // TODO: fire-and-forget call to api-snaptrade-sync for this user.
        // For Phase 1 we just log; the user can also trigger a manual sync
        // from the UI.
        console.log(`[snaptrade-webhook] would re-sync user=${supabaseUserId}`);
        break;

      case "CONNECTION_DELETED":
      case "CONNECTION_BROKEN":
        if (supabaseUserId && body.brokerageAuthorizationId) {
          await supa
            .from("snaptrade_connections")
            .update({ disabled: true })
            .eq("user_id", supabaseUserId)
            .eq("authorization_id", body.brokerageAuthorizationId);
        }
        break;

      case "CONNECTION_FIXED":
        if (supabaseUserId && body.brokerageAuthorizationId) {
          await supa
            .from("snaptrade_connections")
            .update({ disabled: false })
            .eq("user_id", supabaseUserId)
            .eq("authorization_id", body.brokerageAuthorizationId);
        }
        break;

      default:
        console.log("[snaptrade-webhook] unhandled event:", body.eventType);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("api-snaptrade-webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
