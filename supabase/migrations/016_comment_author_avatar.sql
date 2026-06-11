-- Migration 016: store the commenter's avatar URL on each comment so the
-- community feed can show real profile photos in comment threads
-- (denormalized at insert time, same pattern as author_name).

ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS author_avatar_url text;
