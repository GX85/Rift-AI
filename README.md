# 💎 Amethyst AI

Умный ИИ-ассистент в одном чате: код, объяснения, идеи, отладка. Плюс — генерация сайтов и игр,
память о пользователе, озвучка, темы и десктоп-агент с доступом к ПК.

Стек: **Vite + React + TypeScript + Supabase + Gemini**. Десктоп — **Electron**.

---

## ✅ Запуск

1. **Установи зависимости.**
   ```bash
   npm install
   ```

2. **Вставь ключи.** Скопируй `.env.example` → `.env.local` и заполни:
   ```
   VITE_SUPABASE_URL=https://твой-проект.supabase.co
   VITE_SUPABASE_ANON_KEY=твой-anon-ключ
   VITE_GEMINI_API_KEY=твой-ключ-gemini   # https://aistudio.google.com/apikey
   ```
   ⚠️ `.env.local` не коммить — он в `.gitignore`.

3. **Создай таблицы в Supabase (миграциями).**
   ```bash
   npm run db:login    # вход в браузере
   npm run db:link     # выбери свой проект
   npm run db:push     # применит supabase/migrations/*
   ```

4. **Запусти локально.**
   ```bash
   npm run dev
   ```
   Открой `http://localhost:5173`, войди через Google и пиши Amethyst.

5. **Деплой (Vercel).** Подключи репозиторий, добавь те же переменные окружения → Deploy.

---

## 🖥️ Десктоп-версия (агент с доступом к ПК)

```bash
npm run desktop          # дев-режим (Vite + Electron)
npm run desktop:build    # сборка .exe (Windows)
```

В десктопе Amethyst может выполнять команды, читать/писать файлы и смотреть папки через инструменты
(`run_command`, `read_file`, `write_file`, `list_dir`). Каждое выполнение команды и запись файла
требуют подтверждения. ⚠️ Это мощный доступ к системе — запускай только то, чему доверяешь.

---

## ✦ Amethyst Plus

Plus открывает функции: без лимита сообщений, генерация сайтов и игр, память, озвучка, темы, файлы,
длинные ответы. Активируется кодом.

- Лимит сообщений, статус Plus и память хранятся в базе (`profiles`) и привязаны к аккаунту.
- Коды активации лежат в таблице `public.plus_codes` и проверяются серверной функцией
  `redeem_plus_code` — в коде фронта их нет. Добавить/выключить код:
  Текущие коды: `It'sAmethyst`, `AmethystAI`, `AmethystPlus` (вводятся в любом регистре).
  ```sql
  -- коды храним заглавными: сравнение идёт через upper()
  insert into public.plus_codes (code) values ('МОЙ-КОД');
  update public.plus_codes set active = false where code = 'AMETHYSTAI';
  ```

---

## 📂 Что где лежит

| Путь | Что это |
|------|---------|
| `src/App.tsx` | Корень: лендинг / чат, профиль |
| `src/components/Workspace.tsx` | Главный экран чата и все модалки (Plus, память, сайты, игры) |
| `src/components/Auth.tsx` | Лендинг и вход через Google |
| `src/lib/gemini.ts` | Вызовы Gemini: стриминг чата и агентный цикл с инструментами |
| `src/lib/account.ts` | Plus, лимит, память (сервер + локальный кэш) |
| `src/lib/chatsStore.ts` | Чаты в Supabase + локальный кэш |
| `supabase/migrations/` | Таблицы базы (`npm run db:push`) |
| `supabase/functions/ai/` | Edge-функция AI (запасной серверный путь к Gemini) |
| `electron/` | Десктоп-оболочка и мост к ПК |

---

## 🆘 Если сломалось

- **Белый экран про ключи** → не заполнил `.env.local` (шаг 2).
- **Чат не отвечает** → нет `VITE_GEMINI_API_KEY` или исчерпана квота ключа.
- **Чаты/память не сохраняются между устройствами** → не сделал `npm run db:push` (шаг 3).
- **Код Plus не активируется** → код не добавлен в `plus_codes` или миграция не применена.
