// Типы моста десктоп-оболочки (Electron). В вебе window.rift отсутствует.
export {};

type ComputerControlAction =
  | 'status'
  | 'systemInfo'
  | 'openUrl'
  | 'openApp'
  | 'listDir'
  | 'readFile'
  | 'writeFile'
  | 'showItem';

type ComputerControlPayload = {
  url?: string;
  name?: string;
  path?: string;
  content?: string;
};

type ComputerControlResult = {
  ok: boolean;
  text: string;
};

declare global {
  interface Window {
    rift?: {
      desktop: boolean;
      computerControl(action: ComputerControlAction, payload?: ComputerControlPayload): Promise<ComputerControlResult>;
      runCommand(cmd: string): Promise<string>;
      readFile(path: string): Promise<string>;
      writeFile(path: string, content: string): Promise<string>;
      listDir(path: string): Promise<string>;
      homedir(): Promise<string>;
      desktopDir(): Promise<string>;
    };
  }
}
