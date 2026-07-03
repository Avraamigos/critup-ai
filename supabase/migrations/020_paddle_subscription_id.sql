-- ── Store the Paddle subscription id on the profile ──────────────────────────
-- Until now the webhook only flipped profiles.plan; nothing linked a profile
-- back to its Paddle subscription, making refunds/disputes/reconciliation
-- ("why am I still charged?") impossible to investigate from our side.
--
-- Nullable, no backfill: existing subscribers get theirs on the next
-- subscription.updated webhook (renewal or any change). No RLS change —
-- the column rides the existing own-row policies.

alter table public.profiles
  add column if not exists paddle_subscription_id text;
