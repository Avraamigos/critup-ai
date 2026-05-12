-- Add course brief/outline text to projects
-- Students paste their department brief so Crit can evaluate drawings against requirements.

alter table public.projects
  add column if not exists brief_text text;

-- No RLS changes needed — projects table already has user-scoped RLS policies.
