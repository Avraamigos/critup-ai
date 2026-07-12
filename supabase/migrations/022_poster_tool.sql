-- ── Poster / title-slide tool (first entry in the Tools section) ─────────────
-- History + monthly credit accounting for AI-generated presentation posters.
-- Cost per generation is also logged to usage_events (P4); this table stores
-- the artefact + status so the UI can show history and enforce the cap.

create table if not exists public.poster_generations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  analysis_id   uuid,                       -- set when generated from a project
  format        text not null default 'vertical',   -- 'vertical' | 'horizontal'
  template      text,                       -- vibe preset id
  status        text not null default 'processing', -- 'processing'|'complete'|'failed'
  output_path   text,                       -- storage path in the 'posters' bucket
  error_message text,
  cost_usd      numeric(10, 6) not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.poster_generations enable row level security;

-- Owners may read their own poster history. Writes happen only via the
-- service-role key in the API (no insert/update/delete policies = denied to clients).
drop policy if exists "poster_generations: own read" on public.poster_generations;
create policy "poster_generations: own read" on public.poster_generations
  for select using (auth.uid() = user_id);

create index if not exists poster_generations_user_created_idx
  on public.poster_generations (user_id, created_at desc);

-- Private bucket for poster inputs + outputs. Outputs are served to owners via
-- short-lived signed URLs minted server-side (same pattern as project-pdfs).
insert into storage.buckets (id, name, public)
values ('posters', 'posters', false)
on conflict (id) do nothing;

-- A user may upload poster inputs only into their OWN folder: posters/{uid}/...
-- Generated outputs are written by the service role (bypasses RLS).
drop policy if exists "posters: own upload" on storage.objects;
create policy "posters: own upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'posters'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "posters: own read" on storage.objects;
create policy "posters: own read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'posters'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
