-- ── Public read access to PDFs of public analyses ────────────────────────────
-- The project-pdfs bucket is PRIVATE. Migration 006 made the analysis ROW
-- publicly readable, but the PDF file itself stayed locked down, so the
-- community feed/post pages could not render the slides.
--
-- This policy lets anyone read a storage object in project-pdfs *only* when
-- some analysis that points at that exact path has been made public by its
-- owner. Owners keep full access through the existing authenticated policies.

drop policy if exists "project-pdfs public read" on storage.objects;
create policy "project-pdfs public read" on storage.objects
  for select using (
    bucket_id = 'project-pdfs'
    and exists (
      select 1 from public.analyses a
      where a.pdf_path = storage.objects.name
        and a.is_public = true
    )
  );
