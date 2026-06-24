import { useEffect, useMemo, useRef, useState } from 'react';
import { Markdown } from './Markdown';
import { AmethystLogo } from './Gems';
import { Icon } from './Icons';
import { streamGemini } from '../lib/gemini';
import { deleteChatRow, loadChats, saveChat } from '../lib/chatsStore';

type Message = { id: string; role: 'user' | 'assistant'; content: string };
type Chat = { id: string; title: string; messages: Message[]; updatedAt: number };
type AttachedFile = { name: string; content: string };

type Props = {
  name: string;
  email: string;
  avatar: string;
  onSignOut: () => void;
  onHome: () => void;
};

const ACTIVE_KEY = 'amethyst_code_active';

const STARTERS = [
  'Создай адаптивный лендинг одним HTML-файлом',
  'Проведи code review этого React-компонента',
  'Исправь ошибку TypeScript и объясни причину',
  'Собери web-app прототип с мок-данными',
];

const MOBILE_ACTIONS = [
  { label: 'Сайт', prompt: 'Создай современный адаптивный сайт одним HTML-файлом. Тема: ' },
  { label: 'Баг', prompt: 'Помоги исправить баг. Вот ошибка и код:\n\n' },
  { label: 'Review', prompt: 'Проведи code review. Найди баги, риски и дай исправления:\n\n' },
  { label: 'React', prompt: 'Создай React + TypeScript компонент: ' },
];

function newChat(): Chat {
  return { id: crypto.randomUUID(), title: 'Новый чат', messages: [], updatedAt: Date.now() };
}

function titleFrom(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 46) || 'Новый чат';
}

function buildSystem() {
  return `Ты — Amethyst Code, coding assistant на базе Gemini.

Главная роль: помогать с разработкой, как Codex/Claude for code.

Правила:
• Отвечай конкретно и инженерно, без воды.
• Если просят код — давай рабочий код, а не общие советы.
• Для сайтов и лендингов выдавай один полный HTML-файл с <!doctype html>, CSS внутри <style>, JS внутри <script> если нужен.
• Сайты должны быть адаптивными: nav, hero, CTA, полезные секции, footer, mobile layout, hover/focus states, без горизонтального скролла.
• Не используй CDN, внешние картинки и библиотеки, если пользователь сам не попросил.
• Для React/TypeScript используй строгие типы, без any, с нормальными состояниями loading/empty/error.
• Если пользователь прислал ошибку — сначала причина, потом точный фикс, потом как проверить.
• Если данных мало — задай максимум один вопрос или сделай разумное допущение.
• Для нескольких файлов пиши путь файла перед каждым code block.
• Проверяй код перед ответом: импорты, переменные, JSX, CSS, адаптив, edge cases.

Формат:
1. Короткий результат/диагноз.
2. Код в markdown-блоках.
3. Минимально: как запустить/проверить.`;
}

export function CodeWorkspace({ name, email, avatar, onSignOut, onHome }: Props) {
  const initial = useMemo(() => newChat(), []);
  const [chats, setChats] = useState<Chat[]>([initial]);
  const [activeId, setActiveId] = useState(initial.id);
  const [input, setInput] = useState(() => {
    const wish = localStorage.getItem('rift_wish');
    if (wish) localStorage.removeItem('rift_wish');
    return wish ?? '';
  });
  const [attached, setAttached] = useState<AttachedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const active = chats.find((chat) => chat.id === activeId) ?? chats[0];
  const messages = active?.messages ?? [];

  useEffect(() => {
    let alive = true;
    loadChats().then((stored) => {
      if (!alive || stored.length === 0) return;
      const next: Chat[] = stored.map((chat) => ({
        id: chat.id,
        title: chat.title,
        messages: chat.messages,
        updatedAt: chat.updatedAt,
      }));
      setChats(next);
      const saved = localStorage.getItem(ACTIVE_KEY);
      setActiveId(saved && next.some((chat) => chat.id === saved) ? saved : next[0].id);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  function createChat() {
    const chat = newChat();
    setChats((prev) => [chat, ...prev]);
    setActiveId(chat.id);
    setInput('');
    setAttached(null);
    setError('');
    setSidebarOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function selectChat(id: string) {
    setActiveId(id);
    setSidebarOpen(false);
    setError('');
  }

  function removeChat(id: string) {
    deleteChatRow(id);
    setChats((prev) => {
      const left = prev.filter((chat) => chat.id !== id);
      const next = left.length ? left : [newChat()];
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
  }

  function applyChat(chatId: string, fn: (chat: Chat) => Chat) {
    setChats((prev) => prev.map((chat) => (chat.id === chatId ? fn(chat) : chat)));
  }

  async function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAttached({ name: file.name, content: (await file.text()).slice(0, 24000) });
  }

  function grow(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function submit(raw: string) {
    const text = raw.trim();
    if (!text || busy || !active) return;

    const file = attached;
    const userContent = file ? `${text}\n\n📎 ${file.name}` : text;
    const prompt = file ? `${text}\n\n--- File: ${file.name} ---\n${file.content}` : text;
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: userContent };
    const assistantId = crypto.randomUUID();
    const baseMessages = [...messages, userMessage];
    const firstTitle = messages.length === 0 ? titleFrom(text) : active.title;
    const controller = new AbortController();

    setInput('');
    setAttached(null);
    setBusy(true);
    setError('');
    abortRef.current = controller;
    if (inputRef.current) inputRef.current.style.height = 'auto';

    applyChat(active.id, (chat) => ({
      ...chat,
      title: firstTitle,
      messages: [...baseMessages, { id: assistantId, role: 'assistant', content: '' }],
      updatedAt: Date.now(),
    }));

    let full = '';
    try {
      for await (const chunk of streamGemini({
        system: buildSystem(),
        history: messages.map((message) => ({ role: message.role, text: message.content })),
        prompt,
        temperature: 0.25,
        maxTokens: 8192,
        signal: controller.signal,
      })) {
        full += chunk;
        applyChat(active.id, (chat) => ({
          ...chat,
          messages: chat.messages.map((message) =>
            message.id === assistantId ? { ...message, content: full } : message,
          ),
          updatedAt: Date.now(),
        }));
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Ошибка ответа AI.');
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }

    if (full.trim()) {
      const savedMessages = [...baseMessages, { id: assistantId, role: 'assistant' as const, content: full }];
      await saveChat({
        id: active.id,
        title: firstTitle,
        model: 'amethyst-code',
        messages: savedMessages,
        updatedAt: Date.now(),
      });
    }
  }

  async function copyMessage(message: Message) {
    await navigator.clipboard?.writeText(message.content);
    setCopiedId(message.id);
    window.setTimeout(() => setCopiedId((current) => (current === message.id ? null : current)), 1400);
  }

  function useStarter(text: string) {
    setInput(text);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className="acode">
      {sidebarOpen && <button className="acode-scrim" aria-label="Закрыть меню" onClick={() => setSidebarOpen(false)} />}

      <aside className={`acode-side ${sidebarOpen ? 'open' : ''}`}>
        <div className="acode-brand">
          <button className="acode-logo" onClick={onHome} title="На главный экран">
            <AmethystLogo size={34} />
            <span>Amethyst Code</span>
          </button>
          <button className="acode-icon mobile-only" onClick={() => setSidebarOpen(false)} title="Закрыть">
            <Icon name="x" size={16} />
          </button>
        </div>

        <button className="acode-new" onClick={createChat}>
          <Icon name="plus" size={16} /> Новый чат
        </button>

        <div className="acode-side-title">История</div>
        <div className="acode-chat-list">
          {chats.map((chat) => (
            <button
              key={chat.id}
              className={`acode-chat-item ${chat.id === activeId ? 'active' : ''}`}
              onClick={() => selectChat(chat.id)}
            >
              <span>{chat.title}</span>
              <i
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  removeChat(chat.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') removeChat(chat.id);
                }}
              >
                <Icon name="trash" size={13} />
              </i>
            </button>
          ))}
        </div>

        <div className="acode-user">
          {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : <b>{name.slice(0, 1).toUpperCase()}</b>}
          <div>
            <strong>{name}</strong>
            <span>{email || 'guest'}</span>
          </div>
          <button className="acode-icon" onClick={onSignOut} title="Выйти">
            <Icon name="logout" size={16} />
          </button>
        </div>
      </aside>

      <main className="acode-main">
        <header className="acode-top">
          <button className="acode-icon mobile-only" onClick={() => setSidebarOpen(true)} title="Меню">
            ☰
          </button>
          <div className="acode-model">
            <AmethystLogo size={30} />
            <div>
              <strong>Amethyst Code</strong>
              <span>{messages.length ? active.title : 'Gemini-powered coding assistant'}</span>
            </div>
          </div>
          <button className="acode-icon" onClick={createChat} title="Новый чат">
            <Icon name="plus" size={16} />
          </button>
        </header>

        <section className="acode-thread" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="acode-empty">
              <AmethystLogo size={78} />
              <span className="acode-empty-kicker">Code assistant</span>
              <h1>Что строим?</h1>
              <p>Пиши задачу, вставляй ошибку или прикрепляй файл. Сайты, компоненты и web-app прототипы генерируются прямо в чате.</p>
              <div className="acode-starters">
                {STARTERS.map((starter) => (
                  <button key={starter} onClick={() => useStarter(starter)}>
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <article key={message.id} className={`acode-msg ${message.role}`}>
                <div className="acode-msg-avatar">
                  {message.role === 'assistant' ? <AmethystLogo size={24} /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="acode-msg-body">
                  {message.content ? <Markdown text={message.content} /> : <span className="acode-dots">Amethyst думает...</span>}
                  {message.content && (
                    <button className="acode-copy" onClick={() => copyMessage(message)}>
                      {copiedId === message.id ? 'скопировано' : 'копировать'}
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </section>

        <footer className="acode-compose-wrap">
          <div className="acode-mobile-actions" aria-label="Быстрые команды">
            {MOBILE_ACTIONS.map((action) => (
              <button key={action.label} type="button" onClick={() => useStarter(action.prompt)}>
                {action.label}
              </button>
            ))}
          </div>
          {error && <div className="acode-error">{error}</div>}
          {attached && (
            <div className="acode-file">
              <span>📎 {attached.name}</span>
              <button onClick={() => setAttached(null)}>убрать</button>
            </div>
          )}
          <form
            className="acode-compose"
            onSubmit={(event) => {
              event.preventDefault();
              void submit(input);
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                grow(event.target);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submit(input);
                }
              }}
              placeholder="Опиши сайт, компонент, ошибку или приложение..."
              rows={1}
              disabled={busy}
            />
            <div className="acode-compose-actions">
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.json,.js,.jsx,.ts,.tsx,.css,.html,.py,.sql"
                onChange={(event) => void pickFile(event)}
              />
              <button type="button" className="acode-icon" onClick={() => fileRef.current?.click()} title="Файл">
                <Icon name="attach" size={16} />
              </button>
              <span />
              {busy ? (
                <button type="button" className="acode-send stop" onClick={stop}>
                  ■
                </button>
              ) : (
                <button type="submit" className="acode-send" disabled={!input.trim()}>
                  <Icon name="send" size={17} />
                </button>
              )}
            </div>
          </form>
        </footer>
      </main>
    </div>
  );
}
