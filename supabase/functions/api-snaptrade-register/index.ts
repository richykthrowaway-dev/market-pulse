import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { snaptradeFetch, corsHeaders, getCallerUserId } from "../_shared/snaptrade.ts";

/**
 * api-snaptrade-register
 *
 * Registers the calling Supabase user with SnapTrade (idempotent: returns
 * the existing row if already registered). Stores the returned userSecret
 * in `snaptrade_users` so subsequent endpoints can sign requests on the
 * user's behalf.
 *
 * Response: { userId, alreadyRegistered }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const userId = await getCallerUserId(req);
    if (!userId) {
      return json({ error: "not authenticated" }, 401);
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotency: if we already have a user_secret on file, return it.
    const { data: existing } = await supa
      .from("snaptrade_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      return json({ userId, alreadyRegistered: true });
    }

    // POST /snapTrade/registerUser   body: { userId }
    const result = (await snaptradeFetch(
      "POST",
      "/snapTrade/registerUser",
      {},
      { userId },
    )) as { userId: string; userSecret: string };

    if (!result?.userSecret) {
      return json({ error: "SnapTrade returned no userSecret", detail: result }, 502);
    }

    const { error } = await supa.from("snaptrade_users").insert({
      user_id:     userId,
      user_secret: result.userSecret,
    });
    if (error) {
      return json({ error: "failed to persist userSecret", detail: error.message }, 500);
    }

    return json({ userId, alreadyRegistered: false });
  } catch (err) {
    console.error("api-snaptrade-register error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
