import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

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

export function Chat({ agent, onBack }: { agent: Agent; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

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

    // Сохраняем сообщение пользователя в базу
    const { data: userMsg } = await supabase
      .from('messages')
      .insert({ agent_id: agent.id, role: 'user', content: text })
      .select('id, role, content')
      .single();
    if (userMsg) setMessages((prev) => [...prev, userMsg as Message]);

    // Передаём историю диалога в Gemini
    const history = messages.map((m) => ({ role: m.role, text: m.content }));
    const { data: aiData, error: aiError } = await supabase.functions.invoke('ai', {
      body: { prompt: text, system: agent.system_prompt, history },
    });

    if (aiError || !aiData?.text) {
      setError('Агент не ответил. Попробуй ещё раз.');
      setSending(false);
      return;
    }

    // Сохраняем ответ агента в базу
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
        <button className="ghost" onClick={onBack}>
          ← Назад
        </button>
        <div>
          <strong>{agent.name}</strong>
          {agent.description && <p className="chat-desc">{agent.description}</p>}
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !sending && (
          <p className="empty" style={{ textAlign: 'center', marginTop: 32 }}>
            Начни разговор — напиши что-нибудь 👇
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`bubble bubble-${m.role}`}>
            {m.content}
          </div>
        ))}
        {sending && <div className="bubble bubble-assistant typing">Думаю…</div>}
        <div ref={bottomRef} />
      </div>

      {error && <p className="message">{error}</p>}

      <form onSubmit={send} className="form-row chat-form">
        <input
          placeholder="Напиши сообщение…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button type="submit" disabled={sending}>
          {sending ? '…' : 'Отправить'}
        </button>
      </form>
    </section>
  );
}
