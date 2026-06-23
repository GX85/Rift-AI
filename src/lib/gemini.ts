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

function localFallback(prompt: string, system: string): string {
  const text = `${system}\n${prompt}`.toLowerCase();
  const isGame = /(игр|игра|игру|game|canvas|платформер|змейк|snake|шутер|runner|arcade)/i.test(text);
  const isAgent = /(агент|ии-агент|agent|system prompt|бот|workflow)/i.test(text);
  const isSite = /(сайт|лендинг|landing|html|верстк|website|страниц)/i.test(text);
  const isCode = /(код|react|typescript|javascript|python|bug|ошибк|компонент)/i.test(text);

  if (isGame) {
    return `Готовая HTML-игра. Сохрани как game.html и открой в браузере.

\`\`\`html
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Amethyst Arcade</title>
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 20%,#4338ca55,transparent 36%),#070711;color:white;font-family:Inter,Arial,sans-serif;overflow:hidden}.wrap{width:min(96vw,980px)}canvas{width:100%;aspect-ratio:16/9;border:1px solid #ffffff26;border-radius:22px;background:#090b18;box-shadow:0 30px 90px #0009;touch-action:none}.hud{display:flex;justify-content:space-between;gap:12px;margin:12px 4px;color:#c7d2fe}.pad{display:none;grid-template-columns:repeat(3,56px);gap:10px;justify-content:center;margin-top:12px}.pad button{height:52px;border:1px solid #ffffff2b;border-radius:16px;background:#ffffff12;color:white;font-size:20px}@media(max-width:720px){.pad{display:grid}.hud{font-size:14px}}
  </style>
</head>
<body>
  <main class="wrap"><canvas id="game" width="960" height="540"></canvas><div class="hud"><b>WASD/стрелки, Space</b><span>P пауза · R рестарт · touch работает</span></div><div class="pad"><span></span><button data-k="up">↑</button><span></span><button data-k="left">←</button><button data-k="fire">●</button><button data-k="right">→</button></div></main>
  <script>
    const c=document.getElementById('game'),x=c.getContext('2d');let keys={},state='menu',score=0,lives=3,t=0,last=0,player,orbs,shots,parts,spawn=0;
    function reset(){state='play';score=0;lives=3;t=0;player={x:480,y:420,r:18,vx:0};orbs=[];shots=[];parts=[];spawn=0;last=performance.now()}
    function boom(px,py,col){for(let i=0;i<18;i++)parts.push({x:px,y:py,vx:(Math.random()-.5)*7,vy:(Math.random()-.5)*7,a:1,c:col})}
    function fire(){if(state==='menu'||state==='over')return reset();shots.push({x:player.x,y:player.y-18,vy:-9})}
    addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=1;if(e.code==='Space')fire();if(e.key==='p')state=state==='pause'?'play':'pause';if(e.key==='r')reset()});addEventListener('keyup',e=>keys[e.key.toLowerCase()]=0);
    document.querySelectorAll('[data-k]').forEach(b=>{b.onpointerdown=()=>{const k=b.dataset.k;if(k==='fire')fire();else keys[k]=1};b.onpointerup=()=>{keys[b.dataset.k]=0}});c.onpointerdown=fire;
    function step(now){let dt=Math.min(32,now-last||16);last=now;if(state==='play'){t+=dt;spawn-=dt;player.vx=((keys.arrowright||keys.d||keys.right)?1:0)-((keys.arrowleft||keys.a||keys.left)?1:0);player.x=Math.max(24,Math.min(936,player.x+player.vx*(6+score*.006)));if(spawn<=0){orbs.push({x:40+Math.random()*880,y:-30,r:14+Math.random()*20,vy:2.2+score*.015,h:Math.random()*360});spawn=Math.max(230,760-score*4)}shots.forEach(s=>s.y+=s.vy);orbs.forEach(o=>o.y+=o.vy);for(const s of shots)for(const o of orbs)if(Math.hypot(s.x-o.x,s.y-o.y)<o.r+5){s.dead=o.dead=1;score+=10;boom(o.x,o.y,'hsl('+o.h+',90%,65%)')}for(const o of orbs)if(Math.hypot(player.x-o.x,player.y-o.y)<o.r+player.r){o.dead=1;lives--;boom(player.x,player.y,'#fb7185');if(lives<=0)state='over'}shots=shots.filter(s=>!s.dead&&s.y>-20);orbs=orbs.filter(o=>!o.dead&&o.y<590);parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.a*=.94});parts=parts.filter(p=>p.a>.04)}draw();requestAnimationFrame(step)}
    function draw(){x.clearRect(0,0,960,540);let g=x.createLinearGradient(0,0,960,540);g.addColorStop(0,'#10163a');g.addColorStop(1,'#210a3d');x.fillStyle=g;x.fillRect(0,0,960,540);for(let i=0;i<70;i++){x.fillStyle='#ffffff12';x.fillRect((i*97+t*.02)%960,(i*53)%540,2,2)}orbs.forEach(o=>{x.fillStyle='hsl('+o.h+',90%,60%)';x.beginPath();x.arc(o.x,o.y,o.r,0,7);x.fill()});shots.forEach(s=>{x.fillStyle='#67e8f9';x.fillRect(s.x-3,s.y-18,6,22)});parts.forEach(p=>{x.globalAlpha=p.a;x.fillStyle=p.c;x.fillRect(p.x,p.y,4,4);x.globalAlpha=1});if(player){x.fillStyle='#c084fc';x.beginPath();x.moveTo(player.x,player.y-24);x.lineTo(player.x-22,player.y+22);x.lineTo(player.x+22,player.y+22);x.closePath();x.fill()}x.fillStyle='white';x.font='22px Arial';x.fillText('Score '+score,24,34);x.fillText('Lives '+lives,24,64);if(state!=='play'){x.textAlign='center';x.font='54px Arial';x.fillText(state==='over'?'Game Over':'Amethyst Arcade',480,240);x.font='22px Arial';x.fillText('Space/тап — старт и огонь, R — рестарт',480,282);x.textAlign='left'}}
    requestAnimationFrame(step);
  </script>
</body>
</html>
\`\`\``;
  }

  if (isAgent) {
    return `Готовый ИИ-агент для Amethyst AI:\n\n**Название:** Product Builder Agent\n\n**Цель:** превращать идею в готовый результат: план, код, сайт, игру, промпт или проверку ошибок.\n\n**System prompt:** Ты — Product Builder Agent. Сначала сам выбираешь лучший путь реализации, затем выдаёшь готовый результат. Для кода давай полный рабочий файл. Для сайта — структуру и HTML/CSS/JS. Для игры — playable prototype с управлением, счётом, рестартом и mobile controls. Отвечай коротко, но достаточно полно.\n\n**Workflow:** понять задачу → выбрать формат → создать результат → проверить ошибки → предложить улучшение.`;
  }

  if (isSite) {
    return `Готовый HTML-сайт. Сохрани как site.html и открой в браузере.

\`\`\`html
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Amethyst Site</title>
  <style>
    *{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;background:#080810;color:#fff}.hero{min-height:100vh;display:grid;align-items:center;padding:32px;background:radial-gradient(circle at 72% 24%,#7c3aed66,transparent 28%),radial-gradient(circle at 18% 72%,#06b6d455,transparent 24%),linear-gradient(135deg,#070710,#111827)}nav{position:fixed;inset:18px 18px auto;display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border:1px solid #ffffff20;border-radius:18px;background:#05051099;backdrop-filter:blur(18px)}section{width:min(1080px,100%);margin:auto;display:grid;gap:28px}.eyebrow{color:#67e8f9;font-weight:800}h1{font-size:clamp(44px,9vw,104px);line-height:.92;margin:0;letter-spacing:0}p{max-width:660px;color:#c7d2fe;font-size:20px;line-height:1.55}.cta{display:flex;gap:12px;flex-wrap:wrap}.cta a{padding:15px 20px;border-radius:16px;text-decoration:none;font-weight:850}.primary{background:#fff;color:#111827}.secondary{border:1px solid #ffffff33;color:#fff}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}.card{padding:20px;border:1px solid #ffffff20;border-radius:20px;background:#ffffff0d;box-shadow:0 20px 60px #0004;transition:.25s}.card:hover{transform:translateY(-4px);background:#ffffff16}@media(max-width:640px){nav{inset:10px 10px auto}.hero{padding:86px 18px 28px}p{font-size:17px}.cta a{width:100%;text-align:center}}
  </style>
</head>
<body>
  <nav><b>Amethyst</b><span>AI Builder</span></nav>
  <main class="hero"><section><div class="eyebrow">Новое видение Искусственного Интеллекта</div><h1>Создавай сайты, игры и идеи быстрее</h1><p>Готовый интерфейс с мощным визуальным стилем, адаптацией под телефон и понятными действиями для пользователя.</p><div class="cta"><a class="primary" href="#">Начать</a><a class="secondary" href="#features">Возможности</a></div><div id="features" class="grid"><div class="card">Сайты под ключ</div><div class="card">Игровые прототипы</div><div class="card">ИИ-агенты</div><div class="card">Графика и промпты</div></div></section></main>
</body>
</html>
\`\`\``;
  }

  if (isCode) return `Я готов помочь с кодом. Пришли задачу или файл, и я дам рабочее решение: полный код, объяснение запуска и проверку типичных ошибок.`;

  return `Amethyst AI готов. Я могу помочь с кодом, играми, сайтами, ИИ-агентами и картинками. Напиши, что нужно создать, и я дам готовый результат.`;
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

async function invokeAi(prompt: string, system: string, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw new DOMException('Запрос отменён', 'AbortError');

  const { data, error } = await supabase.functions.invoke('ai', {
    body: { prompt, system },
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
    text = await invokeAi(base.prompt, system, signal);
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
    return await invokeAi(base.prompt, system, typeof input !== 'string' ? input.signal : undefined);
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
