-- Аккаунт: лимит сообщений и память ИИ переезжают в базу (привязаны к пользователю),
-- а коды активации Plus — в защищённую таблицу + серверную функцию (их больше нет в коде фронта).
-- Применяется КОМАНДОЙ: npm run db:push

-- ── 1. Счётчик сообщений и память — в профиле пользователя ──
alter table public.profiles add column if not exists usage_count integer not null default 0;
alter table public.profiles add column if not exists memory jsonb not null default '[]'::jsonb;

-- ── 2. Коды активации Plus — секретная таблица (фронт её не читает) ──
create table if not exists public.plus_codes (
  code text primary key,
  active boolean not null default true
);

alter table public.plus_codes enable row level security;
-- Никаких политик select/insert для обычных пользователей: таблица доступна только через
-- функцию redeem_plus_code (она работает с правами владельца, security definer).

-- Коды храним заглавными: функция redeem_plus_code сравнивает через upper(), поэтому
-- пользователь может вводить их в любом регистре.
insert into public.plus_codes (code) values
  ('IT''SAMETHYST'),
  ('AMETHYSTAI'),
  ('AMETHYSTPLUS')
on conflict (code) do nothing;

-- ── 3. Активация Plus по коду (проверка на сервере) ──
-- Возвращает true, если код существует и активен; тогда же ставит profiles.is_plus = true.
create or replace function public.redeem_plus_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
  select exists (
    select 1 from public.plus_codes
    where code = upper(btrim(p_code)) and active
  ) into ok;

  if ok then
    update public.profiles set is_plus = true where id = auth.uid();
  end if;

  return ok;
end;
$$;

-- ── 4. Увеличить счётчик сообщений на 1 и вернуть новое значение ──
create or replace function public.bump_usage()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.profiles
    set usage_count = usage_count + 1
    where id = auth.uid()
    returning usage_count into n;
  return coalesce(n, 0);
end;
$$;

revoke all on function public.redeem_plus_code(text) from public;
revoke all on function public.bump_usage() from public;
grant execute on function public.redeem_plus_code(text) to authenticated;
grant execute on function public.bump_usage() to authenticated;
