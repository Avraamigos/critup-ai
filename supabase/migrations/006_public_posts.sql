-- ── Public post sharing ──────────────────────────────────────────────────────
-- Adds is_public flag to analyses so students can share a link to their results.
-- The existing RLS policy already allows owners full access.
-- We add a separate SELECT policy for unauthenticated / other-user reads
-- when the analysis has been explicitly made public by its owner.

alter table public.analyses
  add column if not exists is_public boolean not null default false;

-- Allow anyone (including anon) to read analyses that the owner made public.
-- The existing "analyses: own all" policy already covers authenticated owners.
drop policy if exists "analyses: public read" on public.analyses;
create policy "analyses: public read" on public.analyses
  for select using (is_public = true);

-- Index so the public feed query is fast when we build it later
create index if not exists analyses_is_public_idx on public.analyses(is_public)
  where is_public = true;
