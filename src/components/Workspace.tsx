import { useEffect, useMemo, useRef, useState } from 'react';
import { Markdown } from './Markdown';
import { AmethystLogo } from './Gems';
import { Icon } from './Icons';
import { streamGemini, runAgent, hasDesktop } from '../lib/gemini';
import { loadChats, saveChat, deleteChatRow } from '../lib/chatsStore';
import {
  isPlus,
  redeem,
  syncPlus,
  getUsage,
  incUsage,
  FREE_LIMIT,
  getMemory,
  saveMemory,
  memoryBytes,
  MEM_FREE,
  MEM_PLUS,
  ACCENTS,
  getAccent,
  applyAccent,
  getTTS,
  setTTS,
  speak,
} from '../lib/account';

type Message = { id: string; role: 'user' | 'assistant'; content: string };
type Chat = { id: string; title: string; messages: Message[]; updatedAt: number };

// Единственная модель — Amethyst (мульти-возможности в одной модели).
const RIFT = {
  name: 'Amethyst',
  tagline: 'Умный ИИ для любых задач',
  temperature: 0.7,
  persona:
    'Ты — Amethyst, мощный универсальный ИИ-ассистент: пишешь код, объясняешь, отлаживаешь баги, ' +
    'придумываешь идеи и тексты. Отвечай точно, по делу и структурно.',
  suggests: ['Напиши функцию на Python', 'Объясни этот код', 'Найди баг в моей функции', 'Придумай идею для проекта'],
};

// Инструменты доступны, когда Amethyst работает в десктоп-версии (управление ПК).
const DESKTOP_NOTE =
  '\n\nУ тебя есть доступ к компьютеру через инструменты (run_command, read_file, write_file, list_dir): ' +
  'РЕАЛЬНО выполняй задачи сам — создавай файлы, запускай скрипты, ищи по папкам. Сначала действуй, потом поясни.';

const ACTIVE_KEY = 'rift_active_v2';

function buildSystem(memory: string[]): string {
  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const mem = memory.length
    ? `\n\nДолговременная память о пользователе (учитывай это):\n${memory.map((m) => '• ' + m).join('\n')}`
    : '';
  const tools = hasDesktop() ? DESKTOP_NOTE : '';
  return `${RIFT.persona}${tools}${mem}

Общие правила:
• Думай по шагам; не выдумывай факты, не уверен — скажи честно.
• Отвечай по делу: списки, примеры, код в блоках. Без воды.
• Помни весь разговор. Сегодня ${today}. Отвечай на языке собеседника.`;
}

function newChatObj(): Chat {
  return { id: crypto.randomUUID(), title: 'Новый чат', messages: [], updatedAt: Date.now() };
}

function stripFences(s: string): string {
  return s.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
}

export function Workspace({
  name,
  email,
  avatar,
  onSignOut,
  onHome,
}: {
  name: string;
  email: string;
  avatar: string;
  onSignOut: () => void;
  onHome: () => void;
}) {
  const initial = useMemo(() => newChatObj(), []);
  const [chats, setChats] = useState<Chat[]>([initial]);
  const [activeId, setActiveId] = useState<string>(initial.id);
  const [input, setInput] = useState(() => {
    const wish = localStorage.getItem('rift_wish');
    if (wish) localStorage.removeItem('rift_wish');
    return wish ?? '';
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  // Amethyst Plus
  const [plus, setPlusState] = useState(isPlus());
  const [usage, setUsage] = useState(getUsage());
  const [showPlus, setShowPlus] = useState(false);
  const [code, setCode] = useState('');
  const [codeMsg, setCodeMsg] = useState('');
  // Память
  const [memory, setMemoryState] = useState<string[]>(getMemory());
  const [showMemory, setShowMemory] = useState(false);
  const [memInput, setMemInput] = useState('');
  // Сайты (Plus)
  const [showSite, setShowSite] = useState(false);
  const [siteWish, setSiteWish] = useState('');
  const [siteHtml, setSiteHtml] = useState('');
  const [siteBusy, setSiteBusy] = useState(false);
  const [siteErr, setSiteErr] = useState('');
  // Игры (Plus)
  const [showGame, setShowGame] = useState(false);
  const [gameWish, setGameWish] = useState('');
  const [gameHtml, setGameHtml] = useState('');
  const [gameBusy, setGameBusy] = useState(false);
  const [gameErr, setGameErr] = useState('');
  // Темы и озвучка (Plus)
  const [accent, setAccentState] = useState(getAccent());
  const [tts, setTtsState] = useState(getTTS());
  // Файл (Plus)
  const [attached, setAttached] = useState<{ name: string; content: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [showDown, setShowDown] = useState(false);

  const active = chats.find((c) => c.id === activeId) ?? chats[0];
  const messages = active?.messages ?? [];
  const empty = messages.length === 0 && !sending;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? chats.filter((c) => c.title.toLowerCase().includes(q)) : chats;
  }, [chats, search]);

  useEffect(() => {
    let alive = true;
    loadChats().then((loaded) => {
      if (!alive || loaded.length === 0) return;
      const typed: Chat[] = loaded.map((c) => ({ id: c.id, title: c.title, messages: c.messages, updatedAt: c.updatedAt }));
      setChats(typed);
      const saved = localStorage.getItem(ACTIVE_KEY);
      setActiveId(saved && typed.some((c) => c.id === saved) ? saved : typed[0].id);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId]);
  useEffect(() => {
    syncPlus().then((v) => setPlusState(v));
  }, []);
  useEffect(() => {
    applyAccent(accent);
  }, [accent]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  function updateActive(fn: (c: Chat) => Chat) {
    setChats((prev) => prev.map((c) => (c.id === active.id ? fn(c) : c)));
  }
  function newChat() {
    const c = newChatObj();
    setChats((prev) => [c, ...prev]);
    setActiveId(c.id);
    setInput('');
    setError('');
    setSidebarOpen(false);
  }
  function selectChat(id: string) {
    setActiveId(id);
    setError('');
    setSidebarOpen(false);
  }
  function deleteChat(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    deleteChatRow(id);
    setChats((prev) => {
      const left = prev.filter((c) => c.id !== id);
      const next = left.length ? left : [newChatObj()];
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }
  function renameChat(id: string, title: string) {
    const t = title.trim() || 'Новый чат';
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title: t } : c)));
    const c = chats.find((x) => x.id === id);
    if (c && c.messages.length) saveChat({ id: c.id, title: t, model: 'rift', messages: c.messages, updatedAt: c.updatedAt });
    setEditingId(null);
  }
  function clearAll() {
    if (!confirm('Удалить все чаты? Это нельзя отменить.')) return;
    chats.forEach((c) => deleteChatRow(c.id));
    const c = newChatObj();
    setChats([c]);
    setActiveId(c.id);
    setShowSettings(false);
  }

  function redeemCode() {
    if (redeem(code)) {
      setPlusState(true);
      setCodeMsg('✓ Amethyst Plus активирован! Все функции открыты.');
      setCode('');
    } else {
      setCodeMsg('Неверный код. Проверь и попробуй снова.');
    }
  }
  function addMemory() {
    const t = memInput.trim();
    if (!t) return;
    const next = [...memory, t];
    setMemoryState(next);
    saveMemory(next);
    setMemInput('');
  }
  function removeMemory(i: number) {
    const next = memory.filter((_, idx) => idx !== i);
    setMemoryState(next);
    saveMemory(next);
  }

  async function genHtml(kind: 'site' | 'game', wish: string) {
    const sys =
      kind === 'site'
        ? 'Ты генерируешь сайты. Верни ТОЛЬКО одну полную HTML-страницу (один файл) со встроенными CSS и JS. ' +
          'Без markdown, без пояснений, начни сразу с <!DOCTYPE html>. Современный адаптивный дизайн.'
        : 'Ты генерируешь игры. Верни ТОЛЬКО одну полную HTML-страницу (один файл) с играбельной 2D-игрой на ' +
          'HTML5 Canvas + JavaScript (управление, счёт, рестарт). Без markdown, без пояснений, начни с <!DOCTYPE html>.';
    let full = '';
    for await (const chunk of streamGemini({ system: sys, history: [], prompt: wish, temperature: 0.7, maxTokens: 8192 })) {
      full += chunk;
    }
    full = stripFences(full);
    if (!/<\w/.test(full)) throw new Error('Модель не вернула HTML. Попробуй переформулировать запрос.');
    return full;
  }
  async function generateSite() {
    const w = siteWish.trim();
    if (!w || siteBusy) return;
    setSiteBusy(true);
    setSiteHtml('');
    setSiteErr('');
    try {
      setSiteHtml(await genHtml('site', w));
    } catch (e) {
      setSiteErr(e instanceof Error ? e.message : 'Ошибка генерации.');
    }
    setSiteBusy(false);
  }
  async function generateGame() {
    const w = gameWish.trim();
    if (!w || gameBusy) return;
    setGameBusy(true);
    setGameHtml('');
    setGameErr('');
    try {
      setGameHtml(await genHtml('game', w));
    } catch (e) {
      setGameErr(e instanceof Error ? e.message : 'Ошибка генерации.');
    }
    setGameBusy(false);
  }
  function downloadHtml(html: string, filename: string) {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportChat() {
    if (!active) return;
    const md =
      `# ${active.title}\n\n` +
      active.messages.map((m) => `**${m.role === 'user' ? 'Я' : 'Amethyst'}:**\n\n${m.content}`).join('\n\n---\n\n');
    downloadHtml(md, (active.title || 'chat').replace(/[^\wа-яА-Я -]/g, '').slice(0, 40) + '.md');
  }
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setAttached({ name: f.name, content: (await f.text()).slice(0, 20000) });
  }
  function chooseAccent(key: string) {
    if (!plus) return setShowPlus(true);
    setAccentState(key);
  }
  function toggleTts() {
    if (!plus) return setShowPlus(true);
    const v = !tts;
    setTtsState(v);
    setTTS(v);
  }

  // Ядро генерации ответа: добавляет пузырь ИИ к base и стримит. Используется и отправкой, и «перегенерировать».
  async function runReply(chatId: string, base: Message[], promptForModel: string, title: string) {
    const botId = crypto.randomUUID();
    const apply = (fn: (c: Chat) => Chat) => setChats((prev) => prev.map((c) => (c.id === chatId ? fn(c) : c)));
    apply((c) => ({ ...c, title, messages: [...base, { id: botId, role: 'assistant', content: '' }], updatedAt: Date.now() }));
    const setBot = (content: string) =>
      apply((c) => ({ ...c, messages: c.messages.map((m) => (m.id === botId ? { ...m, content } : m)) }));
    const history = base.map((m) => ({ role: m.role, text: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;
    setSending(true);
    setError('');
    let full = '';
    try {
      if (hasDesktop()) {
        let log = '';
        const finalText = await runAgent({
          system: buildSystem(memory),
          history,
          prompt: promptForModel,
          temperature: RIFT.temperature,
          signal: controller.signal,
          onStep: (s) => {
            if (s.kind === 'call') log += `\n\n\`🔧 ${s.name}\` ${'`' + JSON.stringify(s.args) + '`'}\n`;
            else log += '```\n' + (s.result.length > 1500 ? s.result.slice(0, 1500) + '\n…' : s.result) + '\n```\n';
            setBot(log);
          },
        });
        full = (log ? log + '\n' : '') + finalText;
        setBot(full);
      } else {
        for await (const chunk of streamGemini({
          system: buildSystem(memory),
          history,
          prompt: promptForModel,
          temperature: RIFT.temperature,
          maxTokens: plus ? 8192 : 4096,
          signal: controller.signal,
        })) {
          full += chunk;
          setBot(full);
        }
      }
      if (!full.trim() && !controller.signal.aborted) throw new Error('Пустой ответ. Попробуй ещё раз.');
    } catch (err) {
      abortRef.current = null;
      if (!controller.signal.aborted) {
        apply((c) => ({ ...c, messages: c.messages.filter((m) => m.id !== botId) }));
        setError(err instanceof Error ? err.message : 'Ошибка. Попробуй ещё раз.');
        setSending(false);
        return;
      }
    }
    abortRef.current = null;
    setSending(false);
    if (!full.trim()) {
      apply((c) => ({ ...c, messages: c.messages.filter((m) => m.id !== botId) }));
      return;
    }
    setUsage(incUsage());
    if (plus && tts) speak(full);
    saveChat({ id: chatId, title, model: 'rift', messages: [...base, { id: botId, role: 'assistant', content: full }], updatedAt: Date.now() });
  }

  async function submit(text: string) {
    const t = text.trim();
    if (!t || sending || !active) return;
    if (!plus && usage >= FREE_LIMIT) {
      setError(`Лимит ${FREE_LIMIT} сообщений исчерпан. Активируй Amethyst Plus — лимита нет.`);
      setShowPlus(true);
      return;
    }
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';

    const file = attached;
    setAttached(null);
    const promptForModel = file ? `${t}\n\n--- Файл «${file.name}» ---\n${file.content}` : t;
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: file ? `${t}\n\n📎 ${file.name}` : t };
    const firstUser = messages.length === 0;
    await runReply(active.id, [...messages, userMsg], promptForModel, firstUser ? t.slice(0, 42) : active.title);
  }

  // Перегенерировать последний ответ (а также повтор после ошибки).
  function regenerate() {
    if (sending || !active) return;
    let msgs = active.messages;
    if (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs = msgs.slice(0, -1);
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    const idx = msgs.map((m) => m.id).lastIndexOf(lastUser.id);
    const base = msgs.slice(0, idx + 1);
    const prompt = lastUser.content.replace(/\n\n📎[^\n]*$/, '');
    runReply(active.id, base, prompt, active.title);
  }

  // Редактировать своё сообщение: вернуть текст в поле и убрать его и всё после.
  function editMessage(m: Message) {
    if (sending || !active) return;
    const idx = active.messages.map((x) => x.id).indexOf(m.id);
    if (idx < 0) return;
    setInput(m.content.replace(/\n\n📎[^\n]*$/, ''));
    updateActive((c) => ({ ...c, messages: c.messages.slice(0, idx) }));
    taRef.current?.focus();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(input);
  }
  async function copy(m: Message) {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId((id) => (id === m.id ? null : id)), 1500);
    } catch {
      /* ignore */
    }
  }
  function stop() {
    abortRef.current?.abort();
  }
  function grow(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }
  function onScrollArea() {
    const el = scrollRef.current;
    if (el) setShowDown(el.scrollHeight - el.scrollTop - el.clientHeight > 220);
  }
  function scrollDown() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }
  function startVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) {
      setError('Голосовой ввод не поддерживается (попробуй Chrome/Edge).');
      return;
    }
    const r = new SR();
    r.lang = 'ru-RU';
    r.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => setInput((v) => (v ? v + ' ' : '') + (e.results[0][0].transcript as string));
    r.start();
  }

  const composer = (
    <form className="cbox" onSubmit={onSubmit}>
      {attached && (
        <div className="attach-chip">
          📎 {attached.name}
          <button type="button" onClick={() => setAttached(null)} title="Убрать">
            ✕
          </button>
        </div>
      )}
      <textarea
        ref={taRef}
        className="cbox-input"
        placeholder="Спроси у Amethyst…"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          grow(e.target);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit(input);
          }
        }}
        rows={1}
        disabled={sending}
      />
      <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json,.js,.ts,.py,.html,.css,.tsx,.jsx" style={{ display: 'none' }} onChange={onPickFile} />
      <div className="cbox-bar">
        <button
          type="button"
          className="cbox-attach"
          title={plus ? 'Прикрепить файл' : 'Файлы — в Amethyst Plus'}
          onClick={() => (plus ? fileRef.current?.click() : setShowPlus(true))}
        >
          <Icon name="attach" size={17} />
        </button>
        <button type="button" className="cbox-attach" title="Голосовой ввод" onClick={startVoice}>
          <Icon name="volume" size={17} />
        </button>
        <span style={{ flex: 1 }} />
        {sending ? (
          <button type="button" className="cbox-send cbox-stop" onClick={stop} title="Остановить">
            <span className="stop-sq" />
          </button>
        ) : (
          <button type="submit" className="cbox-send" disabled={!input.trim()} title="Отправить">
            <Icon name="send" size={18} />
          </button>
        )}
      </div>
    </form>
  );

  return (
    <div className={`ws ${collapsed ? 'ws-collapsed' : ''}`}>
      {sidebarOpen && <div className="ws-scrim" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="side-top">
          <button className="hero-logo side-logo" onClick={onHome} title="На главный экран">
            Amethyst<span>AI</span>
          </button>
          <button className="icon-only side-collapse" onClick={() => setCollapsed(true)} title="Свернуть">
            «
          </button>
        </div>

        <div className="side-search">
          <span className="side-search-ic">
            <Icon name="search" size={16} />
          </span>
          <input placeholder="Поиск чатов" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <button className="new-chat" onClick={newChat}>
          <Icon name="plus" size={17} /> Новый чат
        </button>
        <button className="side-link" onClick={() => setShowMemory(true)}>
          <Icon name="memory" /> Память ИИ
        </button>
        <button className="side-link" onClick={() => (plus ? setShowSite(true) : setShowPlus(true))}>
          <Icon name="globe" /> Создать сайт {!plus && <span className="lock">PLUS</span>}
        </button>
        <button className="side-link" onClick={() => (plus ? setShowGame(true) : setShowPlus(true))}>
          <Icon name="game" /> Игровая студия {!plus && <span className="lock">PLUS</span>}
        </button>

        <button className={`plus-banner ${plus ? 'on' : ''}`} onClick={() => setShowPlus(true)}>
          <div className="plus-banner-title">
            <Icon name="star" size={15} /> Amethyst Plus
            {plus && <span className="plus-dot">активен</span>}
          </div>
          <div className="plus-banner-sub">{plus ? 'Все функции открыты' : 'Сайты · игры · память · озвучка'}</div>
        </button>

        <div className="side-label">История</div>
        <div className="chat-list">
          {filtered.length === 0 ? (
            <div className="chat-empty-hint">{search ? 'Ничего не найдено' : 'Пока нет чатов'}</div>
          ) : (
            filtered.map((c) => (
              <div key={c.id} className={`chat-item ${c.id === active?.id ? 'active' : ''}`} onClick={() => selectChat(c.id)}>
                <AmethystLogo size={15} />
                {editingId === c.id ? (
                  <input
                    className="chat-rename"
                    value={editTitle}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => renameChat(c.id, editTitle)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') renameChat(c.id, editTitle);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <span
                    className="chat-item-title"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingId(c.id);
                      setEditTitle(c.title);
                    }}
                  >
                    {c.title || 'Новый чат'}
                  </span>
                )}
                <button
                  className="chat-act"
                  title="Переименовать"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(c.id);
                    setEditTitle(c.title);
                  }}
                >
                  <Icon name="edit" size={14} />
                </button>
                <button className="chat-act chat-del" title="Удалить" onClick={(e) => deleteChat(c.id, e)}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="side-user">
          <button className="side-user-btn" onClick={() => setShowSettings(true)} title="Аккаунт и настройки">
            {avatar ? (
              <img className="user-avatar" src={avatar} alt="" referrerPolicy="no-referrer" />
            ) : (
              <div className="user-avatar user-initial">{name.charAt(0).toUpperCase()}</div>
            )}
            <span className="user-name">{name}</span>
          </button>
          <button className="ghost sign-out" onClick={() => setShowSettings(true)} title="Настройки">
            <Icon name="settings" size={17} />
          </button>
          <button className="ghost sign-out" onClick={() => confirm('Выйти из аккаунта?') && onSignOut()} title="Выйти">
            <Icon name="logout" size={17} />
          </button>
        </div>
      </aside>

      <main className="ws-main">
        <header className="ws-bar">
          <button className="icon-only menu-btn" onClick={() => setSidebarOpen(true)} title="Меню">
            ☰
          </button>
          {collapsed && (
            <button className="icon-only reopen" onClick={() => setCollapsed(false)} title="Показать панель">
              »
            </button>
          )}
          <div className="ws-bar-model">
            <div className="ai-ava">
              <AmethystLogo size={18} />
            </div>
            <div>
              <div className="ws-bar-name">Amethyst{plus && <span className="plus-dot"> · Plus</span>}</div>
              <div className="ws-bar-tag">{hasDesktop() ? 'ПК-агент подключён' : RIFT.tagline}</div>
            </div>
          </div>
          <button className="icon-only" onClick={newChat} title="Новый чат">
            <Icon name="plus" size={17} />
          </button>
        </header>

        {empty ? (
          <div className="hero-chat">
            <div className="hero-chat-gem">
              <AmethystLogo size={58} />
            </div>
            <h1 className="hero-chat-title">Amethyst</h1>
            <p className="hero-chat-sub">{RIFT.tagline}. Что ты хочешь узнать?</p>
            <div className="hero-chat-box">{composer}</div>
            {error && <p className="composer-error">{error}</p>}
            <div className="suggests">
              {RIFT.suggests.map((s) => (
                <button key={s} className="suggest" onClick={() => submit(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="studio-scroll" ref={scrollRef} onScroll={onScrollArea}>
              {showDown && (
                <button className="scroll-down" onClick={scrollDown} title="Вниз">
                  ↓
                </button>
              )}
              <div className="thread">
                {messages.map((m, i) => {
                  const isLast = i === messages.length - 1;
                  const waiting = sending && isLast && m.role === 'assistant' && m.content === '';
                  const typing = sending && isLast && m.role === 'assistant' && m.content !== '';
                  if (m.role === 'user') {
                    return (
                      <div key={m.id} className="turn turn-user">
                        <button className="ubble-edit" onClick={() => editMessage(m)} title="Изменить">
                          <Icon name="edit" size={13} />
                        </button>
                        <div className="ubble">{m.content}</div>
                      </div>
                    );
                  }
                  return (
                    <div key={m.id} className="turn turn-ai">
                      <div className="ai-ava">
                        <AmethystLogo size={20} />
                      </div>
                      <div className="ai-text">
                        {waiting ? (
                          <span className="dots">
                            <span>•</span>
                            <span>•</span>
                            <span>•</span>
                          </span>
                        ) : (
                          <>
                            <Markdown text={m.content} />
                            {typing ? (
                              <span className="caret" aria-hidden />
                            ) : (
                              <div className="msg-actions">
                                <button className="copy-btn" onClick={() => copy(m)} title="Копировать">
                                  <Icon name="copy" size={14} /> {copiedId === m.id ? 'скопировано' : 'копировать'}
                                </button>
                                <button
                                  className="copy-btn"
                                  onClick={() => (plus ? speak(m.content) : setShowPlus(true))}
                                  title={plus ? 'Озвучить' : 'Озвучка — в Amethyst Plus'}
                                >
                                  <Icon name="volume" size={14} /> озвучить
                                </button>
                                {isLast && (
                                  <button className="copy-btn" onClick={regenerate} title="Перегенерировать">
                                    ↻ заново
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="composer-dock">
              {error && (
                <p className="composer-error">
                  {error}{' '}
                  <button className="retry-btn" onClick={regenerate}>
                    ↻ Повторить
                  </button>
                </p>
              )}
              {composer}
              <p className="cbox-hint">Amethyst · работает на Gemini{plus ? ' · Plus' : ''}</p>
            </div>
          </>
        )}
      </main>

      {/* Настройки */}
      {showSettings && (
        <div className="modal-scrim" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Аккаунт и настройки</h3>
              <button className="icon-only" onClick={() => setShowSettings(false)}>
                ✕
              </button>
            </div>
            <div className="acct">
              {avatar ? (
                <img className="acct-ava" src={avatar} alt="" referrerPolicy="no-referrer" />
              ) : (
                <div className="acct-ava user-initial">{name.charAt(0).toUpperCase()}</div>
              )}
              <div className="acct-info">
                <div className="acct-name">{name}</div>
                <div className="acct-email">{email || 'без email'}</div>
              </div>
            </div>
            <div className="stats">
              <div className="stat">
                <div className="stat-num">{chats.length}</div>
                <div className="stat-lbl">чатов</div>
              </div>
              <div className="stat">
                <div className="stat-num">{plus ? '∞' : Math.max(0, FREE_LIMIT - usage)}</div>
                <div className="stat-lbl">сообщений</div>
              </div>
              <div className="stat">
                <div className="stat-num">{plus ? 'Plus' : 'Free'}</div>
                <div className="stat-lbl">тариф</div>
              </div>
            </div>

            <div className="set-label">Настройки</div>
            <button className="set-row" onClick={toggleTts}>
              <div className="set-text">
                <div className="set-title">Озвучка ответов {!plus && <span className="lock">PLUS</span>}</div>
                <div className="set-desc">Amethyst читает ответы голосом</div>
              </div>
              <span className={`switch ${tts && plus ? 'on' : ''}`}>
                <span className="knob" />
              </span>
            </button>
            <div className="set-row" style={{ cursor: 'default' }}>
              <div className="set-text">
                <div className="set-title">Цвет темы {!plus && <span className="lock">PLUS</span>}</div>
                <div className="set-desc">Акцент интерфейса</div>
              </div>
              <div className="accent-swatches">
                {ACCENTS.map((a) => (
                  <button
                    key={a.key}
                    className={`swatch ${accent === a.key ? 'on' : ''}`}
                    style={{ background: `linear-gradient(135deg, ${a.c}, ${a.c2})` }}
                    title={a.name}
                    onClick={() => chooseAccent(a.key)}
                  />
                ))}
              </div>
            </div>
            <button
              className="set-row"
              onClick={() => {
                setShowSettings(false);
                setShowPlus(true);
              }}
            >
              <div className="set-text">
                <div className="set-title">✦ Amethyst Plus {plus ? '— активен' : ''}</div>
                <div className="set-desc">{plus ? 'Все функции открыты' : 'Активировать по коду'}</div>
              </div>
              <span className="set-arrow">›</span>
            </button>

            <div className="set-actions">
              <button className="ghost danger-btn" onClick={() => { exportChat(); setShowSettings(false); }}>
                ⬇ Экспорт чата (.md)
              </button>
              <button className="ghost danger-btn" onClick={clearAll}>
                🗑 Очистить все чаты
              </button>
              <button className="ghost danger-btn" onClick={onSignOut}>
                ⎋ Выйти из аккаунта
              </button>
            </div>
            <div className="set-foot">Amethyst AI · работает на Gemini</div>
          </div>
        </div>
      )}

      {/* Amethyst Plus */}
      {showPlus && (
        <div className="modal-scrim" onClick={() => setShowPlus(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>✦ Amethyst Plus {plus && <span className="plus-tag">активен</span>}</h3>
              <button className="icon-only" onClick={() => setShowPlus(false)}>
                ✕
              </button>
            </div>
            <ul className="perks">
              <li><b>Без лимитов</b> — у бесплатного {FREE_LIMIT} сообщений</li>
              <li><b>Создание сайтов</b> — генерируй и скачивай сайты</li>
              <li><b>Игровая студия</b> — играбельные игры одним кликом</li>
              <li><b>Память 20 ГБ</b>, <b>озвучка</b>, <b>темы</b>, <b>файлы</b>, длинные ответы</li>
            </ul>
            {plus ? (
              <div className="plus-active-box">✓ Amethyst Plus активен — все функции открыты.</div>
            ) : (
              <>
                <div className="set-label">Активация по коду</div>
                <div className="redeem">
                  <input placeholder="Введи код активации" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && redeemCode()} />
                  <button onClick={redeemCode}>Активировать</button>
                </div>
                {codeMsg && <p className="redeem-msg">{codeMsg}</p>}
              </>
            )}
            <div className="set-foot">Код можно получить у администратора Amethyst.</div>
          </div>
        </div>
      )}

      {/* Память */}
      {showMemory && (
        <div className="modal-scrim" onClick={() => setShowMemory(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Память ИИ</h3>
              <button className="icon-only" onClick={() => setShowMemory(false)}>
                ✕
              </button>
            </div>
            <p className="muted-line">
              Amethyst помнит эти факты во всех чатах. Запас: {(memoryBytes(memory) / 1024).toFixed(1)} КБ из {plus ? '20 ГБ' : '1 ГБ'}.
            </p>
            <div className="mem-bar">
              <span style={{ width: `${Math.min(100, (memoryBytes(memory) / (plus ? MEM_PLUS : MEM_FREE)) * 100) || 0.5}%` }} />
            </div>
            <div className="redeem">
              <input placeholder="Например: меня зовут Гига, люблю игры" value={memInput} onChange={(e) => setMemInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addMemory()} />
              <button onClick={addMemory}>Добавить</button>
            </div>
            <div className="mem-list">
              {memory.length === 0 ? (
                <div className="chat-empty-hint">Память пуста — добавь, что Amethyst должен помнить.</div>
              ) : (
                memory.map((m, i) => (
                  <div key={i} className="mem-item">
                    <span>{m}</span>
                    <button className="chat-act" onClick={() => removeMemory(i)}>
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Создание сайтов */}
      {showSite && (
        <div className="modal-scrim" onClick={() => setShowSite(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Создать сайт</h3>
              <button className="icon-only" onClick={() => setShowSite(false)}>
                ✕
              </button>
            </div>
            <div className="redeem">
              <input placeholder="Опиши сайт: напр. лендинг для кофейни с меню" value={siteWish} onChange={(e) => setSiteWish(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && generateSite()} disabled={siteBusy} />
              <button onClick={generateSite} disabled={siteBusy || !siteWish.trim()}>
                {siteBusy ? '…' : 'Создать'}
              </button>
            </div>
            {siteBusy && <p className="muted-line">Amethyst собирает сайт…</p>}
            {siteErr && <p className="composer-error">{siteErr}</p>}
            {siteHtml && (
              <>
                <div className="site-preview">
                  <iframe title="site" srcDoc={siteHtml} sandbox="allow-scripts" />
                </div>
                <div className="set-actions">
                  <button onClick={() => downloadHtml(siteHtml, 'site.html')}>⬇ Скачать site.html</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Игровая студия */}
      {showGame && (
        <div className="modal-scrim" onClick={() => setShowGame(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Игровая студия</h3>
              <button className="icon-only" onClick={() => setShowGame(false)}>
                ✕
              </button>
            </div>
            <div className="redeem">
              <input placeholder="Опиши игру: напр. змейка, платформер" value={gameWish} onChange={(e) => setGameWish(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && generateGame()} disabled={gameBusy} />
              <button onClick={generateGame} disabled={gameBusy || !gameWish.trim()}>
                {gameBusy ? '…' : 'Создать'}
              </button>
            </div>
            {gameBusy && <p className="muted-line">Amethyst собирает игру…</p>}
            {gameErr && <p className="composer-error">{gameErr}</p>}
            {gameHtml && (
              <>
                <div className="site-preview">
                  <iframe title="game" srcDoc={gameHtml} sandbox="allow-scripts" />
                </div>
                <div className="set-actions">
                  <button onClick={() => downloadHtml(gameHtml, 'game.html')}>⬇ Скачать game.html</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
