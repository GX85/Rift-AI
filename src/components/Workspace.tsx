import { useEffect, useMemo, useRef, useState } from 'react';
import { Markdown } from './Markdown';
import { AmethystLogo } from './Gems';
import { Icon } from './Icons';
import { streamGemini, runAgent, generateImage, hasDesktop } from '../lib/gemini';
import { loadChats, saveChat, deleteChatRow } from '../lib/chatsStore';
import {
  redeem,
  syncAccount,
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
type Review = { id: string; name: string; text: string; createdAt: number };
type PreviewMode = 'desktop' | 'mobile';
type CreatorPreset = { label: string; prompt: string };
type SpeechRecognitionEventLike = {
  results: {
    [resultIndex: number]: {
      [alternativeIndex: number]: {
        transcript: string;
      };
    };
  };
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & {
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
  SpeechRecognition?: SpeechRecognitionConstructor;
};

// Единственная модель — Amethyst (специализация только на разработке).
const RIFT = {
  name: 'Amethyst',
  tagline: 'ИИ для кода, приложений и отладки',
  temperature: 0.35,
  persona:
    'Ты — Amethyst, специализированный ИИ для программирования в духе Codex: пишешь рабочий код, исправляешь ошибки, ' +
    'проектируешь приложения, объясняешь сложные места простым языком и помогаешь доводить проект до запуска. ' +
    'Всегда отвечай как инженер: конкретно, проверяемо, без воды и без выдуманных API.',
  suggests: [
    'Создай React + TypeScript компонент',
    'Улучши этот код и найди баги',
    'Создай адаптивный сайт одним HTML-файлом',
    'Объясни ошибку и дай фикс',
  ],
};

const SITE_PRESETS: CreatorPreset[] = [
  { label: 'Лендинг AI', prompt: 'Премиальный лендинг для AI-приложения с hero, тарифами, отзывами и CTA' },
  { label: 'MVP-лендинг', prompt: 'Лендинг для нового стартапа: проблема, решение, демо, тарифы, отзывы, форма заявки' },
  { label: 'SaaS', prompt: 'Современный сайт SaaS-продукта для бизнеса с секциями пользы, интеграциями и CTA' },
  { label: 'Портфолио', prompt: 'Портфолио разработчика с проектами, стеком, услугами и формой заявки' },
];

const APP_PRESETS: CreatorPreset[] = [
  { label: 'CRM', prompt: 'Мини-CRM для заявок: список клиентов, статусы, фильтр, карточка сделки и заметки' },
  { label: 'Панель', prompt: 'SaaS-панель: метрики, графики на CSS/canvas, таблица задач, фильтры и адаптив' },
  { label: 'Планер', prompt: 'Планировщик задач для стартапа: доска, приоритеты, дедлайны, быстрые действия' },
  { label: 'ИИ-инструмент', prompt: 'Интерфейс ИИ-инструмента: поле запроса, настройки, история результатов и панель предпросмотра' },
];

const GAME_PRESETS: CreatorPreset[] = [
  { label: 'Аркада', prompt: 'Неоновая аркада на canvas: игрок уклоняется от препятствий, собирает кристаллы, есть уровни' },
  { label: 'Платформер', prompt: 'Платформер с прыжками, монетами, врагами, финишем, рестартом и touch-кнопками' },
  { label: 'Шутер', prompt: 'Космический шутер сверху: волны врагов, бонусы, счет, жизни, пауза и мобильное управление' },
  { label: 'Пазл', prompt: 'Пазл-игра с плитками, таймером, счетом, победой, подсказкой и красивой анимацией' },
];

const IMAGE_PRESETS: CreatorPreset[] = [
  { label: 'Hero 3D', prompt: '3D hero background: кубический аметистовый фрактал, темная сцена, мягкое свечение, cinematic light' },
  { label: 'Логотип', prompt: 'Минималистичный логотип Amethyst AI: кристалл, бело-фиолетовая палитра, чистый tech style' },
  { label: 'Персонаж', prompt: '3D персонаж AI-ассистента из аметиста, дружелюбный, glossy material, studio render' },
  { label: 'Иконка', prompt: 'App icon для Amethyst AI: объемный фиолетовый кристалл на темном фоне, high detail' },
];

// Инструменты доступны, когда Amethyst работает в десктоп-версии (управление ПК).
const DESKTOP_NOTE =
  '\n\nУ тебя есть доступ к компьютеру через инструменты (run_command, read_file, write_file, list_dir): ' +
  'РЕАЛЬНО выполняй задачи сам — создавай файлы, запускай скрипты, ищи по папкам. Сначала действуй, потом поясни.';

const CREATION_RULES = `

Кодовый режим:
• Твоя главная задача — помогать с кодом. Если запрос не про код, мягко верни пользователя к разработке, архитектуре, автоматизации или продуктовой реализации.
• Если пользователь просит код — давай рабочее решение, а не общий совет. Пиши полный фрагмент или полный файл, который можно сразу вставить/запустить.
• Для React/TypeScript используй строгие типы, не используй any, держи компоненты маленькими и понятными.
• Перед ответом проверь: импорты, имена переменных, состояние, обработчики событий, edge cases, ошибки TypeScript, адаптивность и доступность.
• Если пользователь прислал ошибку — сначала назови причину, затем дай точный фикс, затем коротко объясни как проверить.
• Если данных не хватает — задай максимум один вопрос. Если можно сделать разумное допущение — сделай его и двигайся дальше.
• Если пользователь просит приложение — делай Claude/Codex-подобный результат: архитектура, готовый UI, состояния, мок-данные, обработчики, пустые/ошибочные состояния и понятный запуск.
• Для прототипов приложений отдавай один готовый HTML-файл, если пользователь не попросил конкретный фреймворк. Для React/TypeScript отдавай отдельные файлы с именами и кодом.
• Если пользователь просит сайт или лендинг — генерируй его прямо в основном чате, без ссылки на отдельную вкладку. Давай один полный HTML-файл: <!doctype html>, <html>, <style>, <body>, при необходимости <script>.
• Сайт должен быть не шаблонной заглушкой, а готовым первым экраном и страницей: nav, hero, CTA, секции пользы, карточки/таблицы только если нужны, footer, responsive mobile layout.
• Для сайтов добавляй нормальные состояния и качество интерфейса: hover/focus, адаптивные отступы, читаемая типографика, доступные кнопки, без переполнения текста на телефоне.
• Для сайтов не используй внешние CDN, картинки и библиотеки, если пользователь сам их не дал. Всё должно запускаться открытием одного HTML-файла.
• Перед выдачей HTML мысленно проверь незакрытые теги, CSS-селекторы, адаптивность, кнопки и отсутствие горизонтального скролла.
• Не выдумывай несуществующие библиотеки, свойства и API. Если не уверен — предложи безопасный стандартный вариант.
• После кода кратко пиши: куда вставить, как запустить, как проверить.

ИИ-агенты:
• Если пользователь просит ИИ-агента — проектируй агента как готовую систему: название, цель, роль, входные данные, инструменты, память, ограничения, пошаговый workflow и критерии качества.
• Для агента всегда выдавай готовый system prompt, команды/действия агента, формат ответа и примеры 2-3 запросов пользователя.
• Если агент должен писать код, продавать, обучать, искать ошибки, делать дизайн или планировать — добавляй специализированные правила под эту профессию.
• Если пользователь просит “создай агента” без деталей — сам выбери разумную структуру и задай максимум один уточняющий вопрос только если без него нельзя.
• Делай агентов практичными: чтобы их можно было сразу вставить в AI-функцию, чат-бота или использовать как инструкцию для команды.

Формат ответа:
• Начинай с результата или диагноза, не с длинного вступления.
• Для кода используй markdown-блоки с языком.
• Для нескольких файлов пиши путь файла перед каждым блоком.
• Держи объяснение коротким, если пользователь не просит подробно.
• Запоминай контекст текущего проекта: Amethyst, Vite + React + TypeScript, Supabase, Vercel.

Качество функций:
• Всегда проверяй, что результат можно использовать сразу: скачать, вставить, запустить, открыть или применить.
• Если есть ошибка — объясняй коротко, что сломалось, и давай исправленную версию.
• Не обещай функцию, если она зависит от внешней настройки; честно называй, что нужно подключить.
`;

const ACTIVE_KEY = 'rift_active_v2';
const REVIEWS_KEY = 'amethyst_reviews_v1';

function loadReviews(): Review[] {
  try {
    const saved = JSON.parse(localStorage.getItem(REVIEWS_KEY) || '[]') as Review[];
    if (saved.length) return saved;
  } catch {
    /* ignore */
  }
  return [
    { id: 'r1', name: 'Айбар', text: 'Amethyst помог быстро собрать прототип и объяснил код простыми словами.', createdAt: Date.now() - 86400000 },
    { id: 'r2', name: 'Алия', text: 'Удобно, что можно делать сайты, игры и идеи для проекта в одном месте.', createdAt: Date.now() - 43200000 },
  ];
}

function saveReviews(items: Review[]) {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(items.slice(0, 50)));
}

function buildSystem(memory: string[]): string {
  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const mem = memory.length
    ? `\n\nДолговременная память о пользователе (учитывай это):\n${memory.map((m) => '• ' + m).join('\n')}`
    : '';
  const tools = hasDesktop() ? DESKTOP_NOTE : '';
  return `${RIFT.persona}${CREATION_RULES}${tools}${mem}

Как рассуждать и отвечать:
• Сложную задачу разбивай на шаги и решай последовательно; перепроверяй вывод и арифметику.
• Не выдумывай факты. Не уверен или данных не хватает — честно скажи об этом или задай уточняющий вопрос.
• Код давай полным и рабочим, с обработкой краевых случаев; кратко поясняй ключевые места.
• Отвечай по делу и структурно: списки, заголовки, код в блоках. Без воды и лишних извинений.
• Глубину ответа подбирай под вопрос: простой — коротко, сложный — развёрнуто.
• Помни весь разговор. Сегодня ${today}. Отвечай на языке собеседника.`;
}

function newChatObj(): Chat {
  return { id: crypto.randomUUID(), title: 'Новый чат', messages: [], updatedAt: Date.now() };
}

function stripFences(s: string): string {
  const trimmed = s.trim();
  const fenced = trimmed.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? trimmed).trim();
  const htmlStart = body.search(/<!doctype html>|<html[\s>]/i);
  return htmlStart >= 0 ? body.slice(htmlStart).trim() : body;
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
  const [showReviews, setShowReviews] = useState(false);
  const [reviews, setReviews] = useState<Review[]>(loadReviews);
  const [reviewName, setReviewName] = useState(name || 'Гость');
  const [reviewText, setReviewText] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  // Amethyst Plus
  const [plus, setPlusState] = useState<boolean>(true);
  const [usage, setUsage] = useState(getUsage());
  const [showPlus, setShowPlus] = useState(false);
  const [code, setCode] = useState('');
  const [codeMsg, setCodeMsg] = useState('');
  // Память
  const [memory, setMemoryState] = useState<string[]>(getMemory());
  const [showMemory, setShowMemory] = useState(false);
  const [memInput, setMemInput] = useState('');
  // Генераторы (Plus)
  const [showApp, setShowApp] = useState(false);
  const [appWish, setAppWish] = useState('');
  const [appHtml, setAppHtml] = useState('');
  const [appBusy, setAppBusy] = useState(false);
  const [appErr, setAppErr] = useState('');
  const [appPreviewMode, setAppPreviewMode] = useState<PreviewMode>('desktop');

  const [showSite, setShowSite] = useState(false);
  const [siteWish, setSiteWish] = useState('');
  const [siteHtml, setSiteHtml] = useState('');
  const [siteBusy, setSiteBusy] = useState(false);
  const [siteErr, setSiteErr] = useState('');
  const [sitePreviewMode, setSitePreviewMode] = useState<PreviewMode>('desktop');
  // Игры (Plus)
  const [showGame, setShowGame] = useState(false);
  const [gameWish, setGameWish] = useState('');
  const [gameHtml, setGameHtml] = useState('');
  const [gameBusy, setGameBusy] = useState(false);
  const [gameErr, setGameErr] = useState('');
  const [gamePreviewMode, setGamePreviewMode] = useState<PreviewMode>('desktop');
  // Картинки (Plus)
  const [showImage, setShowImage] = useState(false);
  const [imgWish, setImgWish] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [imgBusy, setImgBusy] = useState(false);
  const [imgErr, setImgErr] = useState('');
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
    syncAccount().then(({ plus, usage, memory }) => {
      setPlusState(plus);
      setUsage(usage);
      setMemoryState(memory);
    });
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
    if (c && c.messages.length) saveChat({ id: c.id, title: t, model: 'amethyst', messages: c.messages, updatedAt: c.updatedAt });
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

  async function redeemCode() {
    setCodeMsg('Проверяем код…');
    if (await redeem(code)) {
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

  function improveSitePrompt(wish: string) {
    const base = wish.trim() || 'сайт для современного AI-продукта';
    return `Сделай ${base}. Нужен готовый премиальный адаптивный сайт: hero, понятный CTA, секции пользы, карточки, отзывы, мобильная версия, аккуратные hover/focus состояния и чистый визуальный стиль.`;
  }

  function improveAppPrompt(wish: string) {
    const base = wish.trim() || 'рабочее приложение для управления задачами стартапа';
    return `Сделай ${base}. Нужен готовый интерактивный web-app прототип в одном HTML-файле: реальный рабочий экран приложения, навигация, состояния, мок-данные, формы, фильтры/поиск, состояния загрузки/пусто/ошибка, адаптив под телефон, аккуратный бизнес-интерфейс и чистый JS без внешних библиотек.`;
  }

  function improveGamePrompt(wish: string) {
    const base = wish.trim() || 'аркадную игру с кристаллами';
    return `Сделай ${base}. Нужен готовый playable HTML-прототип на canvas: старт, пауза, рестарт, счет, уровни, проигрыш/победа, клавиатура на ПК и touch-кнопки на телефоне, частицы и плавная анимация.`;
  }

  function improveImagePrompt(wish: string) {
    const base = wish.trim() || 'кубический аметистовый фрактал';
    return `${base}. 3D render, cinematic lighting, detailed materials, clean composition, high contrast, polished product visual, no text artifacts.`;
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard?.writeText(text);
  }

  function openHtml(html: string) {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function openAsset(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function startAgentBuilder() {
    setInput(
      'Создай coding-agent для моего проекта. Опиши: роль, входные данные, инструменты, правила работы с кодом, workflow, system prompt, формат ответа и 3 примера запросов.',
    );
    setSidebarOpen(false);
    window.setTimeout(() => taRef.current?.focus(), 0);
  }

  function startCodeReview() {
    setInput('Проведи code review. Найди баги, TypeScript-ошибки, проблемы архитектуры, edge cases и предложи точные исправления. Код вставлю ниже:\n\n');
    setSidebarOpen(false);
    window.setTimeout(() => taRef.current?.focus(), 0);
  }

  function startBugFix() {
    setInput('Помоги исправить ошибку. Сначала найди причину, потом дай фикс и способ проверки. Ошибка/код:\n\n');
    setSidebarOpen(false);
    window.setTimeout(() => taRef.current?.focus(), 0);
  }

  async function genHtml(kind: 'site' | 'game' | 'app', wish: string) {
    const sys =
      kind === 'site'
        ? 'Ты создаёшь премиальные готовые сайты. Верни ТОЛЬКО один полный HTML-документ, начинающийся с <!DOCTYPE html>. Используй встроенные CSS и JS. Без markdown. Собери реальный первый экран, навигацию, CTA, секции преимуществ, адаптив под телефон, аккуратные отступы, hover/focus состояния, микроанимации, доступные кнопки и визуальный стиль под запрос пользователя. Без внешних ассетов, если они не сделаны CSS/canvas.'
        : kind === 'app'
          ? 'Ты создаёшь web-app прототипы в стиле артефактов Claude. Верни ТОЛЬКО один полный HTML-документ, начинающийся с <!DOCTYPE html>. Используй встроенные CSS и JS. Без markdown. Собери реальный рабочий экран приложения, не лендинг. Добавь навигацию, реалистичные мок-данные, CRUD-подобные действия где уместно, поиск/фильтры, формы, состояния загрузки/пусто/ошибка, адаптив под телефон, доступные элементы управления, плотный аккуратный бизнес-интерфейс и без внешних библиотек/ассетов.'
          : 'Ты создаёшь премиальные играбельные браузерные игры. Верни ТОЛЬКО один полный HTML-документ, начинающийся с <!DOCTYPE html>. Используй встроенные CSS и JS. Без markdown. Игра должна включать canvas-рендер, стартовое меню, паузу/рестарт, счёт/HUD, рост сложности, состояние победы/поражения, управление клавиатурой, touch-управление на телефоне, частицы или визуальную обратную связь и без внешних библиотек/ассетов.';
    const upgradedWish =
      kind === 'site'
        ? `User website request: ${improveSitePrompt(wish)}\nMake it visually rich, responsive, and ready to download as a single HTML file.`
        : kind === 'app'
          ? `User app request: ${improveAppPrompt(wish)}\nMake a complete app prototype with polished UI, realistic interactions, and clean code ready to preview or download as app.html.`
          : `User game request: ${improveGamePrompt(wish)}\nMake a complete playable arcade prototype with polished graphics, touch controls, score, restart, and balanced difficulty.`;
    let full = '';
    for await (const chunk of streamGemini({ system: sys, history: [], prompt: upgradedWish, temperature: 0.78, maxTokens: 8192 })) {
      full += chunk;
    }
    full = stripFences(full);
    if (!/<\w/.test(full)) throw new Error('Модель не вернула HTML. Попробуй переформулировать запрос.');
    return full;
  }
  async function generateApp() {
    const w = appWish.trim();
    if (!w || appBusy) return;
    setAppBusy(true);
    setAppHtml('');
    setAppErr('');
    try {
      setAppHtml(await genHtml('app', w));
    } catch (e) {
      setAppErr(e instanceof Error ? e.message : 'Ошибка генерации.');
    }
    setAppBusy(false);
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
  async function generateImg() {
    const w = imgWish.trim();
    if (!w || imgBusy) return;
    setImgBusy(true);
    setImgUrl('');
    setImgErr('');
    try {
      setImgUrl(await generateImage({ prompt: improveImagePrompt(w) }));
    } catch (e) {
      setImgErr(e instanceof Error ? e.message : 'Ошибка генерации картинки.');
    }
    setImgBusy(false);
  }
  function downloadImage(url: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'amethyst-image.png';
    a.click();
  }
  function saveFile(html: string, filename: string) {
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
    saveFile(md, (active.title || 'chat').replace(/[^\wа-яА-Я -]/g, '').slice(0, 40) + '.md');
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
          maxTokens: 8192,
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
    saveChat({ id: chatId, title, model: 'amethyst', messages: [...base, { id: botId, role: 'assistant', content: full }], updatedAt: Date.now() });
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
    const speechWindow = window as SpeechWindow;
    const SR = speechWindow.webkitSpeechRecognition || speechWindow.SpeechRecognition;
    if (!SR) {
      setError('Голосовой ввод не поддерживается (попробуй Chrome/Edge).');
      return;
    }
    const r = new SR();
    r.lang = 'ru-RU';
    r.interimResults = false;
    r.onresult = (e) => setInput((v) => (v ? v + ' ' : '') + e.results[0][0].transcript);
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
        placeholder="Спроси про код, вставь ошибку или опиши приложение…"
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
          title="Прикрепить файл с кодом"
          onClick={() => fileRef.current?.click()}
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

  function addReview() {
    const text = reviewText.trim();
    if (!text) return;
    const item: Review = {
      id: crypto.randomUUID(),
      name: reviewName.trim() || 'Гость',
      text,
      createdAt: Date.now(),
    };
    const next = [item, ...reviews];
    setReviews(next);
    saveReviews(next);
    setReviewText('');
  }

  return (
    <div className={`ws ${collapsed ? 'ws-collapsed' : ''}`}>
      {sidebarOpen && <div className="ws-scrim" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="side-top">
          <button className="side-logo" onClick={onHome} title="На главный экран">
            <AmethystLogo size={34} />
            <span className="side-logo-text">
              Amethyst<span>AI</span>
            </span>
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
          <Icon name="memory" /> Контекст проекта
        </button>
        <button className="side-link" onClick={startCodeReview}>
          <Icon name="search" /> Code review
        </button>
        <button className="side-link" onClick={startBugFix}>
          <Icon name="settings" /> Исправить ошибку
        </button>
        <button className="side-link" onClick={startAgentBuilder}>
          <Icon name="models" /> Coding agent
        </button>

        <button className="plus-banner on" onClick={() => setShowSettings(true)}>
          <div className="plus-banner-title">
            <Icon name="star" size={15} /> Amethyst
            <span className="plus-dot">Gemini</span>
          </div>
          <div className="plus-banner-sub">Код · отладка · приложения · файлы</div>
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
              <div className="ws-bar-name">Amethyst</div>
              <div className="ws-bar-tag">{hasDesktop() ? 'ПК-агент подключён' : RIFT.tagline}</div>
            </div>
          </div>
          <button className="icon-only" onClick={newChat} title="Новый чат">
            <Icon name="plus" size={17} />
          </button>
        </header>

        {empty ? (
          <div className="hero-chat">
            <div className="hero-chat-logo" aria-hidden>
              <AmethystLogo size={96} />
            </div>
            <h1 className="hero-chat-title">Amethyst</h1>
            <p className="hero-chat-sub">Опиши задачу, вставь ошибку или прикрепи файл. Я помогу написать, понять и починить код.</p>
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
              <p className="cbox-hint">Amethyst · работает на Gemini</p>
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
                <div className="stat-num">Code</div>
                <div className="stat-lbl">режим</div>
              </div>
            </div>

            <div className="set-label">Настройки</div>
            <button className="set-row" onClick={toggleTts}>
              <div className="set-text">
                <div className="set-title">Озвучка ответов</div>
                <div className="set-desc">Amethyst читает ответы голосом</div>
              </div>
              <span className={`switch ${tts && plus ? 'on' : ''}`}>
                <span className="knob" />
              </span>
            </button>
            <div className="set-row" style={{ cursor: 'default' }}>
              <div className="set-text">
                <div className="set-title">Цвет темы</div>
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
                setShowMemory(true);
              }}
            >
              <div className="set-text">
                <div className="set-title">Контекст проекта</div>
                <div className="set-desc">Стек, правила и важные решения для coding assistant</div>
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
            <div className="set-foot">Amethyst · работает на Gemini</div>
          </div>
        </div>
      )}

      {/* Отзывы */}
      {showReviews && (
        <div className="modal-scrim" onClick={() => setShowReviews(false)}>
          <div className="modal reviews-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>Отзывы об Amethyst</h3>
                <p className="reviews-modal-sub">Публичное табло. Отзыв можно оставить без регистрации.</p>
              </div>
              <button className="icon-only" onClick={() => setShowReviews(false)}>
                ✕
              </button>
            </div>
            <div className="reviews-stats">
              <div>
                <strong>{reviews.length}</strong>
                <span>отзывов</span>
              </div>
              <div>
                <strong>4.9</strong>
                <span>средняя оценка</span>
              </div>
              <div>
                <strong>24/7</strong>
                <span>открыто для гостей</span>
              </div>
            </div>
            <div className="review-form">
              <input
                value={reviewName}
                onChange={(e) => setReviewName(e.target.value)}
                placeholder="Твоё имя"
              />
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Напиши отзыв. Регистрация не нужна."
                rows={4}
                maxLength={420}
              />
              <div className="review-form-bottom">
                <span>{reviewText.length}/420</span>
                <button onClick={addReview} disabled={!reviewText.trim()}>
                  Опубликовать отзыв
                </button>
              </div>
            </div>
            <div className="reviews-board">
              {reviews.length === 0 ? (
                <div className="reviews-empty">Пока отзывов нет. Будь первым.</div>
              ) : (
                reviews.map((review) => (
                  <article className="app-review-card" key={review.id}>
                    <div className="app-review-top">
                      <div className="review-avatar small">{review.name.slice(0, 1).toUpperCase()}</div>
                      <div>
                        <div className="review-person">{review.name}</div>
                        <time>{new Date(review.createdAt).toLocaleDateString('ru-RU')}</time>
                      </div>
                      <span className="review-stars">★★★★★</span>
                    </div>
                    <p>{review.text}</p>
                  </article>
                ))
              )}
            </div>
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
              <li><b>Студия приложений</b> — рабочие web-app прототипы как артефакты Claude</li>
              <li><b>Создание сайтов</b> — генерируй и скачивай сайты</li>
              <li><b>Игровая студия</b> — играбельные игры одним кликом</li>
              <li><b>Генерация картинок</b> — рисует изображения по описанию</li>
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

      {/* Студия приложений */}
      {showApp && (
        <div className="modal-scrim" onClick={() => setShowApp(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>Студия приложений</h3>
                <p className="reviews-modal-sub">Опиши web-app. Amethyst соберёт рабочий прототип с UI, состояниями и кодом.</p>
              </div>
              <button className="icon-only" onClick={() => setShowApp(false)}>
                ✕
              </button>
            </div>
            <div className="redeem">
              <input placeholder="Напр. CRM для заявок, панель продаж, ИИ-инструмент" value={appWish} onChange={(e) => setAppWish(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && generateApp()} disabled={appBusy} />
              <button onClick={() => setAppWish(improveAppPrompt(appWish))} disabled={appBusy}>
                Улучшить
              </button>
              <button onClick={generateApp} disabled={appBusy || !appWish.trim()}>
                {appBusy ? '…' : 'Создать'}
              </button>
            </div>
            <div className="prompt-chips" aria-label="Быстрые идеи для приложения">
              {APP_PRESETS.map((preset) => (
                <button key={preset.label} className="prompt-chip" onClick={() => setAppWish(preset.prompt)} disabled={appBusy}>
                  {preset.label}
                </button>
              ))}
            </div>
            {appBusy && <p className="muted-line">Amethyst собирает приложение…</p>}
            {appErr && <p className="composer-error">{appErr}</p>}
            {appHtml && (
              <>
                <div className="preview-toolbar">
                  <div className="preview-segmented" aria-label="Режим предпросмотра">
                    <button className={appPreviewMode === 'desktop' ? 'active' : ''} onClick={() => setAppPreviewMode('desktop')}>
                      Desktop
                    </button>
                    <button className={appPreviewMode === 'mobile' ? 'active' : ''} onClick={() => setAppPreviewMode('mobile')}>
                      Mobile
                    </button>
                  </div>
                  <div className="preview-actions">
                    <button onClick={() => openHtml(appHtml)}>Открыть</button>
                    <button onClick={() => void copyToClipboard(appHtml)}>Копировать HTML</button>
                    <button onClick={() => saveFile(appHtml, 'app.html')}>Скачать app.html</button>
                  </div>
                </div>
                <div className={`site-preview ${appPreviewMode === 'mobile' ? 'preview-mobile' : 'preview-desktop'}`}>
                  <iframe title="app" srcDoc={appHtml} sandbox="allow-scripts" />
                </div>
              </>
            )}
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
              <button onClick={() => setSiteWish(improveSitePrompt(siteWish))} disabled={siteBusy}>
                Улучшить
              </button>
              <button onClick={generateSite} disabled={siteBusy || !siteWish.trim()}>
                {siteBusy ? '…' : 'Создать'}
              </button>
            </div>
            <div className="prompt-chips" aria-label="Быстрые идеи для сайта">
              {SITE_PRESETS.map((preset) => (
                <button key={preset.label} className="prompt-chip" onClick={() => setSiteWish(preset.prompt)} disabled={siteBusy}>
                  {preset.label}
                </button>
              ))}
            </div>
            {siteBusy && <p className="muted-line">Amethyst собирает сайт…</p>}
            {siteErr && <p className="composer-error">{siteErr}</p>}
            {siteHtml && (
              <>
                <div className="preview-toolbar">
                  <div className="preview-segmented" aria-label="Режим предпросмотра">
                    <button className={sitePreviewMode === 'desktop' ? 'active' : ''} onClick={() => setSitePreviewMode('desktop')}>
                      Desktop
                    </button>
                    <button className={sitePreviewMode === 'mobile' ? 'active' : ''} onClick={() => setSitePreviewMode('mobile')}>
                      Mobile
                    </button>
                  </div>
                  <div className="preview-actions">
                    <button onClick={() => openHtml(siteHtml)}>Открыть</button>
                    <button onClick={() => void copyToClipboard(siteHtml)}>Копировать HTML</button>
                    <button onClick={() => saveFile(siteHtml, 'site.html')}>Скачать site.html</button>
                  </div>
                </div>
                <div className={`site-preview ${sitePreviewMode === 'mobile' ? 'preview-mobile' : 'preview-desktop'}`}>
                  <iframe title="site" srcDoc={siteHtml} sandbox="allow-scripts" />
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
              <button onClick={() => setGameWish(improveGamePrompt(gameWish))} disabled={gameBusy}>
                Улучшить
              </button>
              <button onClick={generateGame} disabled={gameBusy || !gameWish.trim()}>
                {gameBusy ? '…' : 'Создать'}
              </button>
            </div>
            <div className="prompt-chips" aria-label="Быстрые идеи для игры">
              {GAME_PRESETS.map((preset) => (
                <button key={preset.label} className="prompt-chip" onClick={() => setGameWish(preset.prompt)} disabled={gameBusy}>
                  {preset.label}
                </button>
              ))}
            </div>
            {gameBusy && <p className="muted-line">Amethyst собирает игру…</p>}
            {gameErr && <p className="composer-error">{gameErr}</p>}
            {gameHtml && (
              <>
                <div className="preview-toolbar">
                  <div className="preview-segmented" aria-label="Режим предпросмотра">
                    <button className={gamePreviewMode === 'desktop' ? 'active' : ''} onClick={() => setGamePreviewMode('desktop')}>
                      Desktop
                    </button>
                    <button className={gamePreviewMode === 'mobile' ? 'active' : ''} onClick={() => setGamePreviewMode('mobile')}>
                      Mobile
                    </button>
                  </div>
                  <div className="preview-actions">
                    <button onClick={() => openHtml(gameHtml)}>Открыть</button>
                    <button onClick={() => void copyToClipboard(gameHtml)}>Копировать HTML</button>
                    <button onClick={() => saveFile(gameHtml, 'game.html')}>Скачать game.html</button>
                  </div>
                </div>
                <div className={`site-preview ${gamePreviewMode === 'mobile' ? 'preview-mobile' : 'preview-desktop'}`}>
                  <iframe title="game" srcDoc={gameHtml} sandbox="allow-scripts" />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Создание картинок */}
      {showImage && (
        <div className="modal-scrim" onClick={() => setShowImage(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Создать картинку</h3>
              <button className="icon-only" onClick={() => setShowImage(false)}>
                ✕
              </button>
            </div>
            <div className="redeem">
              <input placeholder="Опиши картинку: напр. неоновый кот-космонавт в стиле 3D" value={imgWish} onChange={(e) => setImgWish(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && generateImg()} disabled={imgBusy} />
              <button onClick={() => setImgWish(improveImagePrompt(imgWish))} disabled={imgBusy}>
                Улучшить
              </button>
              <button onClick={generateImg} disabled={imgBusy || !imgWish.trim()}>
                {imgBusy ? '…' : 'Создать'}
              </button>
            </div>
            <div className="prompt-chips" aria-label="Быстрые идеи для картинки">
              {IMAGE_PRESETS.map((preset) => (
                <button key={preset.label} className="prompt-chip" onClick={() => setImgWish(preset.prompt)} disabled={imgBusy}>
                  {preset.label}
                </button>
              ))}
            </div>
            {imgBusy && <p className="muted-line">Amethyst рисует картинку…</p>}
            {imgErr && <p className="composer-error">{imgErr}</p>}
            {imgUrl && (
              <>
                <div className="preview-toolbar">
                  <div className="preview-actions">
                    <button onClick={() => openAsset(imgUrl)}>Открыть</button>
                    <button onClick={() => void copyToClipboard(imgWish)}>Копировать prompt</button>
                    <button onClick={() => downloadImage(imgUrl)}>Скачать картинку</button>
                  </div>
                </div>
                <div className="img-preview">
                  <img src={imgUrl} alt="Сгенерированная картинка" />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
