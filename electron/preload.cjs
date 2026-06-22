// Безопасный мост между десктоп-оболочкой Amethyst и веб-интерфейсом.
// В renderer появляется window.rift с разрешёнными действиями (имя моста оставлено для совместимости).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rift', {
  desktop: true,
  runCommand: (cmd) => ipcRenderer.invoke('rift:runCommand', cmd),
  readFile: (p) => ipcRenderer.invoke('rift:readFile', p),
  writeFile: (p, content) => ipcRenderer.invoke('rift:writeFile', p, content),
  listDir: (p) => ipcRenderer.invoke('rift:listDir', p),
  homedir: () => ipcRenderer.invoke('rift:homedir'),
  desktopDir: () => ipcRenderer.invoke('rift:desktopDir'),
});
