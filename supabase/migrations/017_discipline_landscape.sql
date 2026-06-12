-- ── Add 'landscape' to the projects.discipline check constraint ───────────────
-- Landscape Architecture is now a discipline option in onboarding and a tab in
-- the Community feed. The original constraint (007_discipline.sql) only allowed
-- architecture / interior / urban, so landscape projects were silently stored as
-- NULL and never matched the feed filter. Widen the allowed set.

alter table public.projects
  drop constraint if exists projects_discipline_check;

alter table public.projects
  add constraint projects_discipline_check
    check (discipline in ('architecture', 'interior', 'urban', 'landscape'));
