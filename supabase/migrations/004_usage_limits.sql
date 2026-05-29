-- ── Trigger: increment profiles.analyses_used when an analysis completes ──────
-- Only fires when status changes TO 'complete' — failed/retried analyses don't
-- count against the user. The counter never decrements, so deleting a project
-- and re-uploading doesn't reset the free tier limit.

create or replace function public.increment_analyses_used()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'complete' and (old.status is distinct from 'complete') then
    update public.profiles set analyses_used = analyses_used + 1 where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_analyses_used on public.analyses;
create trigger trg_analyses_used
  after update on public.analyses
  for each row execute function public.increment_analyses_used();

-- ── IP rate limit table (abuse / competitor protection) ───────────────────────
-- Stores one row per (ip, endpoint) pair. Updated on each request within the
-- active window. Service role only — no RLS needed.

create table if not exists public.rate_limit_ip (
  ip           text not null,
  endpoint     text not null,
  window_start timestamptz not null default now(),
  count        int  not null default 1,
  primary key (ip, endpoint)
);
