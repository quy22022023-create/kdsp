-- KDSP migration: enable JLPT N2 in legacy vocabulary/grammar/exercise import.
-- Run once in Supabase SQL Editor before importing N2 packages.

alter table public.j_vocab drop constraint if exists j_vocab_level_check;
alter table public.j_vocab add constraint j_vocab_level_check check (level in ('N5', 'N4', 'N3', 'N2'));

alter table public.j_grammar drop constraint if exists j_grammar_level_check;
alter table public.j_grammar add constraint j_grammar_level_check check (level in ('N5', 'N4', 'N3', 'N2'));

alter table public.j_exercises drop constraint if exists j_exercises_level_check;
alter table public.j_exercises add constraint j_exercises_level_check check (level in ('N5', 'N4', 'N3', 'N2'));

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
    if v_level not in ('N5', 'N4', 'N3', 'N2') then raise exception 'Cấp độ từ vựng không hợp lệ: %', v_level; end if;
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
    if v_level not in ('N5', 'N4', 'N3', 'N2') then raise exception 'Cấp độ ngữ pháp không hợp lệ: %', v_level; end if;
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
    if v_level not in ('N5', 'N4', 'N3', 'N2') then raise exception 'Cấp độ bài tập không hợp lệ: %', v_level; end if;
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
