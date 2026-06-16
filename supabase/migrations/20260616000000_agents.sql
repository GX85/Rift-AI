-- Миграция: таблица `agents` — это ИИ-агенты, которых создаёт пользователь.
-- Применяется КОМАНДОЙ (не вручную): npm run db:push
-- Каждый агент = имя + описание + system prompt (роль и правила для Gemini).

-- 1) Таблица агентов
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  system_prompt text not null,
  created_at timestamptz not null default now()
);

-- 2) Включаем Row Level Security (без этого таблица закрыта для всех)
alter table public.agents enable row level security;

-- 3) Правила доступа: каждый работает только со своими агентами
create policy "read own agents"
  on public.agents for select
  using (auth.uid() = user_id);

create policy "insert own agents"
  on public.agents for insert
  with check (auth.uid() = user_id);

create policy "update own agents"
  on public.agents for update
  using (auth.uid() = user_id);

create policy "delete own agents"
  on public.agents for delete
  using (auth.uid() = user_id);
