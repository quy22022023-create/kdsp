-- KDSP Course CMS draft storage (phase 2).
-- Published learning content is kept in GitHub /content; draft files go to a
-- private Supabase Storage bucket. Database stores small metadata only.
-- Run once in Supabase SQL Editor after supabase/schema.sql.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kdsp-cms-drafts', 'kdsp-cms-drafts', false, 8388608, array['application/json']::text[])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.j_content_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Bản nháp',
  storage_path text not null,
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
  'Only owner/status metadata for private CMS drafts. Access is restricted to the j_content_admin Edge Function via service_role after authentication, admin membership and gate checks.';
