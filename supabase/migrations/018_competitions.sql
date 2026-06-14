-- ── Competitions directory ───────────────────────────────────────────────────
-- A manually curated directory of design competitions for students. No AI, no
-- scraping — admin-populated only. Public read is limited to active comps; all
-- writes go through the service-role admin endpoint (api/admin-competitions.ts).

create table if not exists public.competitions (
  id                     uuid primary key default gen_random_uuid(),
  title                  text not null,
  image_url              text,
  summary                text,
  brief_text             text,
  discipline             text not null
                           check (discipline in ('architecture','interior','urban','landscape','multi')),
  deadline               date not null,
  registration_deadline  date,
  prize                  text,
  entry_fee              text,
  student_eligible       boolean not null default true,
  level                  text not null default 'any'
                           check (level in ('beginner','student','professional','any')),
  team_required          boolean not null default false,
  location               text,
  organizer_url          text,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now()
);

-- Default sort is deadline-soonest-first among active comps; discipline is the
-- primary filter — index both.
create index if not exists competitions_deadline_idx
  on public.competitions(deadline) where is_active;
create index if not exists competitions_discipline_idx
  on public.competitions(discipline);

alter table public.competitions enable row level security;

-- Public (anon + authenticated) may read only active competitions. The admin
-- management list needs inactive ones too, but it is fetched via the
-- service-role endpoint which bypasses RLS.
drop policy if exists "competitions: public read active" on public.competitions;
create policy "competitions: public read active" on public.competitions
  for select using (is_active = true);

grant select on public.competitions to anon, authenticated;

-- ── Saved competitions ────────────────────────────────────────────────────────
-- Logged-in students can bookmark competitions. Own-rows-only, same pattern as
-- post_likes.
create table if not exists public.saved_competitions (
  user_id        uuid not null references auth.users(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (user_id, competition_id)
);

create index if not exists saved_competitions_user_idx
  on public.saved_competitions(user_id);

alter table public.saved_competitions enable row level security;

drop policy if exists "saved_competitions: own read" on public.saved_competitions;
create policy "saved_competitions: own read" on public.saved_competitions
  for select using (auth.uid() = user_id);

drop policy if exists "saved_competitions: own insert" on public.saved_competitions;
create policy "saved_competitions: own insert" on public.saved_competitions
  for insert with check (auth.uid() = user_id);

drop policy if exists "saved_competitions: own delete" on public.saved_competitions;
create policy "saved_competitions: own delete" on public.saved_competitions
  for delete using (auth.uid() = user_id);

grant select, insert, delete on public.saved_competitions to authenticated;
