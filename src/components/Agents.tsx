import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { avatarFor } from '../lib/avatar';
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

const BUILDER_SYSTEM = `Ты — конструктор ИИ-агентов экспертного уровня. По желанию пользователя
спроектируй одного умного, полезного агента. Верни ТОЛЬКО JSON без пояснений и без markdown:
{"name": "...", "description": "...", "system_prompt": "..."}

- name: короткое запоминающееся имя (2-4 слова), по-русски.
- description: одно предложение — что агент делает и для кого.
- system_prompt: подробная инструкция агенту от второго лица ("ты ..."). Сделай его по-настоящему
  умным и полезным. Обязательно опиши:
  1) РОЛЬ И ЭКСПЕРТИЗА — кто он и в чём глубоко разбирается;
  2) ХАРАКТЕР И СТИЛЬ — как общается (тон, длина ответов, эмодзи или нет);
  3) КАК ДУМАЕТ — разбивает сложное на шаги, объясняет на примерах, не выдумывает факты,
     а если не уверен — честно говорит об этом;
  4) ПРАВИЛА — задаёт уточняющий вопрос, если задача неясна; отвечает по делу, без воды;
     держится своей роли и не уходит в сторону.
  Пиши по-русски, живым языком, 6-10 предложений. Это «мозг» агента — чем точнее, тем умнее агент.`;

// Примеры-подсказки для быстрого старта.
const IDEAS = [
  'помощник по английскому для подростков',
  'строгий тренер по продуктивности',
  'весёлый рассказчик историй',
  'эксперт по React и коду',
];

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
      setError('Ошибка: ' + aiError.message);
      setLoading(false);
      return;
    }
    if (data?.error) {
      setError('Ошибка ИИ: ' + data.error);
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

  async function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const { error } = await supabase.from('agents').delete().eq('id', id);
    if (error) setError(error.message);
    else load();
  }

  return (
    <section className="card">
      <p className="hello">Привет, {userEmail}</p>
      <h2>Создай своего ИИ-агента ✨</h2>
      <p className="subtitle">
        Опиши словами, какой агент тебе нужен — Rift AI сам придумает ему имя, характер и
        способности.
      </p>

      <form onSubmit={createAgent} className="form-row">
        <input
          placeholder="например: помощник по английскому…"
          value={wish}
          onChange={(e) => setWish(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? <span className="spinner" /> : null}
          {loading ? 'Создаю…' : 'Создать'}
        </button>
      </form>

      {/* Быстрые идеи */}
      {!wish && (
        <div className="ideas">
          {IDEAS.map((idea) => (
            <button
              key={idea}
              type="button"
              className="idea-chip"
              onClick={() => setWish(idea)}
              disabled={loading}
            >
              {idea}
            </button>
          ))}
        </div>
      )}

      {error && <p className="message">{error}</p>}

      <div className="section-label">
        <span>Мои агенты</span>
        <span className="count-pill">{agents.length}</span>
      </div>

      {agents.length === 0 ? (
        <p className="empty">
          Пока нет агентов.
          <br />
          Опиши идею выше и создай первого 👆
        </p>
      ) : (
        <div className="grid">
          {agents.map((a) => {
            const av = avatarFor(a.id);
            return (
              <div key={a.id} className="agent-card" onClick={() => setSelectedAgent(a)}>
                <div className="agent-card-top">
                  <div className="avatar" style={{ background: av.gradient }}>
                    {av.emoji}
                  </div>
                  <div className="agent-name">{a.name}</div>
                </div>
                {a.description && <div className="agent-desc">{a.description}</div>}
                <div className="agent-actions">
                  <button className="outline small grow" onClick={() => setSelectedAgent(a)}>
                    Открыть чат
                  </button>
                  <button
                    className="icon-btn"
                    title="Удалить"
                    onClick={(e) => remove(a.id, e)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
