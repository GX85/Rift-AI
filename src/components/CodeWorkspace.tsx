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
  'Создай браузерную игру с управлением на телефоне',
  'Собери чатбота: prompt, UI и логику диалога',
];

const MOBILE_ACTIONS = [
  { label: 'Сайт', prompt: 'Создай современный адаптивный сайт одним HTML-файлом. Тема: ' },
  { label: 'Игра', prompt: 'Создай браузерную игру одним HTML-файлом: canvas, счет, рестарт, уровни, управление с клавиатуры и touch-кнопки. Идея: ' },
  { label: 'Баг', prompt: 'Помоги исправить баг. Вот ошибка и код:\n\n' },
  { label: 'Бот', prompt: 'Создай чатбота для бизнеса/сайта: system prompt, сценарии диалога, fallback-ответы, UI-прототип и код. Задача: ' },
  { label: 'React', prompt: 'Создай React + TypeScript компонент без any, с loading/empty/error состояниями. Задача: ' },
];

const MOBILE_ACTION_ICONS = ['globe', 'game', 'bug', 'spark', 'code'];

const MOBILE_CAPABILITIES = [
  { label: 'Code', icon: 'code' },
  { label: 'Sites', icon: 'globe' },
  { label: 'Apps', icon: 'models' },
  { label: 'Games', icon: 'game' },
];

const STUDIO_CARDS = [
  {
    icon: 'globe',
    title: 'Сайт за минуту',
    text: 'Лендинг с hero, секциями, CTA, адаптивом и готовым HTML-файлом.',
    prompt: MOBILE_ACTIONS[0].prompt,
  },
  {
    icon: 'models',
    title: 'Web-app MVP',
    text: 'Интерфейс, mock data, формы, пустые состояния и localStorage.',
    prompt: 'Собери web-app MVP одним HTML-файлом: dashboard, mock data, формы, фильтры, empty/error states, localStorage. Идея: ',
  },
  {
    icon: 'game',
    title: 'Игровой прототип',
    text: 'Playable HTML-игра с touch-кнопками, счетом, рестартом и уровнями.',
    prompt: MOBILE_ACTIONS[1].prompt,
  },
  {
    icon: 'bug',
    title: 'Fix & review',
    text: 'Разбор ошибки, точный фикс, объяснение причины и как проверить.',
    prompt: MOBILE_ACTIONS[2].prompt,
  },
];

const OUTPUTS = ['HTML artifact', 'React/TS code', 'Bug fix', 'Business brief', 'Game prototype'];

const TOP_BADGES = [
  { icon: 'spark', label: 'Gemini 2.5 Flash' },
  { icon: 'code', label: 'Artifacts' },
  { icon: 'globe', label: 'Mobile-ready' },
];

const HERO_METRICS = [
  { value: 'HTML', label: 'single-file sites' },
  { value: 'TS', label: 'typed code' },
  { value: 'MVP', label: 'app logic' },
];

const PIPELINE_STEPS = ['Brief', 'UI', 'Logic', 'Export'];

function newChat(): Chat {
  return { id: crypto.randomUUID(), title: 'Новый чат', messages: [], updatedAt: Date.now() };
}

function titleFrom(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 46) || 'Новый чат';
}

function buildTaskBrief(text: string) {
  const normalized = text.toLowerCase();
  const rules: string[] = [
    'Сначала определи тип задачи и выбери самый полезный формат результата.',
    'Если просишь код, возвращай рабочий код без пустых заглушек.',
    'Проверяй мобильную адаптацию, пустые состояния и ошибки.',
  ];

  if (/сайт|лендинг|landing|website|html|страниц/.test(normalized)) {
    rules.push(
      'Для сайта верни один полный HTML-файл с <!doctype html>, CSS в <style> и JS в <script> если нужен.',
      'Сайт должен иметь nav, hero, CTA, секции, footer, hover/focus, mobile layout и не иметь горизонтального скролла.',
    );
  }
  if (/игр|game|canvas|runner|snake|arcade|шутер|платформер/.test(normalized)) {
    rules.push(
      'Для игры верни один playable HTML-файл: canvas/DOM, старт, пауза, рестарт, счет, уровни/жизни, collision logic, клавиатура и touch-кнопки.',
    );
  }
  if (/чатбот|бот|bot|agent|агент|dialog|диалог/.test(normalized)) {
    rules.push(
      'Для чатбота верни system prompt, intents, сценарии, fallback, guardrails, memory policy, тестовые диалоги и UI/JS-прототип при реализации.',
    );
  }
  if (/react|typescript|tsx|компонент/.test(normalized)) {
    rules.push(
      'Для React/TypeScript используй строгие типы, без any, с loading/empty/error состояниями и понятными props.',
    );
  }

  return `${text}\n\n--- Amethyst quality brief ---\n${rules.map((rule) => `- ${rule}`).join('\n')}`;
}

function extractHtmlArtifact(content: string) {
  const blocks = Array.from(content.matchAll(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g));
  const html = blocks.find((match) => {
    const lang = match[1].toLowerCase();
    const code = match[2].trim().toLowerCase();
    return lang === 'html' || code.startsWith('<!doctype html') || code.startsWith('<html');
  });
  return html?.[2].trim() ?? '';
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 800);
}

function htmlFilename(content: string) {
  const slug = titleFrom(content)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 38);
  return `${slug || 'amethyst-result'}.html`;
}

type ArtifactKind = 'site' | 'game' | 'bot' | 'app';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function detectArtifactKind(text: string): ArtifactKind | null {
  const normalized = text.toLowerCase();
  if (/игр|game|canvas|runner|snake|arcade|шутер|платформер/.test(normalized)) return 'game';
  if (/чатбот|бот|bot|agent|агент|диалог/.test(normalized)) return 'bot';
  if (/сайт|лендинг|landing|website|страниц|html/.test(normalized)) return 'site';
  if (/программ|прилож|app|web-app|mvp|crm|dashboard|панел|сервис/.test(normalized)) return 'app';
  return null;
}

function buildGuaranteedHtmlArtifact(kind: ArtifactKind, request: string) {
  const title = escapeHtml(titleFrom(request).replace(/^создай\s+/i, '') || 'Amethyst result');
  const isGame = kind === 'game';
  const isBot = kind === 'bot';
  const isApp = kind === 'app';

  if (isGame) {
    return `\`\`\`html
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 0,#7c3aed66,transparent 34%),#070711;color:white;font-family:Inter,Arial,sans-serif;overflow:hidden}.wrap{width:min(96vw,980px)}canvas{width:100%;aspect-ratio:16/9;border:1px solid #ffffff26;border-radius:22px;background:#090b18;box-shadow:0 30px 90px #0009;touch-action:none}.hud{display:flex;justify-content:space-between;gap:12px;margin:12px 4px;color:#c7d2fe}.pad{display:none;grid-template-columns:repeat(3,56px);gap:10px;justify-content:center;margin-top:12px}.pad button{height:52px;border:1px solid #ffffff2b;border-radius:16px;background:#ffffff12;color:white;font-size:20px}@media(max-width:720px){.pad{display:grid}.hud{font-size:14px;flex-direction:column}}
  </style>
</head>
<body>
  <main class="wrap">
    <canvas id="game" width="960" height="540"></canvas>
    <div class="hud"><b>Стрелки/WASD + Space</b><span>P пауза · R рестарт · touch работает</span></div>
    <div class="pad"><span></span><button data-k="up">↑</button><span></span><button data-k="left">←</button><button data-k="fire">●</button><button data-k="right">→</button></div>
  </main>
  <script>
    const c=document.getElementById('game'),x=c.getContext('2d');let keys={},state='menu',score=0,lives=3,t=0,last=0,player,orbs,shots,parts,spawn=0;
    function reset(){state='play';score=0;lives=3;t=0;player={x:480,y:420,r:18,vx:0};orbs=[];shots=[];parts=[];spawn=0;last=performance.now()}
    function boom(px,py,col){for(let i=0;i<18;i++)parts.push({x:px,y:py,vx:(Math.random()-.5)*7,vy:(Math.random()-.5)*7,a:1,c:col})}
    function fire(){if(state==='menu'||state==='over')return reset();shots.push({x:player.x,y:player.y-18,vy:-9})}
    addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=1;if(e.code==='Space')fire();if(e.key==='p')state=state==='pause'?'play':'pause';if(e.key==='r')reset()});addEventListener('keyup',e=>keys[e.key.toLowerCase()]=0);
    document.querySelectorAll('[data-k]').forEach(b=>{b.onpointerdown=()=>{const k=b.dataset.k;if(k==='fire')fire();else keys[k]=1};b.onpointerup=()=>{keys[b.dataset.k]=0}});c.onpointerdown=fire;
    function step(now){let dt=Math.min(32,now-last||16);last=now;if(state==='play'){t+=dt;spawn-=dt;player.vx=((keys.arrowright||keys.d||keys.right)?1:0)-((keys.arrowleft||keys.a||keys.left)?1:0);player.x=Math.max(24,Math.min(936,player.x+player.vx*(6+score*.006)));if(spawn<=0){orbs.push({x:40+Math.random()*880,y:-30,r:14+Math.random()*20,vy:2.2+score*.015,h:Math.random()*360});spawn=Math.max(230,760-score*4)}shots.forEach(s=>s.y+=s.vy);orbs.forEach(o=>o.y+=o.vy);for(const s of shots)for(const o of orbs)if(Math.hypot(s.x-o.x,s.y-o.y)<o.r+5){s.dead=o.dead=1;score+=10;boom(o.x,o.y,'hsl('+o.h+',90%,65%)')}for(const o of orbs)if(Math.hypot(player.x-o.x,player.y-o.y)<o.r+player.r){o.dead=1;lives--;boom(player.x,player.y,'#fb7185');if(lives<=0)state='over'}shots=shots.filter(s=>!s.dead&&s.y>-20);orbs=orbs.filter(o=>!o.dead&&o.y<590);parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.a*=.94});parts=parts.filter(p=>p.a>.04)}draw();requestAnimationFrame(step)}
    function draw(){x.clearRect(0,0,960,540);let g=x.createLinearGradient(0,0,960,540);g.addColorStop(0,'#10163a');g.addColorStop(1,'#210a3d');x.fillStyle=g;x.fillRect(0,0,960,540);for(let i=0;i<70;i++){x.fillStyle='#ffffff12';x.fillRect((i*97+t*.02)%960,(i*53)%540,2,2)}orbs.forEach(o=>{x.fillStyle='hsl('+o.h+',90%,60%)';x.beginPath();x.arc(o.x,o.y,o.r,0,7);x.fill()});shots.forEach(s=>{x.fillStyle='#67e8f9';x.fillRect(s.x-3,s.y-18,6,22)});parts.forEach(p=>{x.globalAlpha=p.a;x.fillStyle=p.c;x.fillRect(p.x,p.y,4,4);x.globalAlpha=1});if(player){x.fillStyle='#c084fc';x.beginPath();x.moveTo(player.x,player.y-24);x.lineTo(player.x-22,player.y+22);x.lineTo(player.x+22,player.y+22);x.closePath();x.fill()}x.fillStyle='white';x.font='22px Arial';x.fillText('Score '+score,24,34);x.fillText('Lives '+lives,24,64);if(state!=='play'){x.textAlign='center';x.font='54px Arial';x.fillText(state==='over'?'Game Over':'${title}',480,240);x.font='22px Arial';x.fillText('Space/тап — старт и огонь, R — рестарт',480,282);x.textAlign='left'}}
    requestAnimationFrame(step);
  </script>
</body>
</html>
\`\`\``;
  }

  return `\`\`\`html
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    *{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;background:#080810;color:#fff}button,input,textarea{font:inherit}.shell{min-height:100vh;padding:24px;background:radial-gradient(circle at 78% 18%,#7c3aed66,transparent 28%),radial-gradient(circle at 12% 78%,#06b6d455,transparent 24%),linear-gradient(135deg,#070710,#111827)}.wrap{width:min(1120px,100%);margin:auto}.nav{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:56px}.brand{font-weight:950}.btn{display:inline-flex;min-height:44px;align-items:center;justify-content:center;border:0;border-radius:14px;padding:0 18px;background:#fff;color:#111827;text-decoration:none;font-weight:850}.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:24px;align-items:center}.panel,.card{border:1px solid #ffffff1f;border-radius:22px;background:#ffffff0d;box-shadow:0 24px 80px #0005}.panel{padding:22px}.eyebrow{color:#67e8f9;font-weight:900}h1{font-size:clamp(42px,8vw,88px);line-height:.94;margin:12px 0}p{color:#c7d2fe;line-height:1.6}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-top:26px}.card{padding:18px}.app{display:grid;gap:12px}.row{display:flex;gap:8px}.row input{flex:1;min-width:0;border:1px solid #ffffff1f;border-radius:14px;background:#ffffff12;color:#fff;padding:12px}.list{display:grid;gap:8px}.item{display:flex;justify-content:space-between;gap:8px;padding:12px;border-radius:14px;background:#ffffff10}@media(max-width:760px){.shell{padding:14px}.nav{margin-bottom:32px}.hero{grid-template-columns:1fr}.btn{width:100%}.row{flex-direction:column}}
  </style>
</head>
<body>
  <main class="shell">
    <div class="wrap">
      <nav class="nav"><div class="brand">Amethyst</div><a class="btn" href="#start">Начать</a></nav>
      <section class="hero">
        <div>
          <div class="eyebrow">${isBot ? 'Chatbot builder' : isApp ? 'Web app prototype' : 'Website builder'}</div>
          <h1>${title}</h1>
          <p>${isBot ? 'Готовый прототип чатбота: сценарии, fallback-ответы и мини-интерфейс диалога.' : isApp ? 'Готовый прототип программы с мок-данными, формой, списком и сохранением в браузере.' : 'Готовый адаптивный сайт с hero, секциями, CTA и мобильной версткой.'}</p>
          <div class="grid"><div class="card">Адаптив</div><div class="card">Рабочая логика</div><div class="card">Без внешних CDN</div></div>
        </div>
        <div class="panel app" id="start">
          <b>${isBot ? 'Amethyst Bot' : isApp ? 'Task Program' : 'Заявка'}</b>
          <div class="list" id="list"></div>
          <form class="row" id="form"><input id="input" placeholder="${isBot ? 'Напиши сообщение...' : 'Новая задача или заявка...'}" /><button class="btn">Добавить</button></form>
        </div>
      </section>
    </div>
  </main>
  <script>
    const key='amethyst-demo-items';const list=document.getElementById('list');const form=document.getElementById('form');const input=document.getElementById('input');
    let items=JSON.parse(localStorage.getItem(key)||'["Первый рабочий элемент","Проверить мобильную версию"]');
    function render(){list.innerHTML=items.length?items.map((item,i)=>'<div class="item"><span>'+item+'</span><button onclick="del('+i+')">×</button></div>').join(''):'<p>Пока пусто. Добавь первый элемент.</p>';localStorage.setItem(key,JSON.stringify(items))}
    function del(i){items.splice(i,1);render()} window.del=del;
    form.onsubmit=e=>{e.preventDefault();const value=input.value.trim();if(!value)return;items.push(value);input.value='';render()};
    render();
  </script>
</body>
</html>
\`\`\``;
}

function ensureCreatedArtifact(request: string, response: string) {
  const kind = detectArtifactKind(request);
  if (!kind || extractHtmlArtifact(response)) return response;
  const fallback = buildGuaranteedHtmlArtifact(kind, request);
  const intro = response.trim()
    ? `${response.trim()}\n\n---\nЯ добавил рабочий HTML-файл, чтобы результат точно можно было скачать и открыть:`
    : 'Готово. Я создал рабочий HTML-файл, который можно скачать и открыть:';
  return `${intro}\n\n${fallback}`;
}

function buildSystem() {
  return `Ты — Amethyst, coding assistant на базе Gemini.

Главная роль: помогать с разработкой, как Codex/Claude for code.

Правила:
• Отвечай конкретно и инженерно, без воды.
• Если просят код — давай рабочий код, а не общие советы.
• Если задача широкая — сам выбери разумный стек и сразу выдай готовый результат.
• Для сайтов и лендингов выдавай один полный HTML-файл с <!doctype html>, CSS внутри <style>, JS внутри <script> если нужен.
• Сайты должны быть как готовый продукт: nav, hero, CTA, секции пользы, тарифы/кейсы если уместно, форма/контакты, footer, mobile layout, hover/focus states, aria-label где нужно, без горизонтального скролла.
• Для web-app прототипов делай рабочую логику: мок-данные, формы, фильтры, пустые состояния, ошибки, сохранение в localStorage если это полезно.
• Для игр выдавай playable prototype одним HTML-файлом: canvas или DOM-сцена, старт/пауза/рестарт, счет, жизни/уровни, collision logic, клавиатура и touch-кнопки, адаптив под телефон.
• Для чатботов выдавай не только текст: system prompt, intents, сценарии, fallback, memory policy, guardrails, формат ответа, тестовые диалоги и мини UI/JS-прототип если пользователь просит реализацию.
• Не используй CDN, внешние картинки и библиотеки, если пользователь сам не попросил.
• Для React/TypeScript используй строгие типы, без any, с нормальными состояниями loading/empty/error.
• Если пользователь прислал ошибку — сначала причина, потом точный фикс, потом как проверить.
• Если данных мало — задай максимум один вопрос или сделай разумное допущение.
• Для нескольких файлов пиши путь файла перед каждым code block.
• Проверяй код перед ответом: импорты, переменные, JSX, CSS, адаптив, edge cases, закрытые теги, доступность кнопок, отсутствие горизонтального скролла.
• Не оставляй пустые заглушки вместо рабочей логики, если пользователь попросил готовый результат.

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
    const viewport = window.visualViewport;
    const setAppHeight = () => {
      document.documentElement.style.setProperty('--amethyst-app-height', `${viewport?.height ?? window.innerHeight}px`);
    };

    setAppHeight();
    viewport?.addEventListener('resize', setAppHeight);
    window.addEventListener('orientationchange', setAppHeight);

    return () => {
      viewport?.removeEventListener('resize', setAppHeight);
      window.removeEventListener('orientationchange', setAppHeight);
    };
  }, []);

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
    const promptText = buildTaskBrief(text);
    const prompt = file ? `${promptText}\n\n--- File: ${file.name} ---\n${file.content}` : promptText;
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

    if (!controller.signal.aborted) {
      const ensured = ensureCreatedArtifact(text, full);
      if (ensured !== full) {
        full = ensured;
        applyChat(active.id, (chat) => ({
          ...chat,
          messages: chat.messages.map((message) =>
            message.id === assistantId ? { ...message, content: full } : message,
          ),
          updatedAt: Date.now(),
        }));
      }
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
            <span>Amethyst</span>
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

      <main className="acode-main" data-empty={messages.length === 0 ? 'true' : 'false'} data-busy={busy ? 'true' : 'false'}>
        <header className="acode-top">
          <button className="acode-icon mobile-only" onClick={() => setSidebarOpen(true)} title="Меню">
            <Icon name="menu" size={17} />
          </button>
          <div className="acode-model">
            <AmethystLogo size={30} />
            <div>
              <strong>Amethyst</strong>
              <span>{messages.length ? active.title : 'Gemini-powered coding assistant'}</span>
            </div>
          </div>
          <div className="acode-status" aria-label="Amethyst capabilities">
            {TOP_BADGES.map((badge) => (
              <span key={badge.label}>
                <Icon name={badge.icon} size={13} />
                {badge.label}
              </span>
            ))}
          </div>
          <button className="acode-icon" onClick={createChat} title="Новый чат">
            <Icon name="plus" size={16} />
          </button>
        </header>

        <div className="acode-mobile-strip" aria-hidden="true">
          {MOBILE_CAPABILITIES.map((item) => (
            <span key={item.label}>
              <Icon name={item.icon} size={13} />
              {item.label}
            </span>
          ))}
        </div>

        <section className="acode-thread" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="acode-empty">
              <div className="acode-empty-hero">
                <div className="acode-empty-copy">
                  <AmethystLogo size={78} />
                  <div className="acode-empty-orbit" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="acode-empty-kicker">AI product studio</span>
                  <h1>Собери продукт, а не просто ответ</h1>
                  <p>Выбери режим или напиши задачу. Amethyst генерирует сайты, web-app MVP, игры, исправления кода и бизнес-структуру прямо в чате.</p>
                  <div className="acode-hero-metrics" aria-label="Product outputs">
                    {HERO_METRICS.map((metric) => (
                      <span key={metric.value}>
                        <b>{metric.value}</b>
                        <small>{metric.label}</small>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="acode-live-preview" aria-hidden="true">
                  <div className="acode-preview-top">
                    <i />
                    <i />
                    <i />
                    <span>artifact.html</span>
                  </div>
                  <div className="acode-preview-screen">
                    <b />
                    <span />
                    <span />
                    <div>
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                  <div className="acode-preview-code">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="acode-pipeline">
                    {PIPELINE_STEPS.map((step) => (
                      <span key={step}>{step}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="acode-studio-grid">
                {STUDIO_CARDS.map((card) => (
                  <button key={card.title} onClick={() => useStarter(card.prompt)}>
                    <Icon name={card.icon} size={18} />
                    <strong>{card.title}</strong>
                    <span>{card.text}</span>
                  </button>
                ))}
              </div>
              <div className="acode-output-strip" aria-label="Что умеет создавать Amethyst">
                {OUTPUTS.map((output) => (
                  <span key={output}>{output}</span>
                ))}
              </div>
              <div className="acode-starters">
                {STARTERS.map((starter) => (
                  <button key={starter} onClick={() => useStarter(starter)}>
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const htmlArtifact = message.role === 'assistant' ? extractHtmlArtifact(message.content) : '';
              const isHtmlResult = Boolean(htmlArtifact);
              return (
                <article key={message.id} className={`acode-msg ${message.role}`}>
                  <div className="acode-msg-avatar">
                    {message.role === 'assistant' ? <AmethystLogo size={24} /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <div className={`acode-msg-body ${isHtmlResult ? 'artifact-ready' : ''}`}>
                    {isHtmlResult ? (
                      <div className="acode-artifact-card">
                        <div className="acode-artifact-head">
                          <AmethystLogo size={28} />
                          <div>
                            <strong>HTML artifact готов</strong>
                            <span>Сайт собран. Скачай файл или скопируй код.</span>
                          </div>
                        </div>
                        <div className="acode-artifact-preview" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                          <span />
                          <span />
                          <b />
                        </div>
                        <details className="acode-artifact-code">
                          <summary>Показать код</summary>
                          <pre><code>{htmlArtifact}</code></pre>
                        </details>
                      </div>
                    ) : message.content ? (
                      <Markdown text={message.content} />
                    ) : (
                      <span className="acode-dots">Amethyst думает...</span>
                    )}
                    {message.content && (
                      <div className="acode-msg-actions">
                        <button className="acode-copy" onClick={() => copyMessage(message)}>
                          {copiedId === message.id ? 'скопировано' : 'копировать'}
                        </button>
                        {htmlArtifact && (
                          <>
                            <button className="acode-copy" onClick={() => void navigator.clipboard?.writeText(htmlArtifact)}>
                              копировать HTML
                            </button>
                            <button className="acode-copy acode-download" onClick={() => downloadText(htmlFilename(message.content), htmlArtifact)}>
                              скачать HTML
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>

        <footer className="acode-compose-wrap">
          <div className="acode-mobile-actions" aria-label="Быстрые команды">
            {MOBILE_ACTIONS.map((action, index) => (
              <button key={action.label} type="button" onClick={() => useStarter(action.prompt)}>
                <Icon name={MOBILE_ACTION_ICONS[index] ?? 'spark'} size={14} />
                <span>{action.label}</span>
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
                  <Icon name="stop" size={15} />
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
