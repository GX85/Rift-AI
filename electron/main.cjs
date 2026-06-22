// Главный процесс Electron — десктоп-оболочка Amethyst.
// Даёт агенту Amethyst реальный доступ к ПК: команды, файлы, папки.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b0c12',
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

// ──────────── Инструменты для агента ────────────
ipcMain.handle('rift:runCommand', (_e, cmd) => {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, maxBuffer: 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      let out = (stdout || '').trim();
      if (stderr && stderr.trim()) out += (out ? '\n' : '') + '[stderr] ' + stderr.trim();
      if (err && !out) out = '[ошибка] ' + err.message;
      resolve(out || '(пустой вывод)');
    });
  });
});

ipcMain.handle('rift:readFile', async (_e, p) => {
  return fs.promises.readFile(p, 'utf8');
});

ipcMain.handle('rift:writeFile', async (_e, p, content) => {
  await fs.promises.mkdir(path.dirname(p), { recursive: true });
  await fs.promises.writeFile(p, content ?? '', 'utf8');
  return 'Файл сохранён: ' + p;
});

ipcMain.handle('rift:listDir', async (_e, p) => {
  const items = await fs.promises.readdir(p, { withFileTypes: true });
  return items.map((i) => (i.isDirectory() ? '[папка] ' : '       ') + i.name).join('\n') || '(пусто)';
});

ipcMain.handle('rift:homedir', () => os.homedir());
ipcMain.handle('rift:desktopDir', () => path.join(os.homedir(), 'Desktop'));
