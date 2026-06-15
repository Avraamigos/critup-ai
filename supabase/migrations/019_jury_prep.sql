-- ── Jury Prep ─────────────────────────────────────────────────────────────────
-- Replaces the old voice-practice feature. Two parts:
--   1. jury_qa — project-specific questions + suggested answers, generated FOR
--      FREE inside the existing analysis call (bundled into api/analyze.ts output,
--      no second AI charge). Stored on the analysis row.
--   2. jury_scripts — a heavier, Pro-only presentation script generated on demand
--      by api/jury-script.ts (re-reads the full PDF + stored feedback). Cached per
--      (analysis, language_level) so re-opening / switching levels never re-charges.

-- 1. Bundled Q&A column. Array of { question, answer }. Defaults to empty so old
--    rows and the validation code never see null.
alter table public.analyses
  add column if not exists jury_qa jsonb not null default '[]'::jsonb;

-- 2. Cached presentation scripts. One row per (analysis, language_level); the
--    language_level is the register toggle (Simple / Natural / Academic). The
--    actual language follows the user's profile language, same as the critique.
create table if not exists public.jury_scripts (
  id              uuid primary key default gen_random_uuid(),
  analysis_id     uuid not null references public.analyses(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  language_level  text not null
                    check (language_level in ('simple','natural','academic')),
  slides          jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (analysis_id, language_level)
);

create index if not exists jury_scripts_analysis_idx
  on public.jury_scripts(analysis_id);

alter table public.jury_scripts enable row level security;

-- The page reads its own cached scripts directly from the client. Writes happen
-- only through the service-role endpoint (which bypasses RLS), so no insert/update
-- policy is granted to end users.
drop policy if exists "jury_scripts: own read" on public.jury_scripts;
create policy "jury_scripts: own read" on public.jury_scripts
  for select using (auth.uid() = user_id);

grant select on public.jury_scripts to authenticated;

-- 3. Regeneration rate-limit log. A cache hit returns the stored script and does
--    NOT insert here; only a real Claude call logs an event. Counting rows in a
--    rolling window caps how often a Pro user can force a fresh generation.
--    Touched exclusively by the service-role endpoint, so RLS stays closed.
create table if not exists public.jury_script_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists jury_script_events_user_idx
  on public.jury_script_events(user_id, created_at);

alter table public.jury_script_events enable row level security;

-- ── Remove the old voice-practice feature ─────────────────────────────────────
-- jury_sessions backed the deleted voice-coaching flow. Nothing reads it anymore.
drop table if exists public.jury_sessions cascade;
