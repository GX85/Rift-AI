-- Профили пользователей: сохраняем, кто заходил (имя, email, аватар из Google).
-- Применяется КОМАНДОЙ: npm run db:push

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Каждый видит и меняет только свой профиль.
create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id);
