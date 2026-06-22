// Типы моста десктоп-оболочки (Electron). В вебе window.rift отсутствует.
export {};

declare global {
  interface Window {
    rift?: {
      desktop: boolean;
      runCommand(cmd: string): Promise<string>;
      readFile(path: string): Promise<string>;
      writeFile(path: string, content: string): Promise<string>;
      listDir(path: string): Promise<string>;
      homedir(): Promise<string>;
      desktopDir(): Promise<string>;
    };
  }
}
