import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { avatarFor } from '../lib/avatar';
import { Markdown } from './Markdown';

type Agent = {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

// Собираем «умный» system prompt: личность агента + общие правила мышления + контекст (дата).
// Это добавляет интеллект КАЖДОМУ агенту, не меняя его характер.
function buildSystem(agent: Agent): string {
  const today = new Date().toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `${agent.system_prompt}

— — — Общие правила (соблюдай всегда) — — —
• Думай пошагово, прежде чем отвечать; для сложного — рассуждай по шагам.
• Будь точным: не выдумывай факты. Не уверен — честно скажи об этом.
• Если вопрос неясен или не хватает данных — задай один короткий уточняющий вопрос.
• Отвечай по делу и структурно: списки, примеры, короткие абзацы. Без воды.
• Помни весь предыдущий разговор и опирайся на него.
• Сегодня ${today}. Отвечай на языке собеседника.`;
}

export function Chat({ agent, onBack }: { agent: Agent; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const av = avatarFor(agent.id);

  useEffect(() => {
    supabase
      .from('messages')
      .select('id, role, content')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => setMessages((data as Message[]) ?? []));
  }, [agent.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    setError('');

    const { data: userMsg } = await supabase
      .from('messages')
      .insert({ agent_id: agent.id, role: 'user', content: text })
      .select('id, role, content')
      .single();
    if (userMsg) setMessages((prev) => [...prev, userMsg as Message]);

    const history = messages.map((m) => ({ role: m.role, text: m.content }));
    const { data: aiData, error: aiError } = await supabase.functions.invoke('ai', {
      body: { prompt: text, system: buildSystem(agent), history, temperature: 0.8 },
    });

    if (aiError || aiData?.error || !aiData?.text) {
      setError(aiData?.error ? 'Агент: ' + aiData.error : 'Агент не ответил. Попробуй ещё раз.');
      setSending(false);
      return;
    }

    const { data: botMsg } = await supabase
      .from('messages')
      .insert({ agent_id: agent.id, role: 'assistant', content: aiData.text })
      .select('id, role, content')
      .single();
    if (botMsg) setMessages((prev) => [...prev, botMsg as Message]);

    setSending(false);
  }

  return (
    <section className="card chat-card">
      <div className="chat-header">
        <button className="back-btn" onClick={onBack} title="Назад">
          ←
        </button>
        <div className="avatar" style={{ background: av.gradient }}>
          {av.emoji}
        </div>
        <div>
          <div className="chat-title">{agent.name}</div>
          {agent.description && <div className="chat-sub">{agent.description}</div>}
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !sending && (
          <div className="chat-empty">
            <div className="big">{av.emoji}</div>
            <p>Начни разговор — напиши что-нибудь 👇</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`bubble bubble-${m.role}`}>
            {m.role === 'assistant' ? <Markdown text={m.content} /> : m.content}
          </div>
        ))}
        {sending && (
          <div className="bubble bubble-assistant typing">
            <span className="dots">
              <span>•</span>
              <span>•</span>
              <span>•</span>
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="message" style={{ padding: '0 16px' }}>{error}</p>}

      <form onSubmit={send} className="chat-form">
        <input
          placeholder={`Сообщение для «${agent.name}»…`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()}>
          {sending ? '…' : 'Отправить'}
        </button>
      </form>
    </section>
  );
}
