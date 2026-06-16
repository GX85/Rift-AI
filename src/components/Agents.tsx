import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Chat } from './Chat';

type Agent = {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  created_at: string;
};

type GeneratedAgent = {
  name: string;
  description: string;
  system_prompt: string;
};

const BUILDER_SYSTEM = `Ты — конструктор ИИ-агентов. По желанию пользователя придумай одного агента.
Верни ТОЛЬКО JSON без пояснений и без markdown, в формате:
{"name": "...", "description": "...", "system_prompt": "..."}
- name: короткое имя агента (2-4 слова), по-русски.
- description: одно предложение, что этот агент делает.
- system_prompt: подробная инструкция агенту от второго лица ("ты ..."): его роль,
  характер, стиль общения и правила. Пиши по-русски, 3-6 предложений.`;

function parseAgent(text: string): GeneratedAgent | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    if (!obj.name || !obj.system_prompt) return null;
    return {
      name: String(obj.name),
      description: String(obj.description ?? ''),
      system_prompt: String(obj.system_prompt),
    };
  } catch {
    return null;
  }
}

export function Agents({ userEmail }: { userEmail: string }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [wish, setWish] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const { data, error } = await supabase
      .from('agents')
      .select('id, name, description, system_prompt, created_at')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setAgents(data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  // Если выбран агент — показываем чат
  if (selectedAgent) {
    return <Chat agent={selectedAgent} onBack={() => setSelectedAgent(null)} />;
  }

  async function createAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!wish.trim() || loading) return;
    setLoading(true);
    setError('');

    const { data, error: aiError } = await supabase.functions.invoke('ai', {
      body: { prompt: wish.trim(), system: BUILDER_SYSTEM },
    });
    if (aiError) {
      setError('ИИ не ответил: ' + aiError.message);
      setLoading(false);
      return;
    }

    const generated = parseAgent(String(data?.text ?? ''));
    if (!generated) {
      setError('Не получилось разобрать ответ ИИ. Попробуй переформулировать желание.');
      setLoading(false);
      return;
    }

    const { error: dbError } = await supabase.from('agents').insert({
      name: generated.name,
      description: generated.description,
      system_prompt: generated.system_prompt,
    });
    if (dbError) setError(dbError.message);
    else {
      setWish('');
      load();
    }
    setLoading(false);
  }

  async function remove(id: string) {
    const { error } = await supabase.from('agents').delete().eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  return (
    <section className="card">
      <p className="hello">Привет, {userEmail} 👋</p>
      <h2>Rift AI — создай своего ИИ-агента</h2>
      <p className="empty">
        Опиши словами, какой агент тебе нужен — ИИ сам придумает ему имя и характер.
      </p>

      <form onSubmit={createAgent} className="form-row" style={{ marginTop: 16 }}>
        <input
          placeholder="например: помощник по английскому для подростков"
          value={wish}
          onChange={(e) => setWish(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Создаю…' : 'Создать'}
        </button>
      </form>

      {error && <p className="message">{error}</p>}

      {agents.length === 0 ? (
        <p className="empty">Пока нет агентов. Создай первого 👆</p>
      ) : (
        <ul className="list">
          {agents.map((a) => (
            <li key={a.id}>
              <div className="agent-info">
                <strong>{a.name}</strong>
                {a.description && <span className="agent-desc">{a.description}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="small" onClick={() => setSelectedAgent(a)}>
                  Чат
                </button>
                <button className="ghost small" onClick={() => remove(a.id)}>
                  удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
