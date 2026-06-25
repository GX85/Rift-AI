type ComputerAction = 'status' | 'systemInfo' | 'openUrl' | 'openApp' | 'listDir' | 'readFile' | 'showItem';

type ComputerPayload = {
  url?: string;
  name?: string;
  path?: string;
};

export type ComputerIntent = {
  action: ComputerAction;
  payload?: ComputerPayload;
  description: string;
  needsConfirm: boolean;
};

const APP_ALIASES: Array<{ pattern: RegExp; name: string; title: string }> = [
  { pattern: /\b(калькулятор|calculator|calc)\b/i, name: 'calculator', title: 'калькулятор' },
  { pattern: /\b(блокнот|notepad)\b/i, name: 'notepad', title: 'блокнот' },
  { pattern: /\b(paint|паинт|пэйнт)\b/i, name: 'paint', title: 'Paint' },
  { pattern: /\b(проводник|explorer)\b/i, name: 'explorer', title: 'проводник' },
  { pattern: /\b(vs ?code|vscode|visual studio code|code)\b/i, name: 'vscode', title: 'VS Code' },
];

function cleanPath(value: string) {
  return value
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.!?]+$/g, '')
    .trim();
}

function normalizeSpecialPath(value: string) {
  const lower = value.toLowerCase();
  if (/^(desktop|рабочий стол|стол)$/i.test(lower)) return '~/Desktop';
  if (/^(downloads|загрузки)$/i.test(lower)) return '~/Downloads';
  if (/^(documents|документы)$/i.test(lower)) return '~/Documents';
  if (/^(home|домашняя|папка пользователя)$/i.test(lower)) return '~';
  return value;
}

function extractUrl(text: string) {
  const direct = text.match(/https?:\/\/[^\s)]+/i)?.[0];
  if (direct) return direct.replace(/[.,!?]+$/g, '');

  const afterPhrase = text.match(/(?:открой|запусти|open)\s+(?:сайт|ссылку|url)?\s*([a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?)/i)?.[1];
  if (afterPhrase) return afterPhrase.replace(/[.,!?]+$/g, '');

  return null;
}

function extractPath(text: string, words: string[]) {
  const joined = words.join('|');
  const match = text.match(new RegExp(`(?:${joined})\\s+(.+)$`, 'i'))?.[1];
  if (!match) return null;
  return normalizeSpecialPath(cleanPath(match));
}

export function isComputerControlAvailable() {
  return typeof window !== 'undefined' && Boolean(window.rift?.desktop && window.rift.computerControl);
}

export function detectComputerIntent(text: string): ComputerIntent | null {
  const value = text.trim();
  const lower = value.toLowerCase();

  if (/(статус|провер(ь|ить)).*(плагин|computer control|управлен)/i.test(lower) || /computer control/i.test(lower)) {
    return {
      action: 'status',
      description: 'проверить desktop-плагин управления компьютером',
      needsConfirm: false,
    };
  }

  if (/(инфо|информация|характеристики|сведения).*(систем|компьютер|пк)|system info|about this pc/i.test(lower)) {
    return {
      action: 'systemInfo',
      description: 'показать информацию о системе',
      needsConfirm: false,
    };
  }

  const url = extractUrl(value);
  if (url && /(открой|запусти|open|перейди)/i.test(lower)) {
    return {
      action: 'openUrl',
      payload: { url },
      description: `открыть ссылку ${url}`,
      needsConfirm: true,
    };
  }

  if (/(открой|запусти|open|запусти приложение)/i.test(lower)) {
    const app = APP_ALIASES.find((candidate) => candidate.pattern.test(lower));
    if (app) {
      return {
        action: 'openApp',
        payload: { name: app.name },
        description: `открыть ${app.title}`,
        needsConfirm: true,
      };
    }
  }

  const showPath = extractPath(value, ['покажи в проводнике', 'открой в проводнике', 'открой папку', 'open folder', 'show in explorer']);
  if (showPath) {
    return {
      action: 'showItem',
      payload: { path: showPath },
      description: `показать в проводнике ${showPath}`,
      needsConfirm: true,
    };
  }

  const listPath = extractPath(value, ['покажи папку', 'список файлов в', 'список папки', 'list dir', 'list folder']);
  if (listPath) {
    return {
      action: 'listDir',
      payload: { path: listPath },
      description: `показать файлы в ${listPath}`,
      needsConfirm: false,
    };
  }

  const readPath = extractPath(value, ['прочитай файл', 'покажи файл', 'read file']);
  if (readPath) {
    return {
      action: 'readFile',
      payload: { path: readPath },
      description: `прочитать файл ${readPath}`,
      needsConfirm: false,
    };
  }

  return null;
}

export async function runComputerIntent(intent: ComputerIntent) {
  if (!isComputerControlAvailable()) {
    return 'ПК-плагин доступен только в desktop-версии Amethyst. В браузере сайт не может управлять компьютером.';
  }

  if (intent.needsConfirm) {
    const ok = window.confirm(`Amethyst хочет выполнить действие: ${intent.description}. Разрешить?`);
    if (!ok) return 'Действие отменено.';
  }

  const result = await window.rift!.computerControl(intent.action, intent.payload);
  return result.ok ? `Готово: ${result.text}` : `Не получилось: ${result.text}`;
}
