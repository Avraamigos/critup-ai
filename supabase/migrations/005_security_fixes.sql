-- ── Security fixes (from Security Advisor warnings) ──────────────────────────
--
-- 1. Add SET search_path = '' to all functions (prevents search path injection)
-- 2. Revoke direct EXECUTE from anon/authenticated on trigger-only functions
--    (they're called by the DB engine via triggers, not by users directly)

-- handle_new_user: trigger on auth.users insert → creates profile row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

-- increment_analyses_used(uid): direct-call version (increments counter for a user)
CREATE OR REPLACE FUNCTION public.increment_analyses_used(uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.profiles
  SET analyses_used = analyses_used + 1,
      updated_at    = now()
  WHERE id = uid;
END;
$$;

-- increment_analyses_used(): trigger version — fires when analysis → 'complete'
CREATE OR REPLACE FUNCTION public.increment_analyses_used()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'complete' AND (OLD.status IS DISTINCT FROM 'complete') THEN
    UPDATE public.profiles SET analyses_used = analyses_used + 1 WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- set_updated_at: trigger to keep updated_at current
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Revoke direct execution from public roles — these functions are trigger-only
-- (triggers fire via DB engine, not via user EXECUTE, so this is safe)
REVOKE EXECUTE ON FUNCTION public.handle_new_user()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_analyses_used()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_analyses_used(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()              FROM PUBLIC, anon, authenticated;
