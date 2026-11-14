-- ================================================================
-- USERNAME REGISTRATION — PUBLIC EDGE FUNCTION SUPPORT
-- Chạy một lần trong Supabase SQL Editor trước khi deploy j_register.
-- Không giới hạn tổng số học viên; chỉ giới hạn tốc độ đăng ký theo IP.
-- ================================================================

create table if not exists public.j_registration_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists j_registration_attempts_ip_time_idx
  on public.j_registration_attempts (ip_hash, attempted_at desc);

create index if not exists j_registration_attempts_time_idx
  on public.j_registration_attempts (attempted_at);

alter table public.j_registration_attempts enable row level security;
revoke all on public.j_registration_attempts from public, anon, authenticated;

create or replace function public.j_consume_registration_attempt(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_count integer;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Mã nguồn đăng ký không hợp lệ.';
  end if;

  -- Khóa theo hash IP để hai request đồng thời không vượt qua giới hạn.
  perform pg_advisory_xact_lock(hashtext(p_ip_hash));

  -- Dọn dữ liệu cũ, không lưu địa chỉ IP thô.
  delete from public.j_registration_attempts
  where attempted_at < now() - interval '1 day';

  select count(*)
    into v_attempt_count
    from public.j_registration_attempts
   where ip_hash = p_ip_hash
     and attempted_at >= now() - interval '15 minutes';

  -- 20 lần đăng ký / 15 phút / IP; không phải giới hạn số tài khoản.
  if v_attempt_count >= 20 then
    return false;
  end if;

  insert into public.j_registration_attempts(ip_hash)
  values (p_ip_hash);

  return true;
end;
$$;

revoke all on function public.j_consume_registration_attempt(text) from public, anon, authenticated;
grant execute on function public.j_consume_registration_attempt(text) to service_role;
