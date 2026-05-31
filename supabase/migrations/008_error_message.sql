-- Add error_message column to analyses so admin can see why analyses fail
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS error_message text;
