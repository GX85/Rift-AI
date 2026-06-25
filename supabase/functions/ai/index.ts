// AI-функция на бесплатном ключе Google Gemini.
// Вызов с фронта:
//   • обычный:   supabase.functions.invoke('ai', { body: { prompt, system, history, temperature } })
//   • стриминг:  fetch(<url>/functions/v1/ai, { body: { ..., stream: true } }) → читаешь response.body
//
// Запуск (один раз):
//   1) Возьми бесплатный ключ: https://aistudio.google.com/apikey
//   2) Положи его в секрет:  npm run ai:secret -- GEMINI_API_KEY=твой_ключ
//   3) Задеплой функцию:     npm run ai:deploy

// В рантайме Supabase Edge Functions объект Deno есть всегда.
// Это объявление нужно только редактору (обычному TypeScript), чтобы он не подсвечивал «Deno».
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
// Максимальный актуальный дефолт для сложного кода, сайтов, игр и agentic-задач.
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Достаём весь текст из ответа (у "думающих" моделей бывает несколько частей).
function extractText(data: unknown): string {
  const parts =
    (data as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] })?.candidates?.[0]
      ?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought) // части-«мысли» в ответ не отдаём
    .map((p) => p.text ?? '')
    .join('')
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Нет GEMINI_API_KEY. Поставь секрет: npm run ai:secret -- GEMINI_API_KEY=...');
    }
    // history — массив {role, text} для памяти диалога; temperature — «креативность» (0–1);
    // stream — если true, ответ отдаётся по кусочкам (печатается в реальном времени).
    const { prompt, system, history, temperature, maxTokens, stream } = await req.json();
    if (!prompt) throw new Error('Нужно поле prompt');

    const pastContents = (history ?? []).map((h: { role: string; text: string }) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.text }],
    }));

    const requestBody = JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents: [...pastContents, { role: 'user', parts: [{ text: prompt }] }],
      // Настройки «интеллекта»: больше места для развёрнутого ответа + управляемая креативность.
      generationConfig: {
        temperature: typeof temperature === 'number' ? temperature : 0.72,
        maxOutputTokens: typeof maxTokens === 'number' ? Math.min(Math.max(maxTokens, 512), 65536) : 32768,
        topP: 0.95,
      },
    });

    // ── Режим стриминга: качаем SSE из Gemini и пересылаем фронту чистый текст по кусочкам ──
    if (stream) {
      const upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        },
      );

      if (!upstream.ok || !upstream.body) {
        const errText = await upstream.text();
        throw new Error(`Gemini: ${errText || upstream.statusText}`);
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = '';

      const out = new ReadableStream({
        async pull(controller) {
          const { value, done } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          // SSE-события разделены переводами строк, payload идёт после "data:".
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? ''; // последний кусок может быть неполным — оставляем на потом
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const delta = extractText(JSON.parse(payload));
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              // неполный JSON в этом кусочке — придёт целиком в следующем
            }
          }
        },
        cancel() {
          reader.cancel();
        },
      });

      return new Response(out, {
        headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // ── Обычный режим: ждём весь ответ и отдаём JSON ──
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      },
    );

    const data = await res.json();

    if (data?.error) {
      throw new Error(`Gemini: ${data.error.message ?? JSON.stringify(data.error)}`);
    }

    const text = extractText(data);
    return new Response(JSON.stringify({ text }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
