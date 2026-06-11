-- Migration 015: Public profile fields (bio, Instagram, LinkedIn) + a public read view
-- so the community feed can show an author's bio/university/socials in a popup.
-- The `profiles` table itself stays owner-only under RLS; we expose ONLY a safe
-- subset of columns through a read-only view granted to everyone.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio       text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin  text;

-- Public, read-only projection of the safe display fields only.
-- (No email, plan, usage counts, or other private data.)
CREATE OR REPLACE VIEW public_profiles AS
SELECT
  id,
  full_name,
  university,
  discipline,
  bio,
  instagram,
  linkedin
FROM profiles;

GRANT SELECT ON public_profiles TO anon, authenticated;
