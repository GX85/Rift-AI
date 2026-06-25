// Главный процесс Electron — десктоп-оболочка Amethyst.
// Computer Control Plugin: безопасные действия с ПК без произвольного shell.
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
const workspaceRoot = path.resolve(__dirname, '..');
const homeDir = os.homedir();
const allowedRoots = [workspaceRoot, homeDir].map((p) => path.resolve(p).toLowerCase());

const appAllowlist = {
  calculator: 'calc.exe',
  calc: 'calc.exe',
  калькулятор: 'calc.exe',
  notepad: 'notepad.exe',
  блокнот: 'notepad.exe',
  paint: 'mspaint.exe',
  explorer: 'explorer.exe',
  проводник: 'explorer.exe',
  vscode: 'code',
  code: 'code',
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#050506',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function safeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function resolveSafePath(inputPath) {
  const raw = safeString(inputPath);
  if (!raw) throw new Error('Нужен путь к файлу или папке.');
  const resolved = path.resolve(raw.replace(/^~(?=$|[\\/])/, homeDir));
  const normalized = resolved.toLowerCase();
  const allowed = allowedRoots.some((root) => normalized === root || normalized.startsWith(root + path.sep));
  if (!allowed) {
    throw new Error('Доступ разрешен только внутри папки пользователя или проекта Amethyst.');
  }
  return resolved;
}

async function readTextFile(filePath) {
  const resolved = resolveSafePath(filePath);
  const stat = await fs.promises.stat(resolved);
  if (!stat.isFile()) throw new Error('Это не файл.');
  if (stat.size > 512 * 1024) throw new Error('Файл слишком большой для чтения через чат.');
  return fs.promises.readFile(resolved, 'utf8');
}

async function listDir(dirPath) {
  const resolved = resolveSafePath(dirPath || homeDir);
  const items = await fs.promises.readdir(resolved, { withFileTypes: true });
  return items
    .slice(0, 120)
    .map((item) => `${item.isDirectory() ? '[папка]' : '       '} ${item.name}`)
    .join('\n') || '(пусто)';
}

async function writeTextFile(filePath, content) {
  const resolved = resolveSafePath(filePath);
  const text = typeof content === 'string' ? content : '';
  if (Buffer.byteLength(text, 'utf8') > 512 * 1024) throw new Error('Файл слишком большой для записи через чат.');
  await fs.promises.mkdir(path.dirname(resolved), { recursive: true });
  await fs.promises.writeFile(resolved, text, 'utf8');
  return `Файл сохранён: ${resolved}`;
}

async function openUrl(url) {
  const raw = safeString(url);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    parsed = new URL(`https://${raw}`);
  }
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Можно открывать только http/https ссылки.');
  await shell.openExternal(parsed.toString());
  return `Открыто: ${parsed.toString()}`;
}

async function openApp(name) {
  const key = safeString(name).toLowerCase();
  const appName = appAllowlist[key];
  if (!appName) {
    throw new Error(`Приложение не в allowlist. Доступно: ${Object.keys(appAllowlist).join(', ')}`);
  }
  await new Promise((resolve, reject) => {
    const child = spawn(appName, [], { detached: true, stdio: 'ignore', shell: false });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve(undefined);
    });
  });
  return `Запускаю: ${key}`;
}

async function showItem(itemPath) {
  const resolved = resolveSafePath(itemPath);
  shell.showItemInFolder(resolved);
  return `Показал в проводнике: ${resolved}`;
}

function systemInfo() {
  return [
    `OS: ${os.type()} ${os.release()} (${os.arch()})`,
    `CPU: ${os.cpus()[0]?.model ?? 'unknown'}`,
    `Cores: ${os.cpus().length}`,
    `RAM: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB`,
    `Home: ${homeDir}`,
    `Project: ${workspaceRoot}`,
  ].join('\n');
}

ipcMain.handle('rift:computerControl', async (_event, action, payload = {}) => {
  try {
    switch (safeString(action)) {
      case 'status':
        return {
          ok: true,
          text: 'Computer Control Plugin активен. Доступны: systemInfo, openUrl, openApp, listDir, readFile, writeFile, showItem.',
        };
      case 'systemInfo':
        return { ok: true, text: systemInfo() };
      case 'openUrl':
        return { ok: true, text: await openUrl(payload.url) };
      case 'openApp':
        return { ok: true, text: await openApp(payload.name) };
      case 'listDir':
        return { ok: true, text: await listDir(payload.path) };
      case 'readFile':
        return { ok: true, text: await readTextFile(payload.path) };
      case 'writeFile':
        return { ok: true, text: await writeTextFile(payload.path, payload.content) };
      case 'showItem':
        return { ok: true, text: await showItem(payload.path) };
      default:
        throw new Error('Неизвестное действие computerControl.');
    }
  } catch (error) {
    return { ok: false, text: error instanceof Error ? error.message : String(error) };
  }
});

// Deprecated compatibility methods. Они оставлены, но shell-команды специально заблокированы.
ipcMain.handle('rift:runCommand', async () => 'runCommand отключён ради безопасности. Используй computerControl с allowlist.');
ipcMain.handle('rift:readFile', async (_e, p) => readTextFile(p));
ipcMain.handle('rift:writeFile', async (_e, p, content) => writeTextFile(p, content));
ipcMain.handle('rift:listDir', async (_e, p) => listDir(p));
ipcMain.handle('rift:homedir', () => homeDir);
ipcMain.handle('rift:desktopDir', () => path.join(homeDir, 'Desktop'));
