-- ── Seed competitions + automatic expiry ─────────────────────────────────────
-- Part 1: insert a curated batch of 2026 competitions (Buildner + Terraviva).
--   Each insert is guarded by `where not exists (... title)` so re-running this
--   migration will NOT create duplicates.
--   Fields that could not be verified at curation time are left NULL on purpose
--   (image_url, some entry_fee, some organizer_url slugs). A NULL entry_fee is
--   never shown as "Free" by the app, and a NULL image falls back to a
--   placeholder — so blanks are safe. Fill them in later from the admin page.
-- Part 2: a daily pg_cron job that hard-deletes competitions whose deadline has
--   passed (deadline < today). Deletes cascade to saved_competitions bookmarks.

-- ─────────────────────────────── Part 1: seed ────────────────────────────────

-- 5. Buildner — Unbuilt Award 2026
insert into public.competitions
  (title, image_url, summary, brief_text, discipline, deadline, registration_deadline, prize, entry_fee, student_eligible, level, team_required, location, organizer_url)
select
  $$Buildner Unbuilt Award 2026$$,
  $$https://storage.architecturecompetitions.com/upload/05.11.2025/3c8a93f0c590b18fcf60cab75f083d3f.jpg$$,
  $$The Unbuilt Award celebrates architectural designs that were never built, inviting participants to submit conceptual, speculative, or shelved projects across three scale categories — small, medium, and large. Now in its third edition, the competition treats unrealized work as valuable architectural discourse in its own right, not as a consolation prize.$$,
  $$Participants may submit any unbuilt architectural project — conceptual, unpublished, previously published, or fully developed but never constructed — in one of three scale categories: small, medium, or large. There is no required site, program, or style; the competition is explicitly unconstrained and rewards bold imaginative thinking over feasibility. The jury evaluates entries on the strength of the architectural concept, clarity of design intent, innovation, and the quality of presentation. Each scale category has one winner, five honorable mentions, and a dedicated student winner; there is also a special award for best presentation. Winners receive a chapter in the annual Unbuilt Book and the Continuum Trophy designed by Germans Ermičs. Entries are anonymous and can be submitted individually or as teams.$$,
  'architecture', date '2026-10-20', date '2026-09-23',
  $$€100,000 total (across 3 scale categories; 1 winner + 5 HMs + 1 student winner per category, plus best presentation award)$$,
  null,
  true, 'any', false,
  $$No fixed site (conceptual, any scale)$$,
  $$https://architecturecompetitions.com/unbuilt2026/$$
where not exists (select 1 from public.competitions where title = $$Buildner Unbuilt Award 2026$$);

-- 6. Terraviva — Nidos de Agua (La Albufera Pavilion)
insert into public.competitions
  (title, image_url, summary, brief_text, discipline, deadline, registration_deadline, prize, entry_fee, student_eligible, level, team_required, location, organizer_url)
select
  $$Nidos de Agua — La Albufera Pavilion Competition$$,
  null,
  $$This competition challenges participants to design a small-scale pavilion set within the wetland landscape of La Albufera Natural Park near Valencia, Spain. The brief is intentionally open — the structure can host contemplation, environmental education, birdwatching, rest, or seasonal events — but must establish a meaningful spatial dialogue with the water, reeds, and horizon of the site.$$,
  $$Participants choose any specific location within La Albufera Natural Park and propose a micro-architecture pavilion that enhances the visitor experience without disrupting the ecological balance of the wetland. The program is left open, allowing entrants to define what activity or experience the pavilion supports, from passive observation to environmental education to seasonal gatherings. The structure may float, elevate above marshland, nestle into rice fields, or settle along the shoreline, but its relationship to water, vegetation, and the wider landscape must be clearly resolved. Submission consists of one A1 horizontal panel with a brief descriptive text. The jury will evaluate designs on the quality of the spatial dialogue with the surroundings, originality of the program concept, sensitivity to the ecology of the site, and architectural clarity at micro-scale.$$,
  'landscape', date '2026-09-11', date '2026-09-11',
  $$€8,000 total (1st €3,000, 2nd €2,000, 3rd €1,000, plus 5 Golden Mentions and 10 Honorable Mentions as coupons)$$,
  $$€129 (late registration, +VAT; earlier tiers from €69)$$,
  true, 'any', false,
  $$La Albufera Natural Park, Valencia, Spain$$,
  $$https://www.terravivacompetitions.com/nidos-de-agua-competition-2026/$$
where not exists (select 1 from public.competitions where title = $$Nidos de Agua — La Albufera Pavilion Competition$$);

-- 7. Terraviva — Tactical Urbanism NOW! 2026
insert into public.competitions
  (title, image_url, summary, brief_text, discipline, deadline, registration_deadline, prize, entry_fee, student_eligible, level, team_required, location, organizer_url)
select
  $$Tactical Urbanism NOW! 2026$$,
  null,
  $$Tactical Urbanism NOW! asks designers to propose temporary, low-cost interventions that can transform overlooked, contested, or underused public spaces in real cities. The focus is on prototypical thinking — designs that generate immediate impact while pointing toward longer-term urban transformation.$$,
  $$Participants are free to select any urban site they choose — from overheated plazas and traffic-dominated streets to residual plots and fragmented public corridors — and propose a tactical intervention that responds directly to local conditions. Designs should use adaptable systems, low-cost or found materials, and participatory logic wherever possible, demonstrating how small-scale moves can unlock major change. The competition explicitly frames entries as prototypes rather than fixed solutions: projects should be testable, transferable, and grounded in real urban life rather than purely aesthetic. The jury evaluates proposals on the clarity of the urban diagnosis, the ingenuity and replicability of the tactical response, sensitivity to community and context, and overall spatial impact. Submission requires one A1 horizontal panel and a descriptive text. Entries may address climate stress, space equity, mobility, or community resilience — any genuine urban challenge will be considered.$$,
  'urban', date '2026-10-30', date '2026-10-30',
  $p$$10,000 total (prize breakdown on organizer website; plus mention coupons)$p$,
  null,
  true, 'any', false,
  $$Free to choose (any urban site worldwide)$$,
  $$https://www.terravivacompetitions.com/tactical-urbanism-competition-2026/$$
where not exists (select 1 from public.competitions where title = $$Tactical Urbanism NOW! 2026$$);

-- 8. Terraviva — The Students Apartment
insert into public.competitions
  (title, image_url, summary, brief_text, discipline, deadline, registration_deadline, prize, entry_fee, student_eligible, level, team_required, location, organizer_url)
select
  $$The Students Apartment$$,
  null,
  $$Terraviva invites designers to reimagine a long-unused two-bedroom apartment on the sixth floor of a building in Pavia's historic centre as a home for two or three university students. The brief centres on how students actually live now — fluidly moving between study, rest, socialising, and shared domestic routine — and asks for a layout that balances privacy against collective life.$$,
  $$Participants redesign the interior of a real, specific apartment: a traditional two-bedroom unit in the historic core of Pavia, sixth floor, with panoramic views over the city. The proposal must accommodate two or three students and rethink the internal layout entirely rather than simply refurbishing it. Entrants are expected to develop multifunctional furniture systems, adaptable partitions, intelligent storage strategies, and dynamic spatial configurations that let the same square metres serve different purposes across the day. The jury — including members from SOM, Román y Basualto, Two Dots Design, and Heather Young Architects — will assess how convincingly the design balances individual comfort and privacy against shared social space, the intelligence and buildability of the flexible systems proposed, and the quality of the presentation. This is a strong fit for interior-focused students since the scope is genuinely interior rather than a building-scale gesture.$$,
  'interior', date '2026-11-06', date '2026-11-06',
  $$€8,000 total (plus Golden Mentions, Honorable Mentions, and 30 finalists published)$$,
  $$€99 (standard, through Oct 16); €139 late (Oct 16 – Nov 6)$$,
  true, 'any', false,
  $$Pavia, Italy$$,
  $$https://www.terravivacompetitions.com/the-students-apartment-competition-2026/$$
where not exists (select 1 from public.competitions where title = $$The Students Apartment$$);

-- 9. Terraviva — The Civic Kiosk
insert into public.competitions
  (title, image_url, summary, brief_text, discipline, deadline, registration_deadline, prize, entry_fee, student_eligible, level, team_required, location, organizer_url)
select
  $$The Civic Kiosk$$,
  null,
  $$This competition asks participants to reinvent the traditional newsstand — a familiar piece of street furniture whose original purpose has been eroded by digital media. Entrants choose any site worldwide and propose what a kiosk should become now: a cultural venue, a neighbourhood gathering point, a café, or something entirely unexpected.$$,
  $$Participants select an urban site anywhere in the world and redesign the newsstand typology, addressing both its program and its physical form. The brief has two halves: entrants must define a new function or set of services that gives the kiosk renewed civic purpose, and they must design the object itself — exploring new forms, materials, spatial configurations, and architectural identity rather than restyling the existing type. Because the kiosk sits at the threshold between private enterprise and public space, proposals are expected to articulate how the structure relates to the street, its users, and the surrounding urban life. The jury, drawn from AMDL Circle, HKS Architects, Jayson Architecture, and RS2 Architetti, evaluates the originality of the reinvented program, the strength of the architectural identity, the quality of the relationship with public space, and presentation clarity. Deliverables are one horizontal A1 panel plus a 250–500 word text.$$,
  'architecture', date '2026-12-04', date '2026-12-04',
  $p$$8,000 total (1st $3,000, 2nd $2,000, 3rd $1,000, plus 5 Golden Mentions, 10 Honorable Mentions, 30 published finalists)$p$,
  $$€99 (standard from Sept 4); €69 early tier closed Sept 4 — verify current tier at registration$$,
  true, 'any', false,
  $$Free to choose (any urban site worldwide)$$,
  $$https://www.terravivacompetitions.com/the-civic-kiosk-competition-2026/$$
where not exists (select 1 from public.competitions where title = $$The Civic Kiosk$$);

-- 10. Terraviva — Quilmes Open-Air Museum
insert into public.competitions
  (title, image_url, summary, brief_text, discipline, deadline, registration_deadline, prize, entry_fee, student_eligible, level, team_required, location, organizer_url)
select
  $$Quilmes Open-Air Museum$$,
  null,
  $$Participants are asked to reimagine the Sacred City of Quilmes in Argentina as a contemporary open-air museum, using a system of landscape interventions rather than a single building. The challenge sits at the intersection of archaeology, indigenous heritage, and landscape design.$$,
  $$The site is the Sacred City of Quilmes, a pre-Columbian archaeological settlement in northern Argentina. Rather than proposing a museum building, entrants develop a distributed system of landscape interventions — paths, thresholds, shelters, interpretive moments — that allow visitors to experience the ruins and their setting without overwhelming them. The design must negotiate the tension between access and preservation, and engage seriously with the cultural significance of the site to indigenous communities rather than treating it as neutral terrain. Jury evaluation focuses on sensitivity to heritage and archaeological context, the coherence of the intervention system across the landscape, quality of the visitor experience proposed, and restraint in material and formal choices.$$,
  'landscape', date '2026-10-16', date '2026-10-16',
  $p$$9,000 total$p$,
  null,
  true, 'any', false,
  $$Quilmes, Tucumán, Argentina$$,
  $$https://www.terravivacompetitions.com/$$
where not exists (select 1 from public.competitions where title = $$Quilmes Open-Air Museum$$);

-- 11. Terraviva — Torosiaje Overwater Accommodation
insert into public.competitions
  (title, image_url, summary, brief_text, discipline, deadline, registration_deadline, prize, entry_fee, student_eligible, level, team_required, location, organizer_url)
select
  $$Torosiaje Overwater Accommodation$$,
  null,
  $$This competition invites designers to propose a small-scale overwater accommodation within the stilt village of Torosiaje in Indonesia, home to a Bajau sea-nomad community. The brief calls for a structure that sits lightly on the water and responds to an existing vernacular rather than importing a resort typology.$$,
  $$Entrants design a compact overwater dwelling or guest accommodation within the village of Torosiaje, a settlement built entirely on stilts above the sea in Gorontalo, Indonesia. The design must confront the practical realities of building over water — structure, access, waste, fresh water, weather exposure — while remaining respectful of the existing built fabric and the way the Bajau community inhabits it. Proposals should avoid generic eco-resort language and instead demonstrate genuine engagement with local construction methods, materials, and social patterns. Judging emphasises environmental and cultural sensitivity, structural credibility over water, the quality of the guest experience, and how well the intervention integrates with rather than dominates the village.$$,
  'architecture', date '2026-10-09', date '2026-10-09',
  $p$$8,000 total$p$,
  null,
  true, 'any', false,
  $$Torosiaje, Gorontalo, Indonesia$$,
  $$https://www.terravivacompetitions.com/$$
where not exists (select 1 from public.competitions where title = $$Torosiaje Overwater Accommodation$$);

-- 12. Terraviva — Villa Gioia
insert into public.competitions
  (title, image_url, summary, brief_text, discipline, deadline, registration_deadline, prize, entry_fee, student_eligible, level, team_required, location, organizer_url)
select
  $$Villa Gioia$$,
  null,
  $$Participants are asked to convert a historic Italian estate near Lake Garda into a contemporary retirement residence. The brief pairs adaptive reuse of a heritage property with a programme — ageing and care — that architecture students rarely get to work on seriously.$$,
  $$The site is Villa Gioia, a historic estate in Bedizzole in the Lake Garda area of northern Italy. Entrants must adapt the existing building and grounds into a residence for older adults, resolving accessibility, care infrastructure, and privacy requirements without stripping the property of its historic character. The programme demands attention to things often ignored in student work: circulation for reduced mobility, gradations between private rooms and communal areas, daylight and orientation for wellbeing, and the relationship between indoor space and garden. Judging weighs the intelligence of the adaptive reuse strategy, the quality of life the proposal would actually deliver to residents, sensitivity to the heritage fabric, and the integration of landscape with building.$$,
  'multi', date '2026-10-23', date '2026-10-23',
  $$€10,000 total$$,
  null,
  true, 'any', false,
  $$Bedizzole, Brescia, Italy$$,
  $$https://www.terravivacompetitions.com/$$
where not exists (select 1 from public.competitions where title = $$Villa Gioia$$);

-- ─────────────────────── Part 2: auto-delete expired ─────────────────────────
-- pg_cron runs inside the database, so no Vercel function slot is used. The job
-- hard-deletes any competition whose deadline is strictly in the past. Bookmarks
-- in saved_competitions are removed automatically via ON DELETE CASCADE.
create extension if not exists pg_cron;

-- Idempotent (re)schedule: drop any prior job of this name, then create fresh.
do $$
begin
  perform cron.unschedule('delete-expired-competitions');
exception when others then
  null;  -- job did not exist yet
end $$;

select cron.schedule(
  'delete-expired-competitions',
  '0 3 * * *',  -- daily at 03:00 UTC
  $$delete from public.competitions where deadline < current_date$$
);
