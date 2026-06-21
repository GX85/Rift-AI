// AI-функция на бесплатном ключе Google Gemini.
// Вызов с фронта: supabase.functions.invoke('ai', { body: { prompt, system, history, temperature } })
//
// Запуск (один раз):
//   1) Возьми бесплатный ключ: https://aistudio.google.com/apikey
//   2) Положи его в секрет:  npm run ai:secret -- GEMINI_API_KEY=твой_ключ
//   3) Задеплой функцию:     npm run ai:deploy

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
// gemini-3.5-flash — самая умная из быстрых моделей (рассуждает лучше, чем 2.0).
const MODEL = 'gemini-3.5-flash';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Достаём весь текст из ответа (у "думающих" моделей бывает несколько частей).
function extractText(data: unknown): string {
  const parts =
    (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]
      ?.content?.parts ?? [];
  return parts
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
    // history — массив {role, text} для памяти диалога; temperature — «креативность» (0–1).
    const { prompt, system, history, temperature } = await req.json();
    if (!prompt) throw new Error('Нужно поле prompt');

    const pastContents = (history ?? []).map((h: { role: string; text: string }) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.text }],
    }));

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents: [...pastContents, { role: 'user', parts: [{ text: prompt }] }],
          // Настройки «интеллекта»: больше места для развёрнутого ответа + управляемая креативность.
          generationConfig: {
            temperature: typeof temperature === 'number' ? temperature : 0.9,
            maxOutputTokens: 2048,
            topP: 0.95,
          },
        }),
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
