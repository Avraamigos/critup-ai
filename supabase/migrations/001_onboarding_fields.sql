-- Add onboarding fields to profiles
-- Run in: Supabase Dashboard → SQL Editor → New query

alter table public.profiles
  add column if not exists discipline   text,
  add column if not exists year         text,
  add column if not exists university   text,
  add column if not exists challenges   text[] not null default '{}',
  add column if not exists onboarding_complete boolean not null default false;
