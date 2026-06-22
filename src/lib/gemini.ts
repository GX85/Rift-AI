// Прямой вызов Gemini из браузера (без Supabase-функции) — чтобы ИИ отвечал сразу.
// Ключ берётся из .env: VITE_GEMINI_API_KEY.
// ⚠️ Ключ виден в браузере — это нормально для учебного проекта; для прода прячут на сервере.

const KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
// gemini-2.5-flash — рабочая модель на текущем ключе (у 2.0-flash нулевая квота).
const MODEL = 'gemini-2.5-flash';

export type ChatTurn = { role: 'user' | 'assistant'; text: string };

// ──────────── Агент с инструментами (десктоп) ────────────
export type AgentStep =
  | { kind: 'call'; name: string; args: Record<string, unknown> }
  | { kind: 'result'; name: string; result: string };

// Инструменты, которыми агент реально управляет компьютером.
const AGENT_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'run_command',
        description: 'Выполнить shell-команду в Windows (cmd) и получить её вывод.',
        parameters: {
          type: 'object',
          properties: { command: { type: 'string', description: 'команда, например: dir или python script.py' } },
          required: ['command'],
        },
      },
      {
        name: 'read_file',
        description: 'Прочитать текстовый файл по абсолютному пути.',
        parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      },
      {
        name: 'write_file',
        description: 'Создать или перезаписать текстовый файл по абсолютному пути.',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' }, content: { type: 'string' } },
          required: ['path', 'content'],
        },
      },
      {
        name: 'list_dir',
        description: 'Показать содержимое папки по абсолютному пути.',
        parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      },
    ],
  },
];

export function hasDesktop(): boolean {
  return typeof window !== 'undefined' && !!window.rift?.desktop;
}

async function execTool(name: string, args: Record<string, unknown>): Promise<string> {
  const r = typeof window !== 'undefined' ? window.rift : undefined;
  if (!r?.desktop) return 'Ошибка: десктоп-режим недоступен — запусти приложение Amethyst на ПК.';
  try {
    if (name === 'run_command') {
      const cmd = String(args.command ?? '');
      if (!confirm('⚠️ Amethyst хочет выполнить команду на ПК:\n\n' + cmd + '\n\nРазрешить?'))
        return 'Отменено пользователем — команда не выполнена.';
      return await r.runCommand(cmd);
    }
    if (name === 'read_file') return await r.readFile(String(args.path ?? ''));
    if (name === 'write_file') {
      const p = String(args.path ?? '');
      if (!confirm('⚠️ Amethyst хочет записать файл:\n\n' + p + '\n\nРазрешить?'))
        return 'Отменено пользователем — файл не записан.';
      return await r.writeFile(p, String(args.content ?? ''));
    }
    if (name === 'list_dir') return await r.listDir(String(args.path ?? ''));
    return 'Неизвестный инструмент: ' + name;
  } catch (e) {
    return 'Ошибка инструмента: ' + (e instanceof Error ? e.message : String(e));
  }
}

// Агентный цикл: модель вызывает инструменты, мы выполняем, отдаём результат — пока не закончит.
export async function runAgent(opts: {
  system: string;
  history: ChatTurn[];
  prompt: string;
  temperature: number;
  onStep: (s: AgentStep) => void;
  signal?: AbortSignal;
}): Promise<string> {
  if (!KEY) throw new Error('Нет VITE_GEMINI_API_KEY в .env.');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [
    ...opts.history.map((h) => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: opts.prompt }] },
  ];

  for (let step = 0; step < 8; step++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents,
          tools: AGENT_TOOLS,
          generationConfig: { temperature: opts.temperature, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: opts.signal,
      },
    );
    const data = await res.json();
    if (data?.error) {
      const c = data.error.code;
      if (c === 429) throw new Error('Gemini перегружен или лимит. Подожди пару секунд и нажми «Повторить».');
      if (c === 503) throw new Error('Gemini временно недоступен. Попробуй ещё раз.');
      throw new Error('Gemini: ' + (data.error.message ?? 'ошибка'));
    }

    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = parts.filter((p: any) => p.functionCall);

    if (calls.length) {
      contents.push({ role: 'model', parts });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const respParts: any[] = [];
      for (const c of calls) {
        const name = c.functionCall.name as string;
        const args = (c.functionCall.args ?? {}) as Record<string, unknown>;
        opts.onStep({ kind: 'call', name, args });
        const result = await execTool(name, args);
        opts.onStep({ kind: 'result', name, result });
        respParts.push({ functionResponse: { name, response: { result } } });
      }
      contents.push({ role: 'user', parts: respParts });
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = parts.map((p: any) => p.text ?? '').join('').trim();
    return text || '(агент выполнил действия)';
  }
  return 'Агент остановлен: слишком много шагов.';
}

// Стримит ответ Gemini по кусочкам текста.
export async function* streamGemini(opts: {
  system: string;
  history: ChatTurn[];
  prompt: string;
  temperature: number;
  maxTokens?: number;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  if (!KEY) throw new Error('Нет VITE_GEMINI_API_KEY в .env — добавь ключ и перезапусти npm run dev.');

  const contents = [
    ...opts.history.map((h) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.text }],
    })),
    { role: 'user', parts: [{ text: opts.prompt }] },
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: opts.system ? { parts: [{ text: opts.system }] } : undefined,
        contents,
        generationConfig: {
          temperature: opts.temperature,
          maxOutputTokens: opts.maxTokens ?? 4096,
          topP: 0.95,
          // Отключаем «размышления» — отвечает сразу текстом, а не тратит токены на мысли.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: opts.signal,
    },
  );

  if (!res.ok || !res.body) {
    let msg = `Gemini вернул ошибку (HTTP ${res.status}).`;
    if (res.status === 429) msg = 'Gemini перегружен или достигнут лимит запросов. Подожди пару секунд и нажми «Повторить».';
    else if (res.status === 503) msg = 'Gemini временно недоступен. Попробуй ещё раз через несколько секунд.';
    else {
      try {
        const j = await res.json();
        if (j?.error?.message) msg = 'Gemini: ' + j.error.message;
      } catch {
        /* ignore */
      }
    }
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const parts = json?.candidates?.[0]?.content?.parts ?? [];
        const text = parts.map((p: { text?: string }) => p.text ?? '').join('');
        if (text) yield text;
      } catch {
        /* неполный JSON — придёт в следующем кусочке */
      }
    }
  }
}
