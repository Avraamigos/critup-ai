-- ── Per-call AI usage / cost tracking ─────────────────────────────────────────
-- Every Claude / ElevenLabs call logs one row: who, which feature, which model,
-- tokens, and the dollar cost. Powers the admin Expenses tab with REAL spend
-- (until now costs were only printed to Vercel logs) and per-user totals.
--
-- Writes come exclusively from API routes using the service-role key.
-- Clients can neither read nor write: RLS is enabled with NO policies.

create table if not exists public.usage_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,                       -- who triggered the call (nullable: system)
  feature       text not null,              -- 'analysis' | 'chat' | 'jury_script' | 'jury_shorten' | 'tts'
  model         text,                       -- 'claude-sonnet-4-6' | 'claude-haiku-4-5' | 'elevenlabs'
  input_tokens  integer,
  output_tokens integer,
  chars         integer,                    -- for TTS (character-billed)
  cost_usd      numeric(10, 6) not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.usage_events enable row level security;
-- No policies on purpose: deny-all to anon/authenticated; service role bypasses.

create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);
create index if not exists usage_events_created_idx
  on public.usage_events (created_at desc);
