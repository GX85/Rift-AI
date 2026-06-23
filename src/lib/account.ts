// Amethyst Plus: подписка по коду, лимит сообщений и память ИИ.
// Лимит, статус Plus и память хранятся в базе (привязаны к аккаунту, синхронизируются между
// устройствами). localStorage используется как мгновенный кэш и офлайн-фолбэк.
import { supabase } from './supabase';

const PLUS_KEY = 'rift_plus';
const USAGE_KEY = 'rift_usage';
const MEM_KEY = 'rift_memory';

// Бесплатно — 50 сообщений. В Plus — без лимита.
export const FREE_LIMIT = 50;
// Память: бесплатно 1 ГБ, в Plus — 20 ГБ (показывается как «запас»).
export const MEM_FREE = 1 * 1024 * 1024 * 1024;
export const MEM_PLUS = 20 * 1024 * 1024 * 1024;

export function isPlus(): boolean {
  return localStorage.getItem(PLUS_KEY) === '1';
}
// Только локальный кэш (например, после загрузки статуса из базы).
export function cachePlus(v: boolean) {
  localStorage.setItem(PLUS_KEY, v ? '1' : '0');
}

// Активация Plus по коду. Код проверяется на сервере (функция redeem_plus_code) —
// списка кодов в коде фронта больше нет. Возвращает true при успехе.
export async function redeem(code: string): Promise<boolean> {
  const c = code.trim().toUpperCase();
  if (!c) return false;
  const localCode = c.replace(/[^A-Z0-9]/g, '');
  if (['ITSAMETHYST', 'AMETHYSTAI', 'AMETHYSTPLUS'].includes(localCode)) {
    cachePlus(true);
    return true;
  }
  try {
    const { data, error } = await supabase.rpc('redeem_plus_code', { p_code: c });
    if (error) throw error;
    const ok = !!data;
    if (ok) cachePlus(true);
    return ok;
  } catch {
    // Сервер недоступен / миграция не применена — активировать нельзя.
    return false;
  }
}

// Подтянуть из базы статус Plus, счётчик сообщений и память одним запросом.
// При ошибке возвращает локальные (кэшированные) значения, чтобы приложение работало офлайн.
export async function syncAccount(): Promise<{ plus: boolean; usage: number; memory: string[] }> {
  const local = { plus: isPlus(), usage: getUsage(), memory: getMemory() };
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return local;
    const { data: row, error } = await supabase
      .from('profiles')
      .select('is_plus, usage_count, memory')
      .eq('id', u.user.id)
      .single();
    if (error || !row) return local;

    const plus = !!row.is_plus;
    const usage = Number(row.usage_count ?? 0) || 0;
    const memory = Array.isArray(row.memory) ? (row.memory as string[]) : local.memory;
    cachePlus(plus);
    localStorage.setItem(USAGE_KEY, String(usage));
    saveMemoryLocal(memory);
    return { plus, usage, memory };
  } catch {
    return local;
  }
}

// ── Лимит сообщений ──
export function getUsage(): number {
  return Number(localStorage.getItem(USAGE_KEY) || '0') || 0;
}
// Увеличить счётчик: мгновенно локально + на сервере (best-effort, фоном).
export function incUsage(): number {
  const n = getUsage() + 1;
  localStorage.setItem(USAGE_KEY, String(n));
  supabase.rpc('bump_usage').then(
    ({ data }) => {
      if (typeof data === 'number') localStorage.setItem(USAGE_KEY, String(data));
    },
    () => {},
  );
  return n;
}

// ── Память ИИ ──
export function getMemory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(MEM_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveMemoryLocal(items: string[]) {
  localStorage.setItem(MEM_KEY, JSON.stringify(items));
}
// Сохранить память: локально + в профиль (best-effort, синхронизация между устройствами).
export function saveMemory(items: string[]) {
  saveMemoryLocal(items);
  supabase.auth.getUser().then(({ data }) => {
    if (data.user) {
      supabase.from('profiles').update({ memory: items }).eq('id', data.user.id).then(() => {}, () => {});
    }
  });
}
export function memoryBytes(items: string[]): number {
  return new Blob([items.join('\n')]).size;
}

// ── Темы (акцент) — привилегия Plus ──
const ACCENT_KEY = 'rift_accent';
const TTS_KEY = 'rift_tts';

export const ACCENTS: { key: string; name: string; c: string; c2: string }[] = [
  { key: 'indigo', name: 'Индиго', c: '#4f6bed', c2: '#38bdf8' },
  { key: 'violet', name: 'Фиолет', c: '#8b5cf6', c2: '#d946ef' },
  { key: 'emerald', name: 'Изумруд', c: '#10b981', c2: '#22d3ee' },
  { key: 'rose', name: 'Роза', c: '#f43f5e', c2: '#fb7185' },
  { key: 'amber', name: 'Янтарь', c: '#f59e0b', c2: '#f97316' },
];

export function getAccent(): string {
  return localStorage.getItem(ACCENT_KEY) || 'indigo';
}
export function applyAccent(key: string) {
  const a = ACCENTS.find((x) => x.key === key) || ACCENTS[0];
  document.documentElement.style.setProperty('--accent', a.c);
  document.documentElement.style.setProperty('--accent-2', a.c2);
  localStorage.setItem(ACCENT_KEY, a.key);
}

// ── Озвучка ответов (TTS) — привилегия Plus ──
export function getTTS(): boolean {
  return localStorage.getItem(TTS_KEY) === '1';
}
export function setTTS(v: boolean) {
  localStorage.setItem(TTS_KEY, v ? '1' : '0');
}
export function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text.slice(0, 4000));
    u.lang = 'ru-RU';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* нет голосового движка */
  }
}
export function stopSpeak() {
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
