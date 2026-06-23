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

  if (/(игр|game|canvas|платформер|змейк|snake|шутер)/i.test(text)) {
    return `Готовый шаблон HTML-игры. Сохрани как game.html и открой в браузере.

\`\`\`html
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Amethyst Runner</title>
  <style>
    body{margin:0;background:#090910;color:white;font-family:Arial;display:grid;place-items:center;min-height:100vh}
    canvas{width:min(94vw,900px);height:auto;border:1px solid #333;border-radius:18px;background:#101225}
    .hint{opacity:.75;margin-top:12px;text-align:center}
  </style>
</head>
<body>
  <main>
    <canvas id="game" width="900" height="520"></canvas>
    <div class="hint">Space/тап — прыжок, P — пауза, R — рестарт</div>
  </main>
  <script>
    const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
    let player,blocks,score,best,over,paused,spawn,last;
    function reset(){player={x:90,y:400,w:38,h:38,vy:0,on:false};blocks=[];score=0;best=+localStorage.bestRunner||0;over=false;paused=false;spawn=0;last=performance.now();}
    function jump(){if(over){reset();return} if(player.on){player.vy=-15;player.on=false}}
    addEventListener('keydown',e=>{if(e.code==='Space')jump(); if(e.key==='p')paused=!paused; if(e.key==='r')reset();});
    addEventListener('pointerdown',jump);
    function loop(now){const dt=Math.min(32,now-last);last=now;if(!paused&&!over){score+=dt*.01;spawn-=dt;if(spawn<=0){blocks.push({x:930,y:410,w:34+Math.random()*42,h:28+Math.random()*70});spawn=720-Math.min(360,score*6)}player.vy+=.8;player.y+=player.vy;if(player.y+player.h>=438){player.y=438-player.h;player.vy=0;player.on=true}for(const b of blocks)b.x-=6+score*.018;blocks=blocks.filter(b=>b.x+b.w>-20);for(const b of blocks){if(player.x<b.x+b.w&&player.x+player.w>b.x&&player.y<b.y+b.h&&player.y+player.h>b.y){over=true;best=Math.max(best,Math.floor(score));localStorage.bestRunner=best}}}
      ctx.clearRect(0,0,900,520);const g=ctx.createLinearGradient(0,0,900,520);g.addColorStop(0,'#14142a');g.addColorStop(1,'#32115d');ctx.fillStyle=g;ctx.fillRect(0,0,900,520);ctx.fillStyle='#2dd4bf';ctx.fillRect(0,438,900,6);ctx.fillStyle='#a78bfa';ctx.fillRect(player.x,player.y,player.w,player.h);ctx.fillStyle='#f43f5e';blocks.forEach(b=>ctx.fillRect(b.x,b.y,b.w,b.h));ctx.fillStyle='white';ctx.font='22px Arial';ctx.fillText('Score: '+Math.floor(score),24,34);ctx.fillText('Best: '+best,24,64);if(paused||over){ctx.textAlign='center';ctx.font='44px Arial';ctx.fillText(over?'Game Over':'Pause',450,240);ctx.font='20px Arial';ctx.fillText(over?'Нажми R или тап для рестарта':'Нажми P для продолжения',450,278);ctx.textAlign='left'}requestAnimationFrame(loop)}
    reset();requestAnimationFrame(loop);
  </script>
</body>
</html>
\`\`\``;
  }

  if (/(агент|agent|system prompt|бот)/i.test(text)) {
    return `Готовый ИИ-агент для Amethyst AI:

**Название:** Project Builder Agent

**Цель:** превращать идею пользователя в готовый план, код, интерфейс или инструкцию.

**System prompt:**
Ты — Project Builder Agent. Твоя задача — быстро понять цель пользователя, предложить лучшую структуру решения и дать готовый результат. Если нужен код, пиши полный рабочий код. Если нужен сайт, описывай структуру экранов и давай HTML/CSS/JS или React-компоненты. Если нужна игра, делай playable prototype с управлением, счётом и рестартом. Отвечай коротко, по делу, без воды.

**Workflow:**
1. Определи тип задачи: код, сайт, игра, дизайн, текст, стратегия.
2. Выбери минимальную рабочую реализацию.
3. Дай готовый результат.
4. Проверь риски: ошибки, зависимости, запуск.
5. Предложи 1-2 улучшения.

**Формат ответа:**
Результат → код/план → как запустить → что улучшить.`;
  }

  if (/(сайт|landing|html|верстк|website)/i.test(text)) {
    return `Могу собрать сайт как один готовый HTML-файл. Напиши тематику, например: “сайт для кофейни”, “портфолио дизайнера”, “лендинг Amethyst AI”. Я верну полный HTML/CSS/JS с адаптацией под телефон.`;
  }

  if (/(код|react|typescript|javascript|python|bug|ошибк)/i.test(text)) {
    return `Я готов помочь с кодом. Пришли задачу или файл, и я дам рабочее решение: полный код, объяснение запуска и проверку типичных ошибок.`;
  }

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
