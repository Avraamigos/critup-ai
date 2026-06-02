-- ── Denormalize public display fields ────────────────────────────────────────
-- The community feed and shared /p/ post pages are viewed by people who are NOT
-- the post's owner. But `profiles` and `projects` both have owner-only RLS
-- (auth.uid() = id / user_id), so a visitor cannot read the author's name or the
-- project's name/stage/discipline. The result: every post showed "Anonymous"
-- with an "Untitled" project, and discipline tabs filtered out real posts.
--
-- Fix, the privacy-preserving way: copy ONLY the public-facing display fields
-- onto the rows that are already public-readable (analyses, post_comments).
-- Visitors never read another user's profile/project row. Sensitive profile
-- fields (email, university, year, challenges) stay private.

-- 1. Display fields on analyses (public feed + post pages) ─────────────────────
alter table public.analyses
  add column if not exists owner_name         text,
  add column if not exists project_name       text,
  add column if not exists project_stage      text,
  add column if not exists project_discipline text;

-- 2. Author name on comments (public comment thread) ──────────────────────────
alter table public.post_comments
  add column if not exists author_name text;

-- 3. Backfill existing rows ───────────────────────────────────────────────────
update public.analyses a set
  project_name       = pr.name,
  project_stage      = pr.stage::text,
  project_discipline = pr.discipline
from public.projects pr
where a.project_id = pr.id;

update public.analyses a set
  owner_name = p.full_name
from public.profiles p
where a.user_id = p.id;

update public.post_comments c set
  author_name = p.full_name
from public.profiles p
where c.user_id = p.id;
