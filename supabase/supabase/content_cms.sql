-- Draft storage for the GitHub-backed KDSP content CMS.
-- Run this once in Supabase SQL Editor after supabase/schema.sql.
-- Published learning content remains in GitHub /content; this table stores drafts only.

create table if not exists public.j_content_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Bản nháp',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists j_content_drafts_user_updated_idx
  on public.j_content_drafts(user_id, updated_at desc);

alter table public.j_content_drafts enable row level security;
revoke all on public.j_content_drafts from anon, authenticated;

comment on table public.j_content_drafts is
  'Private CMS drafts. Accessed only by the j_content_admin Edge Function using service_role after user authentication, admin membership and gate-password checks.';
