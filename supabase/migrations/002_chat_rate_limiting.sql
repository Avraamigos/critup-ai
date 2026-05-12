-- Chat message log — used only for rate limiting, not for displaying history.
-- Each row = one user message sent to /api/chat.
-- Rows older than 2 hours are irrelevant for rate limiting and can be pruned.

create table if not exists public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  analysis_id  uuid references public.analyses(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Index for the rate-limit query: user_id + created_at
create index if not exists chat_messages_user_created
  on public.chat_messages (user_id, created_at desc);

-- RLS: users can only insert/read their own rows
alter table public.chat_messages enable row level security;

create policy "Users manage own chat messages"
  on public.chat_messages
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role bypasses RLS (used by the API)

-- Auto-prune rows older than 2 hours to keep the table small
-- (Run this as a scheduled job in Supabase or pg_cron if available)
-- delete from public.chat_messages where created_at < now() - interval '2 hours';
