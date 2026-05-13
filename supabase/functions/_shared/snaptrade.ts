// Shared SnapTrade request signer for Supabase edge functions.
//
// SnapTrade requires every request to be signed with HMAC-SHA256 using
// your consumerKey. The signature is computed over a JSON blob of
// {content, path, query} and passed in the `Signature` header alongside
// `clientId` and `timestamp` query params.
//
// Refs:
//   https://docs.snaptrade.com/reference/getting-started
//   https://github.com/passiv/snaptrade-sdks (TypeScript SDK source)

const SNAPTRADE_BASE = "https://api.snaptrade.com/api/v1";
const SNAPTRADE_PATH_PREFIX = "/api/v1"; // MUST be prefixed onto the signed path

function getEnv(): { clientId: string; consumerKey: string } {
  const clientId    = Deno.env.get("SNAPTRADE_CLIENT_ID");
  const consumerKey = Deno.env.get("SNAPTRADE_CONSUMER_KEY");
  if (!clientId || !consumerKey) {
    throw new Error(
      "SnapTrade env vars missing: set SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY in Supabase project settings.",
    );
  }
  return { clientId, consumerKey };
}

/**
 * Stringify a value with all object keys sorted alphabetically at every
 * nesting level. Mirrors the SDK's JSONstringifyOrder.
 */
function stringifyDeepSorted(value: unknown): string {
  const allKeys = new Set<string>();
  JSON.stringify(value, (k, v) => {
    allKeys.add(k);
    return v;
  });
  return JSON.stringify(value, [...allKeys].sort());
}

async function hmacSha256Base64(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  // base64 encode
  const bytes = new Uint8Array(sig);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Make a signed request to SnapTrade.
 *
 * @param method   "GET" | "POST" | "DELETE"
 * @param path     e.g. "/snapTrade/registerUser"
 * @param query    extra query params (clientId + timestamp added automatically)
 * @param body     JSON body for POST/PUT; null for GET/DELETE
 */
export async function snaptradeFetch(
  method: "GET" | "POST" | "DELETE",
  path: string,
  query: Record<string, string> = {},
  body: unknown = null,
): Promise<unknown> {
  const { clientId, consumerKey } = getEnv();

  const fullQuery: Record<string, string> = {
    ...query,
    clientId,
    timestamp: Math.floor(Date.now() / 1000).toString(),
  };

  // Build query string in stable insertion order (SnapTrade signs the
  // exact string we send).
  const qs = new URLSearchParams(fullQuery).toString();

  // Signature payload format (matches the official passiv SDK):
  //   - path includes the `/api/v1` prefix
  //   - keys at every nesting level are sorted alphabetically
  //   - JSON has no whitespace separators
  //   - HMAC key is the URI-encoded consumerKey
  const sigPayload = stringifyDeepSorted({
    content: body,
    path:    `${SNAPTRADE_PATH_PREFIX}${path}`,
    query:   qs,
  });

  const signature = await hmacSha256Base64(encodeURI(consumerKey), sigPayload);

  const url = `${SNAPTRADE_BASE}${path}?${qs}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept":       "application/json",
    "Signature":    signature,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    throw new Error(
      `SnapTrade ${method} ${path} → ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`,
    );
  }
  return data;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/**
 * Verify the calling user's JWT via the Supabase Auth API and return
 * their auth.users.id. Returns null if the token is missing, expired,
 * or forged.
 *
 * IMPORTANT: do NOT parse the JWT payload without verification — the
 * function gateway verifies by default, but if a deploy ever forgets
 * `--no-verify-jwt`-off semantics, base64-decode would let an attacker
 * forge a JWT with another user's `sub` claim and steal their data.
 * The Auth API call is the only safe way.
 *
 * Also rejects anonymous Supabase users for SnapTrade endpoints —
 * anonymous accounts are unauthenticated and would let drive-by traffic
 * exhaust the free-tier connection slots.
 */
export async function getCallerUserId(
  req: Request,
  opts: { allowAnonymous?: boolean } = {},
): Promise<{ userId: string; isAnonymous: boolean } | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const jwt = auth.slice("Bearer ".length);

  const supaUrl     = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supaUrl || !serviceRole) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for JWT verify");
    return null;
  }

  // Use the auth user endpoint to verify cryptographically — this
  // checks signature + expiry against the project's JWT secret.
  const res = await fetch(`${supaUrl}/auth/v1/user`, {
    headers: {
      apikey:        serviceRole,
      Authorization: `Bearer ${jwt}`,
    },
  });
  if (!res.ok) return null;

  const user = (await res.json()) as { id?: string; is_anonymous?: boolean };
  if (!user.id) return null;

  const isAnonymous = !!user.is_anonymous;
  if (isAnonymous && !opts.allowAnonymous) return null;

  return { userId: user.id, isAnonymous };
}
