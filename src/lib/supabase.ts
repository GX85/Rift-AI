import { createClient } from '@supabase/supabase-js';

// Ключи берутся из .env.local (локально) и из Vercel → Settings → Environment Variables (на проде).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Понятная ошибка вместо «белого экрана», если ключи забыли вставить.
if (!url || !anonKey) {
  throw new Error(
    'Нет ключей Supabase. Скопируй .env.example → .env.local и вставь VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // Запоминаем вход в браузере и сами обновляем токен — не нужно входить каждый раз.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'rift-auth',
  },
});

// Нужны для прямого вызова Edge-функции при стриминге (invoke не умеет читать поток).
export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;
