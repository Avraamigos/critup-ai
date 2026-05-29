-- ============================================================
-- Critup.ai — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Enums ──────────────────────────────────────────────────
create type project_stage as enum (
  'pre-design',
  'initial-concept',
  'finalized-design',
  'jury-prep'
);

create type analysis_status as enum (
  'pending',
  'processing',
  'complete',
  'failed'
);

create type user_plan as enum (
  'free',
  'monthly',
  'yearly'
);

-- ─── Profiles ───────────────────────────────────────────────
-- Extends Supabase auth.users (1:1)
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  plan          user_plan not null default 'free',
  language      text not null default 'en',
  analyses_used integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Projects ───────────────────────────────────────────────
create table public.projects (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  stage         project_stage not null default 'initial-concept',
  focus_areas   text[] not null default '{}',
  brief_text    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index projects_user_id_idx on public.projects(user_id);

-- ─── Analyses ───────────────────────────────────────────────
create table public.analyses (
  id                  uuid primary key default uuid_generate_v4(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  status              analysis_status not null default 'pending',
  concept_score       numeric(3,1) check (concept_score between 0 and 10),
  spatial_score       numeric(3,1) check (spatial_score between 0 and 10),
  presentation_score  numeric(3,1) check (presentation_score between 0 and 10),
  feedback            jsonb,   -- array of { id, title, description, page, x, y, severity }
  jury_questions      jsonb,   -- array of { id, question, category, difficulty }
  pdf_path            text,    -- Supabase Storage path
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index analyses_project_id_idx on public.analyses(project_id);
create index analyses_user_id_idx on public.analyses(user_id);

-- ─── Jury Sessions ──────────────────────────────────────────
create table public.jury_sessions (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  project_id        uuid references public.projects(id) on delete set null,
  question          text not null,
  answer            text,
  clarity_score     integer check (clarity_score between 0 and 10),
  confidence_score  integer check (confidence_score between 0 and 10),
  content_score     integer check (content_score between 0 and 10),
  ai_feedback       text,
  duration_seconds  integer,
  created_at        timestamptz not null default now()
);

create index jury_sessions_user_id_idx on public.jury_sessions(user_id);

-- ─── Helper Function ────────────────────────────────────────
create or replace function public.increment_analyses_used(uid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles
  set analyses_used = analyses_used + 1,
      updated_at = now()
  where id = uid;
end;
$$;

-- ─── Updated_at Trigger ─────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_projects_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();

create trigger set_analyses_updated_at
  before update on public.analyses
  for each row execute procedure public.set_updated_at();

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ─── Row Level Security ─────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.analyses enable row level security;
alter table public.jury_sessions enable row level security;

-- Profiles: users can only read/update their own
create policy "profiles: own read" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: own update" on public.profiles
  for update using (auth.uid() = id);

-- Projects: full CRUD on own projects
create policy "projects: own all" on public.projects
  for all using (auth.uid() = user_id);

-- Analyses: full CRUD on own analyses
create policy "analyses: own all" on public.analyses
  for all using (auth.uid() = user_id);

-- Jury sessions: full CRUD on own sessions
create policy "jury_sessions: own all" on public.jury_sessions
  for all using (auth.uid() = user_id);

-- ─── Storage ────────────────────────────────────────────────
-- Run separately in Supabase Storage UI or via API:
-- 1. Create bucket: "project-pdfs" (private)
-- 2. Add policy: users can upload/read their own files
--    Path format: {user_id}/{project_id}/{filename}

insert into storage.buckets (id, name, public) values ('project-pdfs', 'project-pdfs', false);

create policy "storage: own upload" on storage.objects
  for insert with check (
    bucket_id = 'project-pdfs' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage: own read" on storage.objects
  for select using (
    bucket_id = 'project-pdfs' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage: own delete" on storage.objects
  for delete using (
    bucket_id = 'project-pdfs' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
