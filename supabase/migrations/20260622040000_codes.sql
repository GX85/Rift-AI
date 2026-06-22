-- Обновление кодов активации Plus: убираем старые (в т.ч. все RIFT-*), ставим свои.
-- Применяется КОМАНДОЙ: npm run db:push
-- Коды храним заглавными — функция redeem_plus_code сравнивает через upper().

delete from public.plus_codes
  where code in ('RIFT-PLUS', 'TITANIUM-2026', 'GIGABYTE-VIP', 'RIFT-PLUS-FOREVER');

insert into public.plus_codes (code) values
  ('IT''SAMETHYST'),
  ('AMETHYSTAI'),
  ('AMETHYSTPLUS')
on conflict (code) do nothing;
