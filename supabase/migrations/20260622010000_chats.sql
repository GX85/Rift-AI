-- Чаты пользователя хранятся в Supabase: один чат = одна строка с историей (jsonb).
-- Применяется КОМАНДОЙ: npm run db:push

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Новый чат',
  model text not null default 'amethyst',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chats enable row level security;

create policy "chats read own"
  on public.chats for select using (auth.uid() = user_id);
create policy "chats insert own"
  on public.chats for insert with check (auth.uid() = user_id);
create policy "chats update own"
  on public.chats for update using (auth.uid() = user_id);
create policy "chats delete own"
  on public.chats for delete using (auth.uid() = user_id);

create index if not exists chats_user_updated_idx on public.chats (user_id, updated_at desc);
