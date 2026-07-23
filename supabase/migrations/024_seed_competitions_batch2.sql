-- ── Seed competitions — batch 2 ──────────────────────────────────────────────
-- Four more 2026 programs (Streetlife, IDA, IDMP, BLT). Same rules as 023:
-- each insert is guarded by `where not exists (... title)` so re-running is safe,
-- and unverified fields are NULL rather than guessed. The auto-expire pg_cron job
-- from 023 already covers these — no cron changes here.
--
-- Two honesty calls worth knowing:
--   • IDMP (#15) and BLT (#16) have UNSURE student eligibility. student_eligible
--     is NOT NULL, and defaulting to true would falsely tag them student-friendly,
--     so they go in as FALSE. Flip to true from the admin page once confirmed.
--   • IDMP (#15) had no organizer URL supplied → NULL.

-- 13. Streetlife / Landezine — Streetlife Design Competition ("Lost Sites")
insert into public.competitions
  (title, image_url, summary, brief_text, discipline, deadline, registration_deadline, prize, entry_fee, student_eligible, level, team_required, location, organizer_url)
select
  $$Streetlife Design Competition — Lost Sites$$,
  null,
  $$Now in its third edition, this competition asks students and young professionals to select a neglected or abandoned open space of their own choosing and propose a redesign. The "lost sites" framing covers spaces damaged by poor planning, car dominance, disinvestment, or conflict, and the brief pushes toward sustainability, biodiversity, and community empowerment rather than beautification.$$,
  $$Teams identify their own "lost site" — a forgotten, neglected, or degraded piece of open public space no larger than roughly one hectare — and develop a full redesign proposal for it. Site selection is itself part of the task and is assessed: entrants must argue why the space matters and what has gone wrong with it. Proposals are expected to address climate resilience, urban biodiversity, inclusivity, and the empowerment of the local community, and to demonstrate an understanding of how people would actually use the space day to day. The jury has previously included landscape architects from Karres en Brands, BIG Landscape, and Andropogon, and evaluates the quality of the site analysis, the ambition and coherence of the spatial proposal, ecological and social thinking, and presentation. Submission is a single A3 landscape PDF, maximum 10 pages, minimum 12pt body text, under 100MB. There is also a separate University Prize for departments submitting three or more curricular student projects, which makes this a good one to pitch to faculty.$$,
  'landscape', date '2026-12-11', date '2026-09-30',
  $$€15,000 total prize fund, plus University Prize$$,
  null,
  true, 'student', true,
  $$Free to choose (site selected by entrant)$$,
  $$https://streetlifedesigncompetition.com/$$
where not exists (select 1 from public.competitions where title = $$Streetlife Design Competition — Lost Sites$$);

-- 14. Farmani Group — International Design Awards (IDA) 2026
insert into public.competitions
  (title, image_url, summary, brief_text, discipline, deadline, registration_deadline, prize, entry_fee, student_eligible, level, team_required, location, organizer_url)
select
  $$International Design Awards (IDA) 2026$$,
  null,
  $$The IDA is a long-running international awards program covering architecture, interior, product, graphic, and fashion design, now in its 20th edition. It runs a separate Student category at a substantially reduced fee, and accepts conceptual and in-progress work rather than only built projects — which makes it unusually accessible for coursework.$$,
  $$Entrants submit completed, in-progress, or purely conceptual work from the past five years into one of several discipline categories, including Architecture & Spaces and Interior Design. Because IDA accepts conceptual and unbuilt submissions, studio projects and thesis work are eligible, and the Student category is judged separately from Professional so students are not competing against practices. There is no single design brief; instead, an international jury assesses each entry on design quality, innovation, functionality, and the strength of the concept within its own category. Winners receive a trophy and certificate plus inclusion in IDA's publicity and annual publication.$$,
  'multi', date '2026-10-15', null,
  $$Trophy, certificate, and international publication/press exposure (no cash prize listed)$$,
  $$€80 student first entry, €60 each additional (Professional €250/€200)$$,
  true, 'any', false,
  $$International (no site)$$,
  $$https://idesignawards.com/$$
where not exists (select 1 from public.competitions where title = $$International Design Awards (IDA) 2026$$);

-- 15. AMP — Interior Design MasterPrize (IDMP) 2026
insert into public.competitions
  (title, image_url, summary, brief_text, discipline, deadline, registration_deadline, prize, entry_fee, student_eligible, level, team_required, location, organizer_url)
select
  $$Interior Design MasterPrize 2026$$,
  null,
  $$IDMP is an interior-specific international awards program run by AMP, open to both established firms and emerging designers across a wide range of interior typologies. It is one of the few interior-focused programs with a submission window still open this year.$$,
  $$Entrants submit interior design projects across residential, hospitality, commercial, cultural, and other typologies. There is no set brief or site; a jury evaluates each project on spatial quality, concept, material and detail resolution, and how well the interior serves its users. Winners are recognized in AMP's annual book, promoted through international design media, and included in global press releases.$$,
  'interior', date '2026-08-31', null,
  $$Recognition in AMP annual book, international media exposure, press campaign$$,
  null,
  false, 'any', false,
  $$International (no site)$$,
  null
where not exists (select 1 from public.competitions where title = $$Interior Design MasterPrize 2026$$);

-- 16. BLT Built Design Awards 2026 — Landscape Architecture category
insert into public.competitions
  (title, image_url, summary, brief_text, discipline, deadline, registration_deadline, prize, entry_fee, student_eligible, level, team_required, location, organizer_url)
select
  $$BLT Built Design Awards 2026 — Landscape Architecture$$,
  null,
  $$BLT runs a broad built-environment awards program with a dedicated Landscape Architecture category alongside architecture, interior, and product. The program explicitly charges no additional fees to winners, which is worth noting since some awards programs monetize the win itself.$$,
  $$Entrants submit landscape architecture projects into the relevant sub-category and are judged by an international jury on design quality, concept, execution, and contextual response. There is no single brief. The program closes October 4, 2026, with a late fee applying from September 6. Winner benefits — trophy, certificate, publication, promotion — are provided at no further cost beyond the entry fee.$$,
  'landscape', date '2026-10-04', null,
  $$Trophy, certificate, publication and promotion (no further fees to winners)$$,
  null,
  false, 'any', false,
  $$International (no site)$$,
  $$https://bltawards.com/landscape-architecture-award/$$
where not exists (select 1 from public.competitions where title = $$BLT Built Design Awards 2026 — Landscape Architecture$$);
