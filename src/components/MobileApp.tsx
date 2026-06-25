import { useMemo, useState } from 'react';
import { CodeWorkspace } from './CodeWorkspace';

type MobileAppProps = {
  name: string;
  email: string;
  avatar: string;
  onSignOut: () => void;
  onHome: () => void;
};

type MobileEntryProps = {
  onEnter: () => void;
};

const ACCESS_CODES = ['ITSAMETHYST', 'AMETHYSTAI', 'AMETHYSTPLUS'];

function currentMobileUrl() {
  if (typeof window === 'undefined') return 'https://rift-ai-kzjh.vercel.app/mobile';
  return `${window.location.origin}/mobile`;
}

function gfMul(x: number, y: number) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function gfPow(x: number, power: number) {
  let y = 1;
  for (let i = 0; i < power; i++) y = gfMul(y, x);
  return y;
}

function rsDivisor(degree: number) {
  const result = Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  for (let i = 0; i < degree; i++) {
    const root = gfPow(2, i);
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
  }
  return result;
}

function rsRemainder(data: number[], degree: number) {
  const divisor = rsDivisor(degree);
  const result = Array<number>(degree).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift()!;
    result.push(0);
    for (let i = 0; i < degree; i++) result[i] ^= gfMul(divisor[i], factor);
  }
  return result;
}

function appendBits(bits: number[], val: number, len: number) {
  for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
}

function getBit(val: number, i: number) {
  return ((val >>> i) & 1) !== 0;
}

function buildQr(value: string) {
  const version = 4;
  const size = version * 4 + 17;
  const dataCodewords = 80;
  const ecCodewords = 20;
  const bytes = Array.from(new TextEncoder().encode(value)).slice(0, 72);
  const bits: number[] = [];

  appendBits(bits, 0x4, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  appendBits(bits, 0, Math.min(4, dataCodewords * 8 - bits.length));
  while (bits.length % 8) bits.push(0);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    data.push(byte);
  }
  for (let pad = 0xec; data.length < dataCodewords; pad ^= 0xec ^ 0x11) data.push(pad);

  const codewords = [...data, ...rsRemainder(data, ecCodewords)];
  const modules: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  function setFunction(x: number, y: number, dark: boolean) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = dark;
    reserved[y][x] = true;
  }

  function finder(cx: number, cy: number) {
    for (let y = -4; y <= 4; y++) {
      for (let x = -4; x <= 4; x++) {
        const dist = Math.max(Math.abs(x), Math.abs(y));
        setFunction(cx + x, cy + y, dist !== 2 && dist !== 4);
      }
    }
  }

  function alignment(cx: number, cy: number) {
    for (let y = -2; y <= 2; y++) {
      for (let x = -2; x <= 2; x++) {
        setFunction(cx + x, cy + y, Math.max(Math.abs(x), Math.abs(y)) !== 1);
      }
    }
  }

  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  alignment(26, 26);

  for (let i = 8; i < size - 8; i++) {
    setFunction(i, 6, i % 2 === 0);
    setFunction(6, i, i % 2 === 0);
  }
  setFunction(8, size - 8, true);

  const mask = 0;
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (reserved[y][x]) continue;
        const byte = codewords[Math.floor(bitIndex / 8)] ?? 0;
        let dark = getBit(byte, 7 - (bitIndex % 8));
        if ((x + y) % 2 === 0) dark = !dark;
        modules[y][x] = dark;
        bitIndex++;
      }
    }
  }

  let dataBits = (1 << 3) | mask;
  let rem = dataBits;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >>> 9) & 1) * 0x537);
  const format = ((dataBits << 10) | (rem & 0x3ff)) ^ 0x5412;
  for (let i = 0; i <= 5; i++) setFunction(8, i, getBit(format, i));
  setFunction(8, 7, getBit(format, 6));
  setFunction(8, 8, getBit(format, 7));
  setFunction(7, 8, getBit(format, 8));
  for (let i = 9; i < 15; i++) setFunction(14 - i, 8, getBit(format, i));
  for (let i = 0; i < 8; i++) setFunction(size - 1 - i, 8, getBit(format, i));
  for (let i = 8; i < 15; i++) setFunction(8, size - 15 + i, getBit(format, i));

  return modules;
}

export function QrCode({ value }: { value: string }) {
  const modules = useMemo(() => buildQr(value), [value]);
  const size = modules.length;
  const quiet = 4;
  return (
    <svg className="qr-svg" viewBox={`0 0 ${size + quiet * 2} ${size + quiet * 2}`} role="img" aria-label="QR code">
      <rect width={size + quiet * 2} height={size + quiet * 2} rx="2" fill="#fff" />
      {modules.map((row, y) =>
        row.map((dark, x) => (dark ? <rect key={`${x}-${y}`} x={x + quiet} y={y + quiet} width="1" height="1" fill="#080810" /> : null)),
      )}
    </svg>
  );
}

export function MobileQrPage() {
  const url = currentMobileUrl();

  async function copyLink() {
    await navigator.clipboard?.writeText(url);
  }

  return (
    <main className="mobile-qr-page">
      <section className="mobile-qr-card">
        <div className="mobile-app-icon">
          <span>AI</span>
        </div>
        <p className="mobile-kicker">Amethyst Mobile</p>
        <h1>Открой на телефоне</h1>
        <p>Наведи камеру iPhone или Android на QR. Откроется отдельная мобильная версия приложения.</p>
        <QrCode value={url} />
        <div className="mobile-url">{url}</div>
        <div className="mobile-qr-actions">
          <a href={url}>Открыть здесь</a>
          <button onClick={copyLink}>Скопировать ссылку</button>
        </div>
      </section>
    </main>
  );
}

export function MobileEntry({ onEnter }: MobileEntryProps) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');

  function submit() {
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!ACCESS_CODES.includes(normalized)) {
      setMessage("Код: It'sAmethyst, AmethystAI или AmethystPlus");
      return;
    }
    onEnter();
  }

  return (
    <main className="mobile-entry">
      <section className="mobile-entry-card">
        <div className="mobile-app-icon">
          <span>AI</span>
        </div>
        <p className="mobile-kicker">Mobile app</p>
        <h1>Amethyst</h1>
        <p>Мобильная версия для кода: чат, ошибки, review, файлы и генерация web-app прототипов.</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Код доступа"
          autoComplete="one-time-code"
        />
        <button onClick={submit}>Открыть приложение</button>
        {message && <span>{message}</span>}
        <a href="/qr">Показать QR для телефона</a>
      </section>
    </main>
  );
}

export function MobileApp(props: MobileAppProps) {
  return (
    <div className="mobile-app-mode">
      <CodeWorkspace {...props} />
    </div>
  );
}
