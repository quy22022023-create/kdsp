-- ================================================================
-- JLPT LEARNING APP — SUPABASE SCHEMA
-- Tất cả RPC dùng tiền tố j_. Chạy toàn bộ tệp trong Supabase SQL Editor.
-- ================================================================

create extension if not exists pgcrypto;

create table if not exists public.j_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.j_content_batches (
  id uuid primary key default gen_random_uuid(),
  batch_code text not null unique,
  label text not null,
  status text not null default 'published' check (status in ('published')),
  vocabulary_count integer not null default 0,
  grammar_count integer not null default 0,
  exercise_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz not null default now()
);

create table if not exists public.j_vocab (
  id text primary key,
  level text not null check (level in ('N5', 'N4', 'N3')),
  topic text not null default 'Tổng hợp',
  jp text not null,
  kanji text not null default '',
  payload jsonb not null,
  batch_id uuid not null references public.j_content_batches(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.j_grammar (
  id text primary key,
  level text not null check (level in ('N5', 'N4', 'N3')),
  topic text not null default 'Tổng hợp',
  pattern text not null,
  payload jsonb not null,
  batch_id uuid not null references public.j_content_batches(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.j_exercises (
  id text primary key,
  level text not null check (level in ('N5', 'N4', 'N3')),
  topic text not null default 'Tổng hợp',
  kind text not null default 'choice',
  prompt_jp text not null,
  answer text not null default '',
  payload jsonb not null,
  batch_id uuid not null references public.j_content_batches(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.j_content_versions (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('vocab', 'grammar', 'exercise')),
  item_id text not null,
  payload jsonb not null,
  source_batch_id uuid references public.j_content_batches(id) on delete set null,
  archived_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz not null default now()
);

create table if not exists public.j_user_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('vocab', 'grammar', 'lesson', 'exercise')),
  item_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

create index if not exists j_vocab_batch_level_idx on public.j_vocab(batch_id, level, topic);
create index if not exists j_grammar_batch_level_idx on public.j_grammar(batch_id, level, topic);
create index if not exists j_exercises_batch_level_idx on public.j_exercises(batch_id, level, topic);
create index if not exists j_content_versions_item_idx on public.j_content_versions(item_type, item_id, archived_at desc);
create index if not exists j_user_progress_user_updated_idx on public.j_user_progress(user_id, updated_at desc);

-- Không cấp quyền truy cập bảng trực tiếp. Mọi thao tác đi qua RPC có kiểm soát.
alter table public.j_admins enable row level security;
alter table public.j_content_batches enable row level security;
alter table public.j_vocab enable row level security;
alter table public.j_grammar enable row level security;
alter table public.j_exercises enable row level security;
alter table public.j_content_versions enable row level security;
alter table public.j_user_progress enable row level security;

revoke all on public.j_admins from anon, authenticated;
revoke all on public.j_content_batches from anon, authenticated;
revoke all on public.j_vocab from anon, authenticated;
revoke all on public.j_grammar from anon, authenticated;
revoke all on public.j_exercises from anon, authenticated;
revoke all on public.j_content_versions from anon, authenticated;
revoke all on public.j_user_progress from anon, authenticated;

create or replace function public.j_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.j_admins a where a.user_id = auth.uid()
  );
$$;

create or replace function public.j_get_published_content()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'vocabulary', coalesce((
      select jsonb_agg(v.payload order by v.level, v.topic, v.id)
      from public.j_vocab v
      join public.j_content_batches b on b.id = v.batch_id
      where b.status = 'published'
    ), '[]'::jsonb),
    'grammar', coalesce((
      select jsonb_agg(g.payload order by g.level, g.topic, g.id)
      from public.j_grammar g
      join public.j_content_batches b on b.id = g.batch_id
      where b.status = 'published'
    ), '[]'::jsonb),
    'exercises', coalesce((
      select jsonb_agg(e.payload order by e.level, e.topic, e.id)
      from public.j_exercises e
      join public.j_content_batches b on b.id = e.batch_id
      where b.status = 'published'
    ), '[]'::jsonb)
  );
$$;

create or replace function public.j_import_batch(
  p_batch_code text,
  p_label text,
  p_vocab jsonb default '[]'::jsonb,
  p_grammar jsonb default '[]'::jsonb,
  p_exercises jsonb default '[]'::jsonb,
  p_update_existing boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_item jsonb;
  v_id text;
  v_existing_id text;
  v_level text;
  v_topic text;
  v_jp text;
  v_kanji text;
  v_pattern text;
  v_kind text;
  v_answer text;
  v_payload jsonb;
  v_added_vocab integer := 0;
  v_updated_vocab integer := 0;
  v_added_grammar integer := 0;
  v_updated_grammar integer := 0;
  v_added_exercises integer := 0;
  v_updated_exercises integer := 0;
  v_skipped integer := 0;
  v_count integer;
begin
  if not public.j_is_admin() then
    raise exception 'Bạn không có quyền quản trị dữ liệu.' using errcode = '42501';
  end if;

  if coalesce(length(trim(p_batch_code)), 0) = 0 or coalesce(length(trim(p_label)), 0) = 0 then
    raise exception 'Mã đợt và tên đợt không được để trống.';
  end if;

  if jsonb_typeof(coalesce(p_vocab, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_grammar, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_exercises, '[]'::jsonb)) <> 'array' then
    raise exception 'Dữ liệu từ vựng, ngữ pháp và bài tập phải là mảng JSON.';
  end if;

  v_count := jsonb_array_length(coalesce(p_vocab, '[]'::jsonb))
           + jsonb_array_length(coalesce(p_grammar, '[]'::jsonb))
           + jsonb_array_length(coalesce(p_exercises, '[]'::jsonb));
  if v_count = 0 then raise exception 'Đợt nhập không có dữ liệu.'; end if;
  if v_count > 3000 then raise exception 'Mỗi đợt tối đa 3.000 mục dữ liệu.'; end if;

  insert into public.j_content_batches(batch_code, label, created_by)
  values (trim(p_batch_code), trim(p_label), auth.uid())
  returning id into v_batch_id;

  -- TỪ VỰNG
  for v_item in select value from jsonb_array_elements(coalesce(p_vocab, '[]'::jsonb)) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'Mục từ vựng phải là object JSON.'; end if;
    v_jp := nullif(trim(v_item->>'jp'), '');
    if v_jp is null or nullif(trim(v_item->>'vi'), '') is null then
      raise exception 'Mỗi từ vựng cần có jp và vi.';
    end if;
    v_level := upper(coalesce(nullif(trim(v_item->>'level'), ''), 'N5'));
    if v_level not in ('N5', 'N4', 'N3') then raise exception 'Cấp độ từ vựng không hợp lệ: %', v_level; end if;
    v_topic := coalesce(nullif(trim(v_item->>'topic'), ''), 'Tổng hợp');
    v_kanji := coalesce(v_item->>'kanji', '');
    v_id := coalesce(nullif(trim(v_item->>'id'), ''), 'vc_' || substr(md5(v_level || '|' || v_jp || '|' || v_kanji), 1, 18));
    v_existing_id := null;
    select id into v_existing_id from public.j_vocab
      where id = v_id
         or (lower(trim(jp)) = lower(trim(v_jp)) and lower(trim(coalesce(kanji, ''))) = lower(trim(v_kanji)))
      order by case when id = v_id then 0 else 1 end limit 1;
    v_payload := v_item || jsonb_build_object('id', coalesce(v_existing_id, v_id), 'level', v_level, 'topic', v_topic);

    if v_existing_id is not null then
      if p_update_existing then
        insert into public.j_content_versions(item_type, item_id, payload, source_batch_id, archived_by)
        select 'vocab', id, payload, batch_id, auth.uid() from public.j_vocab where id = v_existing_id;
        update public.j_vocab set level = v_level, topic = v_topic, jp = v_jp, kanji = v_kanji,
          payload = v_payload, batch_id = v_batch_id, updated_at = now()
        where id = v_existing_id;
        v_updated_vocab := v_updated_vocab + 1;
      else
        v_skipped := v_skipped + 1;
      end if;
    else
      insert into public.j_vocab(id, level, topic, jp, kanji, payload, batch_id)
      values (v_id, v_level, v_topic, v_jp, v_kanji, v_payload, v_batch_id);
      v_added_vocab := v_added_vocab + 1;
    end if;
  end loop;

  -- NGỮ PHÁP
  for v_item in select value from jsonb_array_elements(coalesce(p_grammar, '[]'::jsonb)) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'Mục ngữ pháp phải là object JSON.'; end if;
    v_pattern := nullif(trim(v_item->>'pattern'), '');
    if v_pattern is null then raise exception 'Mỗi mục ngữ pháp cần có pattern.'; end if;
    v_level := upper(coalesce(nullif(trim(v_item->>'level'), ''), 'N5'));
    if v_level not in ('N5', 'N4', 'N3') then raise exception 'Cấp độ ngữ pháp không hợp lệ: %', v_level; end if;
    v_topic := coalesce(nullif(trim(v_item->>'topic'), ''), 'Tổng hợp');
    v_id := coalesce(nullif(trim(v_item->>'id'), ''), 'gr_' || substr(md5(v_level || '|' || v_pattern), 1, 18));
    v_existing_id := null;
    select id into v_existing_id from public.j_grammar
      where id = v_id or (level = v_level and lower(trim(pattern)) = lower(trim(v_pattern)))
      order by case when id = v_id then 0 else 1 end limit 1;
    v_payload := v_item || jsonb_build_object('id', coalesce(v_existing_id, v_id), 'level', v_level, 'topic', v_topic);

    if v_existing_id is not null then
      if p_update_existing then
        insert into public.j_content_versions(item_type, item_id, payload, source_batch_id, archived_by)
        select 'grammar', id, payload, batch_id, auth.uid() from public.j_grammar where id = v_existing_id;
        update public.j_grammar set level = v_level, topic = v_topic, pattern = v_pattern,
          payload = v_payload, batch_id = v_batch_id, updated_at = now()
        where id = v_existing_id;
        v_updated_grammar := v_updated_grammar + 1;
      else
        v_skipped := v_skipped + 1;
      end if;
    else
      insert into public.j_grammar(id, level, topic, pattern, payload, batch_id)
      values (v_id, v_level, v_topic, v_pattern, v_payload, v_batch_id);
      v_added_grammar := v_added_grammar + 1;
    end if;
  end loop;

  -- BÀI TẬP
  for v_item in select value from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'Mục bài tập phải là object JSON.'; end if;
    v_jp := coalesce(nullif(trim(v_item->>'prompt_jp'), ''), nullif(trim(v_item->>'jp'), ''));
    if v_jp is null then raise exception 'Mỗi bài tập cần có prompt_jp hoặc jp.'; end if;
    v_kind := coalesce(nullif(trim(v_item->>'kind'), ''), 'choice');
    v_answer := coalesce(nullif(trim(v_item->>'answer'), ''), nullif(trim(v_item->>'vi'), ''), '');
    v_level := upper(coalesce(nullif(trim(v_item->>'level'), ''), 'N5'));
    if v_level not in ('N5', 'N4', 'N3') then raise exception 'Cấp độ bài tập không hợp lệ: %', v_level; end if;
    v_topic := coalesce(nullif(trim(v_item->>'topic'), ''), 'Bài tập tổng hợp');
    v_id := coalesce(nullif(trim(v_item->>'id'), ''), 'ex_' || substr(md5(v_level || '|' || v_kind || '|' || v_jp || '|' || v_answer), 1, 18));
    v_existing_id := null;
    select id into v_existing_id from public.j_exercises
      where id = v_id or (level = v_level and kind = v_kind and lower(trim(prompt_jp)) = lower(trim(v_jp)) and lower(trim(answer)) = lower(trim(v_answer)))
      order by case when id = v_id then 0 else 1 end limit 1;
    v_payload := v_item || jsonb_build_object('id', coalesce(v_existing_id, v_id), 'type', 'exercise', 'level', v_level, 'topic', v_topic);

    if v_existing_id is not null then
      if p_update_existing then
        insert into public.j_content_versions(item_type, item_id, payload, source_batch_id, archived_by)
        select 'exercise', id, payload, batch_id, auth.uid() from public.j_exercises where id = v_existing_id;
        update public.j_exercises set level = v_level, topic = v_topic, kind = v_kind,
          prompt_jp = v_jp, answer = v_answer, payload = v_payload,
          batch_id = v_batch_id, updated_at = now()
        where id = v_existing_id;
        v_updated_exercises := v_updated_exercises + 1;
      else
        v_skipped := v_skipped + 1;
      end if;
    else
      insert into public.j_exercises(id, level, topic, kind, prompt_jp, answer, payload, batch_id)
      values (v_id, v_level, v_topic, v_kind, v_jp, v_answer, v_payload, v_batch_id);
      v_added_exercises := v_added_exercises + 1;
    end if;
  end loop;

  update public.j_content_batches set
    vocabulary_count = v_added_vocab + v_updated_vocab,
    grammar_count = v_added_grammar + v_updated_grammar,
    exercise_count = v_added_exercises + v_updated_exercises
  where id = v_batch_id;

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'batch_code', trim(p_batch_code),
    'added_vocab', v_added_vocab,
    'updated_vocab', v_updated_vocab,
    'added_grammar', v_added_grammar,
    'updated_grammar', v_updated_grammar,
    'added_exercises', v_added_exercises,
    'updated_exercises', v_updated_exercises,
    'skipped', v_skipped,
    'published', true
  );
end;
$$;

create or replace function public.j_get_batch_history()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.j_is_admin() then
    raise exception 'Bạn không có quyền xem lịch sử nạp dữ liệu.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'batch_code', q.batch_code, 'label', q.label, 'status', q.status,
      'vocabulary_count', q.vocabulary_count, 'grammar_count', q.grammar_count,
      'exercise_count', q.exercise_count, 'created_at', q.created_at, 'published_at', q.published_at
    ) order by q.created_at desc)
    from (select * from public.j_content_batches order by created_at desc limit 100) q
  ), '[]'::jsonb);
end;
$$;

create or replace function public.j_get_content_versions(p_item_type text default null, p_item_id text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.j_is_admin() then
    raise exception 'Bạn không có quyền xem bản lưu dữ liệu.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'item_type', q.item_type, 'item_id', q.item_id,
      'payload', q.payload, 'source_batch_id', q.source_batch_id,
      'archived_at', q.archived_at
    ) order by q.archived_at desc)
    from (
      select * from public.j_content_versions
      where (p_item_type is null or item_type = p_item_type)
        and (p_item_id is null or item_id = p_item_id)
      order by archived_at desc limit 100
    ) q
  ), '[]'::jsonb);
end;
$$;

create or replace function public.j_restore_content_version(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version public.j_content_versions%rowtype;
  v_batch_id uuid;
  v_batch_code text;
  v_rows integer;
begin
  if not public.j_is_admin() then
    raise exception 'Bạn không có quyền khôi phục dữ liệu.' using errcode = '42501';
  end if;
  select * into v_version from public.j_content_versions where id = p_version_id;
  if not found then raise exception 'Không tìm thấy bản lưu cần khôi phục.'; end if;

  v_batch_code := 'restore-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.j_content_batches(batch_code, label, created_by)
  values (v_batch_code, 'Khôi phục ' || v_version.item_type || ' · ' || v_version.item_id, auth.uid())
  returning id into v_batch_id;

  if v_version.item_type = 'vocab' then
    insert into public.j_content_versions(item_type, item_id, payload, source_batch_id, archived_by)
    select 'vocab', id, payload, batch_id, auth.uid() from public.j_vocab where id = v_version.item_id;
    update public.j_vocab set
      level = upper(coalesce(nullif(v_version.payload->>'level', ''), 'N5')),
      topic = coalesce(nullif(v_version.payload->>'topic', ''), 'Tổng hợp'),
      jp = coalesce(nullif(v_version.payload->>'jp', ''), jp),
      kanji = coalesce(v_version.payload->>'kanji', ''),
      payload = v_version.payload, batch_id = v_batch_id, updated_at = now()
    where id = v_version.item_id;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then raise exception 'Từ vựng hiện tại không còn tồn tại.'; end if;
    update public.j_content_batches set vocabulary_count = 1 where id = v_batch_id;
  elsif v_version.item_type = 'grammar' then
    insert into public.j_content_versions(item_type, item_id, payload, source_batch_id, archived_by)
    select 'grammar', id, payload, batch_id, auth.uid() from public.j_grammar where id = v_version.item_id;
    update public.j_grammar set
      level = upper(coalesce(nullif(v_version.payload->>'level', ''), 'N5')),
      topic = coalesce(nullif(v_version.payload->>'topic', ''), 'Tổng hợp'),
      pattern = coalesce(nullif(v_version.payload->>'pattern', ''), pattern),
      payload = v_version.payload, batch_id = v_batch_id, updated_at = now()
    where id = v_version.item_id;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then raise exception 'Mục ngữ pháp hiện tại không còn tồn tại.'; end if;
    update public.j_content_batches set grammar_count = 1 where id = v_batch_id;
  else
    insert into public.j_content_versions(item_type, item_id, payload, source_batch_id, archived_by)
    select 'exercise', id, payload, batch_id, auth.uid() from public.j_exercises where id = v_version.item_id;
    update public.j_exercises set
      level = upper(coalesce(nullif(v_version.payload->>'level', ''), 'N5')),
      topic = coalesce(nullif(v_version.payload->>'topic', ''), 'Bài tập tổng hợp'),
      kind = coalesce(nullif(v_version.payload->>'kind', ''), 'choice'),
      prompt_jp = coalesce(nullif(v_version.payload->>'prompt_jp', ''), nullif(v_version.payload->>'jp', ''), prompt_jp),
      answer = coalesce(v_version.payload->>'answer', ''),
      payload = v_version.payload, batch_id = v_batch_id, updated_at = now()
    where id = v_version.item_id;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then raise exception 'Bài tập hiện tại không còn tồn tại.'; end if;
    update public.j_content_batches set exercise_count = 1 where id = v_batch_id;
  end if;

  return jsonb_build_object('restored', true, 'item_type', v_version.item_type,
    'item_id', v_version.item_id, 'batch_code', v_batch_code);
end;
$$;

create or replace function public.j_get_user_progress()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Cần đăng nhập để đồng bộ tiến độ.' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'item_type', item_type, 'item_id', item_id, 'data', data, 'updated_at', updated_at
    )) from public.j_user_progress where user_id = auth.uid()
  ), '[]'::jsonb);
end;
$$;

create or replace function public.j_sync_user_progress(p_records jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record jsonb;
  v_type text;
  v_id text;
  v_data jsonb;
  v_updated_at timestamptz;
  v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Cần đăng nhập để đồng bộ tiến độ.' using errcode = '28000'; end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array' then raise exception 'Tiến độ phải là mảng JSON.'; end if;
  if jsonb_array_length(p_records) > 2000 then raise exception 'Mỗi lần đồng bộ tối đa 2.000 mục.'; end if;

  for v_record in select value from jsonb_array_elements(p_records) loop
    v_type := coalesce(v_record->>'item_type', '');
    v_id := coalesce(v_record->>'item_id', '');
    if v_type not in ('vocab', 'grammar', 'lesson', 'exercise') or length(v_id) = 0 or length(v_id) > 180 then
      raise exception 'Bản ghi tiến độ không hợp lệ.';
    end if;
    v_data := coalesce(v_record->'data', '{}'::jsonb);
    if jsonb_typeof(v_data) <> 'object' then raise exception 'Trường data của tiến độ phải là object.'; end if;
    v_updated_at := coalesce(nullif(v_record->>'updated_at', '')::timestamptz, now());

    insert into public.j_user_progress(user_id, item_type, item_id, data, updated_at)
    values (auth.uid(), v_type, v_id, v_data, v_updated_at)
    on conflict (user_id, item_type, item_id) do update
      set data = excluded.data, updated_at = excluded.updated_at
      where public.j_user_progress.updated_at <= excluded.updated_at;
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('received', v_count, 'saved_at', now());
end;
$$;

revoke all on function public.j_is_admin() from public;
revoke all on function public.j_get_published_content() from public;
revoke all on function public.j_import_batch(text, text, jsonb, jsonb, jsonb, boolean) from public;
revoke all on function public.j_get_batch_history() from public;
revoke all on function public.j_get_content_versions(text, text) from public;
revoke all on function public.j_restore_content_version(uuid) from public;
revoke all on function public.j_get_user_progress() from public;
revoke all on function public.j_sync_user_progress(jsonb) from public;

grant execute on function public.j_get_published_content() to anon, authenticated;
grant execute on function public.j_is_admin() to authenticated;
grant execute on function public.j_import_batch(text, text, jsonb, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.j_get_batch_history() to authenticated;
grant execute on function public.j_get_content_versions(text, text) to authenticated;
grant execute on function public.j_restore_content_version(uuid) to authenticated;
grant execute on function public.j_get_user_progress() to authenticated;
grant execute on function public.j_sync_user_progress(jsonb) to authenticated;

-- Sau khi tạo tài khoản qua admin.html, lấy UUID trong Authentication > Users,
-- rồi chạy lệnh sau (thay UUID thật) để cấp quyền quản trị:
-- insert into public.j_admins(user_id) values ('00000000-0000-0000-0000-000000000000')
-- on conflict (user_id) do nothing;
