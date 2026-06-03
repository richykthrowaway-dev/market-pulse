# Deployment

MarketPulse deploys in two automated tracks on every push to `main`:

| Track | What | How |
|---|---|---|
| **Frontend** | React/Vite app | Vercel (auto, already wired) |
| **Backend** | DB migrations + edge functions | GitHub Actions → `.github/workflows/supabase-deploy.yml` |

No manual dashboard clicking for routine changes. Add a migration or edit a
function, push, and it ships.

---

## One-time setup

These run **once per project**, not per deploy.

### 1. GitHub secret: `SUPABASE_ACCESS_TOKEN`

The CI workflow needs one secret to authenticate the Supabase CLI.

1. Generate a personal access token: https://supabase.com/dashboard/account/tokens
2. In GitHub: repo **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `SUPABASE_ACCESS_TOKEN`
   - Value: the token from step 1
3. Done. The workflow reads it automatically; the token never appears in code or logs.

The project ref (`fzokumkbgvwsyftwwprx`) is **not** secret and is set as an env
var directly in the workflow file.

### 2. Edge function secrets

Edge functions read API keys from Supabase-managed secrets (not git). Set these
once in **Dashboard → Project Settings → Edge Functions → Secrets**, or via CLI:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# EODHD_API_KEY and FINNHUB_API_KEY already exist from earlier features
```

`ANTHROPIC_API_KEY` is **new** and required for the daily-brief AI prose. Without
it the brief still generates (data-only, no narrative).

### 3. Vault secrets for the pg_cron job

The `generate-daily-brief` cron job (migration `20260520130000_daily_brief_cron.sql`)
calls the edge function and needs the project URL + service-role key. These live
in **Supabase Vault**, never in git. Create them once in the SQL editor:

```sql
select vault.create_secret(
  'https://fzokumkbgvwsyftwwprx.supabase.co', 'project_url',
  'Base URL for edge-function calls from pg_cron');

select vault.create_secret(
  '<service-role-key>', 'service_role_key',
  'Service role key for pg_cron → edge function auth');
```

Find the service-role key in **Dashboard → Project Settings → API → service_role**.

If these are absent, the cron job logs a notice and skips — applying the
migration never breaks a fresh environment.

---

## How it works after setup

```
git push to main
   ├─→ Vercel        → builds + deploys frontend
   └─→ GitHub Action → supabase db push          (applies new migrations)
                     → supabase functions deploy  (deploys all edge functions)
```

- **New migration?** Drop a `.sql` file in `supabase/migrations/`, push. Applied automatically.
- **Edge function change?** Edit under `supabase/functions/`, push. Deployed automatically.
- **New scheduled job?** Add it as a migration (see the cron migration for the
  Vault pattern), push. Scheduled automatically — no dashboard step.

Re-runs are safe: `db push` skips migrations already in the remote history, and
`functions deploy` overwrites with the repo version.

---

## Bootstrapping a fresh environment

To stand up a new Supabase project (staging, a second region, etc.):

1. Create the project, note its ref.
2. Set `SUPABASE_ACCESS_TOKEN` (GitHub) + edge-function secrets + Vault secrets (steps 1–3 above).
3. Point the workflow's `SUPABASE_PROJECT_REF` env at the new ref (or parameterize per branch).
4. Push. Every migration replays in order; every function deploys. The schema,
   RLS policies, and cron schedule all reproduce automatically — no manual clicks.

This is the scalability guarantee: the entire backend is reproducible from
versioned files in the repo.
