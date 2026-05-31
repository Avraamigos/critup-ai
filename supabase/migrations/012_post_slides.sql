-- ── Pre-rendered post slides ─────────────────────────────────────────────────
-- For a fast, Instagram-style feed we render each PDF page to a compressed JPEG
-- once, at post time, and serve those static images from a PUBLIC bucket. The
-- feed then loads plain CDN-cached <img>s instead of fetching + rendering a
-- multi-MB PDF in the browser.

-- Public bucket for the rendered slide images.
insert into storage.buckets (id, name, public)
values ('post-slides', 'post-slides', true)
on conflict (id) do update set public = true;

-- Number of rendered slides for an analysis (0 = none yet → fall back to live PDF).
alter table public.analyses
  add column if not exists slide_count integer not null default 0;

-- Slides live at  post-slides/{analysisId}/{i}.jpg
-- Public read is automatic for a public bucket. Writes are restricted to the
-- owner of the analysis the folder is named after.
drop policy if exists "post-slides: owner write" on storage.objects;
create policy "post-slides: owner write" on storage.objects
  for insert with check (
    bucket_id = 'post-slides'
    and exists (
      select 1 from public.analyses a
      where a.id::text = (storage.foldername(name))[1]
        and a.user_id = auth.uid()
    )
  );

drop policy if exists "post-slides: owner update" on storage.objects;
create policy "post-slides: owner update" on storage.objects
  for update using (
    bucket_id = 'post-slides'
    and exists (
      select 1 from public.analyses a
      where a.id::text = (storage.foldername(name))[1]
        and a.user_id = auth.uid()
    )
  );

drop policy if exists "post-slides: owner delete" on storage.objects;
create policy "post-slides: owner delete" on storage.objects
  for delete using (
    bucket_id = 'post-slides'
    and exists (
      select 1 from public.analyses a
      where a.id::text = (storage.foldername(name))[1]
        and a.user_id = auth.uid()
    )
  );
