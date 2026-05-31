-- ── Discipline field on projects ─────────────────────────────────────────────
-- Allows students to tag their project as Architecture, Interior Design, or
-- Urban Design. Used to power the discipline tabs in the Community feed.
-- Nullable so existing projects aren't broken.

alter table public.projects
  add column if not exists discipline text
    check (discipline in ('architecture', 'interior', 'urban'));

create index if not exists projects_discipline_idx on public.projects(discipline)
  where discipline is not null;
