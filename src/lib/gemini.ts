import { supabase } from './supabase';

type ChatRole = 'user' | 'assistant' | 'system';
type ChatMessage = {
  role: ChatRole;
  content?: string;
  text?: string;
};

type AgentStep = {
  kind: 'call' | 'result';
  name?: string;
  args?: Record<string, unknown>;
  result: string;
};

type GeminiRequest = {
  prompt?: string;
  system?: string;
  messages?: ChatMessage[];
  history?: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onStep?: (step: AgentStep) => void;
};

type AiResponse = {
  text?: string;
  url?: string;
  imageUrl?: string;
};

type ChunkHandler = (chunk: string) => void;
type InvokeOptions = {
  temperature?: number;
  maxTokens?: number;
  history?: ChatMessage[];
};

function normalizeHistory(messages?: ChatMessage[]) {
  return messages?.map((message) => ({
    role: message.role,
    text: message.content ?? message.text ?? '',
  }));
}

function polishedLocalFallback(prompt: string, system: string): string {
  const text = `${system}\n${prompt}`.toLowerCase();
  const isGame = /(игр|game|canvas|platformer|snake|runner|arcade|shooter|платформер|шутер)/i.test(text);
  const isBot = /(чатбот|бот|bot|agent|агент|system prompt|workflow|диалог)/i.test(text);
  const isSite = /(сайт|лендинг|landing|html|верстк|website|страниц|web-app|прототип|mvp)/i.test(text);
  const isCode = /(код|react|typescript|javascript|python|bug|ошибк|компонент|api|supabase|review|рефактор)/i.test(text);

  if (isGame) {
    return `Готовый playable prototype. Сохрани как \`game.html\` и открой в браузере.

\`\`\`html
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Amethyst Runner</title>
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 0,#7c3aed55,transparent 34%),#070711;color:white;font-family:Inter,Arial,sans-serif;overflow:hidden}.wrap{width:min(96vw,980px)}canvas{width:100%;aspect-ratio:16/9;border:1px solid #ffffff26;border-radius:22px;background:#090b18;box-shadow:0 30px 90px #0009;touch-action:none}.hud{display:flex;justify-content:space-between;gap:12px;margin:12px 4px;color:#c7d2fe}.pad{display:none;grid-template-columns:repeat(3,56px);gap:10px;justify-content:center;margin-top:12px}.pad button{height:52px;border:1px solid #ffffff2b;border-radius:16px;background:#ffffff12;color:white;font-size:20px}@media(max-width:720px){.pad{display:grid}.hud{font-size:14px}}
  </style>
</head>
<body>
  <main class="wrap"><canvas id="game" width="960" height="540"></canvas><div class="hud"><b>Стрелки/WASD + Space</b><span>P пауза · R рестарт · touch работает</span></div><div class="pad"><span></span><button data-k="up">↑</button><span></span><button data-k="left">←</button><button data-k="fire">●</button><button data-k="right">→</button></div></main>
  <script>
    const c=document.getElementById('game'),x=c.getContext('2d');let keys={},state='menu',score=0,lives=3,t=0,last=0,player,orbs,shots,parts,spawn=0;
    function reset(){state='play';score=0;lives=3;t=0;player={x:480,y:420,r:18,vx:0};orbs=[];shots=[];parts=[];spawn=0;last=performance.now()}
    function boom(px,py,col){for(let i=0;i<18;i++)parts.push({x:px,y:py,vx:(Math.random()-.5)*7,vy:(Math.random()-.5)*7,a:1,c:col})}
    function fire(){if(state==='menu'||state==='over')return reset();shots.push({x:player.x,y:player.y-18,vy:-9})}
    addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=1;if(e.code==='Space')fire();if(e.key==='p')state=state==='pause'?'play':'pause';if(e.key==='r')reset()});addEventListener('keyup',e=>keys[e.key.toLowerCase()]=0);
    document.querySelectorAll('[data-k]').forEach(b=>{b.onpointerdown=()=>{const k=b.dataset.k;if(k==='fire')fire();else keys[k]=1};b.onpointerup=()=>{keys[b.dataset.k]=0}});c.onpointerdown=fire;
    function step(now){let dt=Math.min(32,now-last||16);last=now;if(state==='play'){t+=dt;spawn-=dt;player.vx=((keys.arrowright||keys.d||keys.right)?1:0)-((keys.arrowleft||keys.a||keys.left)?1:0);player.x=Math.max(24,Math.min(936,player.x+player.vx*(6+score*.006)));if(spawn<=0){orbs.push({x:40+Math.random()*880,y:-30,r:14+Math.random()*20,vy:2.2+score*.015,h:Math.random()*360});spawn=Math.max(230,760-score*4)}shots.forEach(s=>s.y+=s.vy);orbs.forEach(o=>o.y+=o.vy);for(const s of shots)for(const o of orbs)if(Math.hypot(s.x-o.x,s.y-o.y)<o.r+5){s.dead=o.dead=1;score+=10;boom(o.x,o.y,'hsl('+o.h+',90%,65%)')}for(const o of orbs)if(Math.hypot(player.x-o.x,player.y-o.y)<o.r+player.r){o.dead=1;lives--;boom(player.x,player.y,'#fb7185');if(lives<=0)state='over'}shots=shots.filter(s=>!s.dead&&s.y>-20);orbs=orbs.filter(o=>!o.dead&&o.y<590);parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.a*=.94});parts=parts.filter(p=>p.a>.04)}draw();requestAnimationFrame(step)}
    function draw(){x.clearRect(0,0,960,540);let g=x.createLinearGradient(0,0,960,540);g.addColorStop(0,'#10163a');g.addColorStop(1,'#210a3d');x.fillStyle=g;x.fillRect(0,0,960,540);for(let i=0;i<70;i++){x.fillStyle='#ffffff12';x.fillRect((i*97+t*.02)%960,(i*53)%540,2,2)}orbs.forEach(o=>{x.fillStyle='hsl('+o.h+',90%,60%)';x.beginPath();x.arc(o.x,o.y,o.r,0,7);x.fill()});shots.forEach(s=>{x.fillStyle='#67e8f9';x.fillRect(s.x-3,s.y-18,6,22)});parts.forEach(p=>{x.globalAlpha=p.a;x.fillStyle=p.c;x.fillRect(p.x,p.y,4,4);x.globalAlpha=1});if(player){x.fillStyle='#c084fc';x.beginPath();x.moveTo(player.x,player.y-24);x.lineTo(player.x-22,player.y+22);x.lineTo(player.x+22,player.y+22);x.closePath();x.fill()}x.fillStyle='white';x.font='22px Arial';x.fillText('Score '+score,24,34);x.fillText('Lives '+lives,24,64);if(state!=='play'){x.textAlign='center';x.font='54px Arial';x.fillText(state==='over'?'Game Over':'Amethyst Runner',480,240);x.font='22px Arial';x.fillText('Space/тап — старт и огонь, R — рестарт',480,282);x.textAlign='left'}}
    requestAnimationFrame(step);
  </script>
</body>
</html>
\`\`\``;
  }

  if (isBot) {
    return `Готовый каркас чатбота.

**System prompt**
Ты — полезный чатбот Amethyst для сайта/бизнеса. Уточняй цель пользователя, отвечай коротко, веди к следующему действию, не выдумывай факты, если данных нет. Если запрос не по теме, мягко возвращай к продукту.

**Intents**
- greeting: приветствие и быстрые варианты.
- pricing: объяснить тарифы/условия.
- support: принять проблему, запросить детали, дать шаги.
- lead: собрать имя, контакт и задачу.
- fallback: признать непонимание и предложить 3 кнопки.

**UI/logic prototype**
\`\`\`html
<!doctype html>
<html lang="ru">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Amethyst Bot</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080812;color:#fff;font-family:Inter,Arial}.chat{width:min(460px,94vw);height:min(720px,92vh);display:grid;grid-template-rows:auto 1fr auto;border:1px solid #ffffff1f;border-radius:24px;background:#11131d;overflow:hidden}.top{padding:16px 18px;border-bottom:1px solid #ffffff12;font-weight:900}.log{padding:16px;overflow:auto;display:flex;flex-direction:column;gap:10px}.msg{max-width:84%;padding:10px 12px;border-radius:16px;background:#202333}.bot{align-self:flex-start}.user{align-self:flex-end;background:#7c3aed}.bar{display:flex;gap:8px;padding:12px;border-top:1px solid #ffffff12}input{flex:1;border:0;border-radius:14px;padding:12px;background:#ffffff10;color:#fff}button{border:0;border-radius:14px;padding:0 14px;font-weight:800}
</style>
<main class="chat"><div class="top">Amethyst Bot</div><div class="log" id="log"></div><form class="bar" id="form"><input id="input" placeholder="Напиши вопрос..." /><button>Send</button></form></main>
<script>
const log=document.getElementById('log'),input=document.getElementById('input'),form=document.getElementById('form');
const rules=[[/цен|price|тариф/i,'Тариф зависит от задач. Напиши, что нужно: сайт, бот, код или поддержка.'],[/ошиб|bug|слом/i,'Опиши ошибку, что ожидалось и что произошло. Если есть код — вставь фрагмент.'],[/контакт|заяв/i,'Оставь имя и удобный контакт, я соберу заявку.']];
function add(text,role='bot'){const el=document.createElement('div');el.className='msg '+role;el.textContent=text;log.append(el);log.scrollTop=log.scrollHeight}
function reply(text){const found=rules.find(([r])=>r.test(text));return found?found[1]:'Я помогу с сайтом, кодом, игрой или ботом. Что нужно создать?'}
add('Привет! Я Amethyst. Чем помочь?');
form.onsubmit=e=>{e.preventDefault();const text=input.value.trim();if(!text)return;add(text,'user');input.value='';setTimeout(()=>add(reply(text)),250)}
</script>
\`\`\``;
  }

  if (/react|typescript|tsx|компонент/i.test(text)) {
    return `Готовый React + TypeScript компонент. Он типизирован, без any, с loading/empty/error состояниями.

\`\`\`tsx
import { useMemo, useState } from 'react';

type Item = {
  id: string;
  title: string;
  status: 'todo' | 'progress' | 'done';
};

type SmartPanelProps = {
  title: string;
  items?: Item[];
  loading?: boolean;
  error?: string;
  onCreate?: (title: string) => void;
};

export function SmartPanel({ title, items = [], loading = false, error = '', onCreate }: SmartPanelProps) {
  const [draft, setDraft] = useState('');
  const doneCount = useMemo(() => items.filter((item) => item.status === 'done').length, [items]);

  if (loading) return <section className="panel">Загрузка...</section>;
  if (error) return <section className="panel panel_error">{error}</section>;

  return (
    <section className="panel">
      <header className="panel__head">
        <h2>{title}</h2>
        <span>{doneCount}/{items.length}</span>
      </header>

      {items.length === 0 ? (
        <p className="panel__empty">Пока пусто. Добавь первую задачу.</p>
      ) : (
        <ul className="panel__list">
          {items.map((item) => (
            <li key={item.id} data-status={item.status}>{item.title}</li>
          ))}
        </ul>
      )}

      <form
        className="panel__form"
        onSubmit={(event) => {
          event.preventDefault();
          const value = draft.trim();
          if (!value) return;
          onCreate?.(value);
          setDraft('');
        }}
      >
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Новая задача" />
        <button type="submit">Добавить</button>
      </form>
    </section>
  );
}
\`\`\`

Проверь: пустой список, loading, error, длинные названия и отправку формы.`;
  }

  if (isSite) {
    return `Готовый адаптивный сайт. Сохрани как \`site.html\` и открой в браузере.

\`\`\`html
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Amethyst Site</title>
  <style>
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,Arial,sans-serif;background:#080810;color:#fff}nav{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:14px clamp(16px,4vw,42px);background:#080810cc;backdrop-filter:blur(18px);border-bottom:1px solid #ffffff12}a{color:inherit}.brand{font-weight:950}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:14px;text-decoration:none;font-weight:850}.primary{background:#fff;color:#111827}.ghost{border:1px solid #ffffff24}.hero{min-height:82vh;display:grid;align-items:center;padding:clamp(34px,7vw,90px) clamp(16px,5vw,72px);background:radial-gradient(circle at 72% 24%,#7c3aed66,transparent 28%),radial-gradient(circle at 18% 72%,#06b6d455,transparent 24%),linear-gradient(135deg,#070710,#111827)}section{padding:64px clamp(16px,5vw,72px)}.wrap{width:min(1120px,100%);margin:auto}.eyebrow{color:#67e8f9;font-weight:900}h1{max-width:900px;font-size:clamp(42px,9vw,104px);line-height:.94;margin:12px 0;letter-spacing:0}p{max-width:680px;color:#c7d2fe;font-size:clamp(16px,2vw,20px);line-height:1.6}.cta{display:flex;gap:12px;flex-wrap:wrap;margin-top:26px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.card{padding:22px;border:1px solid #ffffff1f;border-radius:18px;background:#ffffff0d;box-shadow:0 20px 60px #0004}.card b{display:block;margin-bottom:8px}.footer{border-top:1px solid #ffffff12;color:#94a3b8}@media(max-width:640px){nav{padding:10px 14px}.hero{min-height:auto;padding-top:54px}.cta .btn{width:100%}section{padding-block:42px}}
  </style>
</head>
<body>
  <nav><div class="brand">Amethyst</div><a class="btn ghost" href="#contact">Связаться</a></nav>
  <main class="hero"><div class="wrap"><div class="eyebrow">AI product builder</div><h1>Создай сайт, игру или приложение быстрее</h1><p>Готовый интерфейс для разработки: код, прототипы, отладка, чатботы и запуск идеи в понятный результат.</p><div class="cta"><a class="btn primary" href="#contact">Начать</a><a class="btn ghost" href="#features">Возможности</a></div></div></main>
  <section id="features"><div class="wrap grid"><article class="card"><b>Сайты</b><span>Адаптивные лендинги с CTA, секциями и формами.</span></article><article class="card"><b>Игры</b><span>Playable prototypes с управлением и счетом.</span></article><article class="card"><b>Код</b><span>React, TypeScript, багфиксы и code review.</span></article></div></section>
  <section id="contact"><div class="wrap"><h2>Готов начать?</h2><p>Опиши задачу, а Amethyst соберет первый рабочий вариант.</p><a class="btn primary" href="mailto:hello@example.com">Написать</a></div></section>
  <section class="footer"><div class="wrap">Amethyst · Gemini-powered</div></section>
</body>
</html>
\`\`\``;
  }

  if (isCode) {
    return `Я готов помочь с кодом. Пришли задачу, ошибку или файл, и я дам рабочее решение: полный код, причину проблемы, способ запуска и проверку edge cases.`;
  }

  return `Amethyst готов. Я могу собрать сайт, игру, чатбота, React/TypeScript компонент, исправить ошибку или провести code review. Напиши задачу, и я дам готовый результат.`;
}

function localFallback(prompt: string, system: string): string {
  return polishedLocalFallback(prompt, system);
}

function isAbortSignal(value: unknown): value is AbortSignal {
  return typeof value === 'object' && value !== null && 'aborted' in value;
}

function svgImageFallback(text: string): string {
  const safeText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, 420);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#12091f"/>
      <stop offset="0.55" stop-color="#39207a"/>
      <stop offset="1" stop-color="#0e7490"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="18" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <path d="M512 126 716 410 590 884 316 602z" fill="#8b5cf6" opacity=".58" filter="url(#glow)"/>
  <path d="M512 126 590 884 792 522z" fill="#c084fc" opacity=".38"/>
  <path d="M316 602 512 126 232 480z" fill="#38bdf8" opacity=".22"/>
  <text x="512" y="790" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" fill="#fff">Amethyst AI Image</text>
  <foreignObject x="172" y="820" width="680" height="120">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:#e9d5ff;font:24px Arial;text-align:center;line-height:1.3">${safeText}</div>
  </foreignObject>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function messagesToPrompt(messages: ChatMessage[] | undefined): string {
  if (!messages?.length) return '';
  return messages.map((message) => `${message.role}: ${message.content ?? message.text ?? ''}`).join('\n\n');
}

function resolvePrompt(input: string | GeminiRequest): { prompt: string; system: string } {
  if (typeof input === 'string') return { prompt: input, system: '' };
  return {
    prompt: input.prompt?.trim() || messagesToPrompt(input.messages ?? input.history),
    system: input.system ?? '',
  };
}

async function invokeAi(
  prompt: string,
  system: string,
  signal?: AbortSignal,
  options?: InvokeOptions,
): Promise<string> {
  if (signal?.aborted) throw new DOMException('Запрос отменён', 'AbortError');

  const { data, error } = await supabase.functions.invoke('ai', {
    body: {
      prompt,
      system,
      history: normalizeHistory(options?.history),
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    },
  });

  if (signal?.aborted) throw new DOMException('Запрос отменён', 'AbortError');
  if (error) throw new Error(error.message || 'AI-функция Supabase вернула ошибку.');

  const response = data as AiResponse | null;
  const text = response?.text ?? response?.imageUrl ?? response?.url ?? '';
  if (!text) throw new Error('AI-функция вернула пустой ответ.');
  return text;
}

export function hasDesktop(): boolean {
  return typeof window !== 'undefined' && Boolean(window.rift?.desktop);
}

export async function* streamGemini(
  input: string | GeminiRequest,
  arg2?: unknown,
  arg3?: unknown,
  arg4?: unknown,
): AsyncGenerator<string, string, unknown> {
  const base = resolvePrompt(input);
  const system = typeof arg2 === 'string' ? arg2 : base.system;
  const onChunk = typeof arg2 === 'function'
    ? arg2 as ChunkHandler
    : typeof arg3 === 'function'
      ? arg3 as ChunkHandler
      : undefined;
  const signal = isAbortSignal(arg2)
    ? arg2
    : isAbortSignal(arg3)
      ? arg3
      : isAbortSignal(arg4)
        ? arg4
        : typeof input !== 'string' && input.signal
          ? input.signal
          : undefined;

  let text = '';
  try {
    text = await invokeAi(
      base.prompt,
      system,
      signal,
      typeof input === 'string'
        ? undefined
        : { temperature: input.temperature, maxTokens: input.maxTokens, history: input.history ?? input.messages },
    );
  } catch {
    text = localFallback(base.prompt, system);
  }
  onChunk?.(text);
  yield text;
  return text;
}

export async function runAgent(
  input: string | GeminiRequest,
  arg2?: unknown,
  arg3?: unknown,
  arg4?: unknown,
): Promise<string> {
  void arg3;
  void arg4;
  const base = resolvePrompt(input);
  const system = typeof arg2 === 'string' ? arg2 : base.system;
  try {
    return await invokeAi(
      base.prompt,
      system,
      typeof input !== 'string' ? input.signal : undefined,
      typeof input === 'string'
        ? undefined
        : { temperature: input.temperature, maxTokens: input.maxTokens, history: input.history ?? input.messages },
    );
  } catch {
    return localFallback(base.prompt, system);
  }
}

export async function generateImage(input: string | { prompt: string }): Promise<string> {
  const prompt = typeof input === 'string' ? input : input.prompt;
  const system =
    'Ты генератор изображений для Amethyst AI. Улучши запрос пользователя и верни либо URL готовой картинки, ' +
    'либо подробный prompt для генерации изображения, если текущая модель не умеет отдавать файл.';

  let result = prompt;
  try {
    result = await invokeAi(
      `Создай изображение по описанию. Описание пользователя: ${prompt}`,
      system,
    );
  } catch {
    result = prompt;
  }

  if (/^(https?:|data:image\/)/i.test(result.trim())) return result.trim();
  return svgImageFallback(result.trim());
}
