-- Migration 014: Add owner_avatar_url to analyses for community feed display
-- Profile pictures are denormalized at publish time so the feed can show
-- real avatars without reading the author's profile (which is owner-only under RLS).

ALTER TABLE analyses ADD COLUMN IF NOT EXISTS owner_avatar_url text;
