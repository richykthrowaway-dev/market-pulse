import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { snaptradeFetch, corsHeaders, getCallerUserId } from "../_shared/snaptrade.ts";

/**
 * api-snaptrade-connect
 *
 * Generates a SnapTrade Connection Portal redirect URL for the calling
 * user. The frontend opens this URL (popup or iframe) so the user can
 * authenticate with their brokerage. SnapTrade calls back to our webhook
 * once the connection is established.
 *
 * Response: { redirectURI, sessionId }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const userId = await getCallerUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up the user's SnapTrade secret (must be registered first).
    const { data: stUser, error: lookupError } = await supa
      .from("snaptrade_users")
      .select("user_secret")
      .eq("user_id", userId)
      .maybeSingle();

    if (lookupError) {
      return json({ error: "lookup failed", detail: lookupError.message }, 500);
    }
    if (!stUser) {
      return json({ error: "user not registered with SnapTrade — call api-snaptrade-register first" }, 400);
    }

    // POST /snapTrade/login   query: userId + userSecret
    // body: optional broker filter, redirect URL, etc.
    const url = new URL(req.url);
    const broker      = url.searchParams.get("broker")      ?? undefined;
    const connectionType = url.searchParams.get("connectionType") ?? undefined; // 'read' or 'trade'

    const result = (await snaptradeFetch(
      "POST",
      "/snapTrade/login",
      { userId, userSecret: stUser.user_secret },
      {
        broker,
        connectionType: connectionType ?? "read",
        // immediateRedirect: true,
      },
    )) as { redirectURI?: string; sessionId?: string };

    return json(result);
  } catch (err) {
    console.error("api-snaptrade-connect error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
