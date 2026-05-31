-- ── Community post social features: likes & comments ─────────────────────────
-- Both tables reference public.profiles(id) (not auth.users) so PostgREST can
-- embed the author's name/avatar in feed and post queries.

-- Likes ──────────────────────────────────────────────────────────────────────
create table if not exists public.post_likes (
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (analysis_id, user_id)
);

create index if not exists post_likes_analysis_idx on public.post_likes(analysis_id);

alter table public.post_likes enable row level security;

-- Anyone may read likes for an analysis that is public.
drop policy if exists "post_likes: public read" on public.post_likes;
create policy "post_likes: public read" on public.post_likes
  for select using (
    exists (select 1 from public.analyses a
            where a.id = post_likes.analysis_id and a.is_public = true)
  );

-- A user may like/unlike on their own behalf, only on public analyses.
drop policy if exists "post_likes: own insert" on public.post_likes;
create policy "post_likes: own insert" on public.post_likes
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.analyses a
                where a.id = post_likes.analysis_id and a.is_public = true)
  );

drop policy if exists "post_likes: own delete" on public.post_likes;
create policy "post_likes: own delete" on public.post_likes
  for delete using (auth.uid() = user_id);

-- Comments ───────────────────────────────────────────────────────────────────
create table if not exists public.post_comments (
  id          uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now()
);

create index if not exists post_comments_analysis_idx
  on public.post_comments(analysis_id, created_at);

alter table public.post_comments enable row level security;

drop policy if exists "post_comments: public read" on public.post_comments;
create policy "post_comments: public read" on public.post_comments
  for select using (
    exists (select 1 from public.analyses a
            where a.id = post_comments.analysis_id and a.is_public = true)
  );

drop policy if exists "post_comments: own insert" on public.post_comments;
create policy "post_comments: own insert" on public.post_comments
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.analyses a
                where a.id = post_comments.analysis_id and a.is_public = true)
  );

drop policy if exists "post_comments: own delete" on public.post_comments;
create policy "post_comments: own delete" on public.post_comments
  for delete using (auth.uid() = user_id);
