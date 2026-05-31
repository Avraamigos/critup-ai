-- Optional caption shown on community posts (set when a user posts to the feed)
ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS caption text;
