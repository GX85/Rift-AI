// Amethyst Plus: подписка по коду, лимит сообщений и память ИИ.
import { supabase } from './supabase';

const PLUS_KEY = 'rift_plus';
const USAGE_KEY = 'rift_usage';
const MEM_KEY = 'rift_memory';

// Бесплатно — 50 сообщений на каждую модель. В Plus — без лимита.
export const FREE_LIMIT = 50;
// Память: бесплатно 1 ГБ, в Plus — 20 ГБ (показывается как «запас»).
export const MEM_FREE = 1 * 1024 * 1024 * 1024;
export const MEM_PLUS = 20 * 1024 * 1024 * 1024;

// Коды активации Amethyst Plus (раздаёшь сам). Регистр и пробелы не важны.
export const VALID_CODES = ['RIFT-PLUS', 'TITANIUM-2026', 'GIGABYTE-VIP', 'RIFT-PLUS-FOREVER'];

export function isPlus(): boolean {
  return localStorage.getItem(PLUS_KEY) === '1';
}
// Только локально (например, при загрузке статуса из базы).
export function cachePlus(v: boolean) {
  localStorage.setItem(PLUS_KEY, v ? '1' : '0');
}
// Локально + в Supabase (profiles.is_plus).
export function setPlus(v: boolean) {
  cachePlus(v);
  supabase.auth.getUser().then(({ data }) => {
    if (data.user) {
      supabase.from('profiles').update({ is_plus: v }).eq('id', data.user.id).then(() => {});
    }
  });
}
// Подтянуть статус Plus из базы (синхронизация между устройствами).
export async function syncPlus(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return isPlus();
    const { data: row } = await supabase.from('profiles').select('is_plus').eq('id', data.user.id).single();
    const v = !!row?.is_plus;
    cachePlus(v);
    return v;
  } catch {
    return isPlus();
  }
}
export function redeem(code: string): boolean {
  const c = code.trim().toUpperCase();
  if (VALID_CODES.includes(c)) {
    setPlus(true);
    return true;
  }
  return false;
}

// ── Лимит сообщений (единый) ──
export function getUsage(): number {
  return Number(localStorage.getItem(USAGE_KEY) || '0') || 0;
}
export function incUsage(): number {
  const n = getUsage() + 1;
  localStorage.setItem(USAGE_KEY, String(n));
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
export function saveMemory(items: string[]) {
  localStorage.setItem(MEM_KEY, JSON.stringify(items));
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
