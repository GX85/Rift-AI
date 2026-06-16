-- Таблица сообщений чата с агентами.
-- Применяется КОМАНДОЙ: npm run db:push

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "read own messages"
  on public.messages for select
  using (auth.uid() = user_id);

create policy "insert own messages"
  on public.messages for insert
  with check (auth.uid() = user_id);

create policy "delete own messages"
  on public.messages for delete
  using (auth.uid() = user_id);
