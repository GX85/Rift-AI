// Хранилище чатов в Supabase (с локальным кэшем как запасной вариант офлайн).
import { supabase } from './supabase';

export type StoredMessage = { id: string; role: 'user' | 'assistant'; content: string };
export type StoredChat = {
  id: string;
  title: string;
  model: string;
  messages: StoredMessage[];
  updatedAt: number;
};

const CACHE = 'rift_chats_cache';

function readCache(): StoredChat[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE) || '[]');
  } catch {
    return [];
  }
}
function writeCache(chats: StoredChat[]) {
  try {
    localStorage.setItem(CACHE, JSON.stringify(chats));
  } catch {
    /* ignore */
  }
}

// Загрузить чаты из Supabase; при ошибке (офлайн/нет таблицы) — из кэша.
export async function loadChats(): Promise<StoredChat[]> {
  try {
    const { data, error } = await supabase
      .from('chats')
      .select('id, title, model, messages, updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    const chats: StoredChat[] = (data ?? []).map((r) => ({
      id: r.id as string,
      title: (r.title as string) ?? 'Новый чат',
      model: (r.model as string) ?? 'amethyst',
      messages: ((r.messages as StoredMessage[]) ?? []),
      updatedAt: new Date(r.updated_at as string).getTime(),
    }));
    writeCache(chats);
    return chats;
  } catch {
    return readCache();
  }
}

// Сохранить/обновить один чат.
export async function saveChat(c: StoredChat): Promise<void> {
  const cache = readCache().filter((x) => x.id !== c.id);
  writeCache([c, ...cache]);
  try {
    await supabase.from('chats').upsert(
      {
        id: c.id,
        title: c.title,
        model: c.model,
        messages: c.messages,
        updated_at: new Date(c.updatedAt).toISOString(),
      },
      { onConflict: 'id' },
    );
  } catch {
    /* офлайн — останется в кэше до следующего раза */
  }
}

// Удалить чат.
export async function deleteChatRow(id: string): Promise<void> {
  writeCache(readCache().filter((x) => x.id !== id));
  try {
    await supabase.from('chats').delete().eq('id', id);
  } catch {
    /* ignore */
  }
}
