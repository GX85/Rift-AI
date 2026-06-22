-- Amethyst Plus: флаг подписки в профиле. Применяется: npm run db:push
alter table public.profiles add column if not exists is_plus boolean not null default false;
